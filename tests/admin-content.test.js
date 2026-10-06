import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { ADMIN, EDITOR, decode, jpegBuffer, login, setupTestEnv, wallClockInDays } from './helpers.js';

let env;
let schemas;
let agent;
let token;
let jpeg;

const animals = () => env.services.animalService;
const uploads = () => (fs.existsSync(env.config.uploadDir) ? fs.readdirSync(env.config.uploadDir) : []);
const send = (url, fields = {}) => agent.post(url).type('form').send({ _csrf: token, ...fields });

/** Multipart POST, CSRF token in the query string as the admin forms do. */
function multipart(url, fields, files = []) {
  let req = agent.post(`${url}?_csrf=${encodeURIComponent(token)}`);
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  for (const file of files) req = req.attach(file.field, file.buffer, { filename: file.filename, contentType: file.contentType });
  return req;
}

const animalFields = (overrides = {}) => ({
  name: 'Rex',
  species: 'chien',
  sex: 'male',
  breed: 'Croisé labrador',
  tagline: 'Un amour de chien',
  description: 'Rex adore les balades.',
  ok_dogs: 'oui',
  ok_cats: 'non',
  ok_kids: 'oui',
  housing: 'maison',
  status: 'disponible',
  backdrop: 'ajonc',
  published: 'on',
  ...overrides,
});

const idFromLocation = (res) => Number(/\/(\d+)(?:[?#]|$)/.exec(res.headers.location)[1]);

before(async () => {
  env = await setupTestEnv('content');
  schemas = await import('../src/schemas/index.js');
  env.services.userService.create(ADMIN);
  env.services.userService.create(EDITOR);
  agent = env.newAgent();
  // Content is managed by editors: the whole file runs with an editor session.
  token = await login(agent, EDITOR.email, EDITOR.password);
  jpeg = await jpegBuffer();
});

after(() => env.cleanup());

describe('tableau de bord', () => {
  test('le tableau de bord répond 200', async () => {
    const res = await agent.get('/admin');
    assert.equal(res.status, 200);
  });
});

describe('animaux : création et validation', () => {
  test('le formulaire de création porte le jeton CSRF dans l’URL d’envoi (multipart)', async () => {
    const res = await agent.get('/admin/animaux/nouveau');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes(`action="/admin/animaux?_csrf=${token}"`));
  });

  test('crée une fiche publiée visible sur le site public', async () => {
    const res = await multipart('/admin/animaux', animalFields({ name: 'Rexcreation' }));
    assert.equal(res.status, 303);
    assert.match(res.headers.location, /^\/admin\/animaux\/\d+$/);
    const animal = animals().getById(idFromLocation(res));
    assert.equal(animal.name, 'Rexcreation');
    assert.equal(animal.slug, 'rexcreation');
    assert.equal(animal.ok_cats, 'non');
    const page = await env.request().get(`/animaux/${animal.slug}`);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('Un amour de chien'));
    assert.ok((await agent.get(`/admin/animaux/${animal.id}`)).text.includes('est enregistré'));
  });

  test('deux animaux du même nom reçoivent des slugs distincts', async () => {
    const first = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Jumeau' }))));
    const second = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Jumeau' }))));
    assert.notEqual(first.slug, second.slug);
    assert.equal((await env.request().get(`/animaux/${first.slug}`)).status, 200);
    assert.equal((await env.request().get(`/animaux/${second.slug}`)).status, 200);
  });

  test('un nom accentué donne un slug sans accent', async () => {
    const animal = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Éclair Noël' }))));
    assert.equal(animal.slug, 'eclair-noel');
  });

  test('une création sans jeton CSRF est refusée (403) et rien n’est créé', async () => {
    const before = animals().listAdmin({}).length;
    const res = await agent.post('/admin/animaux').field('name', 'SansCsrf').field('species', 'chien');
    assert.equal(res.status, 403);
    assert.equal(animals().listAdmin({}).length, before);
  });

  test('un nom manquant est refusé (422) avec un message en français', async () => {
    const before = animals().listAdmin({}).length;
    const res = await multipart('/admin/animaux', animalFields({ name: '' }));
    assert.equal(res.status, 422);
    assert.ok(decode(res.text).includes('Donnez un nom à l’animal'));
    assert.equal(animals().listAdmin({}).length, before);
  });

  test('une espèce invalide est refusée (422) sans créer de fiche', async () => {
    const before = animals().listAdmin({}).length;
    const res = await multipart('/admin/animaux', animalFields({ name: 'Licorne', species: 'licorne' }));
    assert.equal(res.status, 422);
    assert.equal(animals().listAdmin({}).length, before);
  });

  test('une espèce invalide affiche le message "Choisissez une espèce"', async () => {
    const res = await multipart('/admin/animaux', animalFields({ name: 'Licorne', species: 'licorne' }));
    assert.ok(decode(res.text).includes('Choisissez une espèce'));
  });

  test('une date de naissance mal formée est refusée (422)', async () => {
    const res = await multipart('/admin/animaux', animalFields({ name: 'Datefausse', birth_date: '12/03/2020' }));
    assert.equal(res.status, 422);
    assert.ok(decode(res.text).includes('Date invalide'));
  });

  test('en cas d’erreur, les valeurs saisies sont conservées dans le formulaire', async () => {
    const res = await multipart('/admin/animaux', animalFields({ name: '', tagline: 'Accroche conservée' }));
    assert.equal(res.status, 422);
    assert.ok(decode(res.text).includes('Accroche conservée'));
  });

  test('une fiche inexistante ou un identifiant non numérique répond 404', async () => {
    assert.equal((await agent.get('/admin/animaux/999999')).status, 404);
    assert.equal((await agent.get('/admin/animaux/abc')).status, 404);
  });

  test('la liste admin filtre par statut et recherche par nom', async () => {
    await multipart('/admin/animaux', animalFields({ name: 'Recherchable' }));
    const search = await agent.get('/admin/animaux?q=Recherch');
    assert.equal(search.status, 200);
    assert.ok(search.text.includes('Recherchable'));
    assert.ok(!search.text.includes('Rexcreation'));
  });
});

describe('animaux : publication, statut et suppression', () => {
  let animal;

  before(async () => {
    const res = await multipart('/admin/animaux', animalFields({ name: 'Statutaire', species: 'chat' }));
    animal = animals().getById(idFromLocation(res));
  });

  test('la mise à jour d’une fiche est visible sur le site', async () => {
    const res = await multipart(`/admin/animaux/${animal.id}`, animalFields({ name: 'Statutaire', species: 'chat', tagline: 'Nouvelle accroche' }));
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, `/admin/animaux/${animal.id}`);
    assert.ok((await env.request().get(`/animaux/${animal.slug}`)).text.includes('Nouvelle accroche'));
  });

  test('une mise à jour invalide répond 422 et ne modifie rien', async () => {
    const res = await multipart(`/admin/animaux/${animal.id}`, animalFields({ name: '', species: 'chat' }));
    assert.equal(res.status, 422);
    assert.equal(animals().getById(animal.id).name, 'Statutaire');
  });

  test('la mise à jour d’une fiche inexistante répond 404', async () => {
    const res = await multipart('/admin/animaux/999999', animalFields());
    assert.equal(res.status, 404);
  });

  test('dépublier une fiche la rend introuvable (404) pour le public mais visible une fois connecté', async () => {
    const fields = animalFields({ name: 'Statutaire', species: 'chat' });
    delete fields.published;
    await multipart(`/admin/animaux/${animal.id}`, fields);
    assert.equal(animals().getById(animal.id).published, 0);
    assert.equal((await env.request().get(`/animaux/${animal.slug}`)).status, 404);
    assert.ok(!(await env.request().get('/animaux')).text.includes('Statutaire'));
    const preview = await agent.get(`/animaux/${animal.slug}`);
    assert.equal(preview.status, 200);
    assert.ok(preview.text.includes('Statutaire'));
    await multipart(`/admin/animaux/${animal.id}`, animalFields({ name: 'Statutaire', species: 'chat' }));
    assert.equal((await env.request().get(`/animaux/${animal.slug}`)).status, 200);
  });

  test('passer le statut à "adopte" renseigne adopted_at et place l’animal dans l’album', async () => {
    assert.equal(animals().getById(animal.id).adopted_at, null);
    const res = await send(`/admin/animaux/${animal.id}/statut`, { status: 'adopte' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, `/admin/animaux/${animal.id}`);
    const updated = animals().getById(animal.id);
    assert.equal(updated.status, 'adopte');
    assert.ok(updated.adopted_at, 'adopted_at not set');
    assert.ok((await env.request().get('/adoptes')).text.includes('Statutaire'));
    assert.ok(!(await env.request().get('/animaux')).text.includes('Statutaire'));
    assert.ok(decode((await agent.get(`/admin/animaux/${animal.id}`)).text).includes('rejoint l’album des adoptés'));
  });

  test('remettre le statut à "disponible" retire l’animal de l’album', async () => {
    await send(`/admin/animaux/${animal.id}/statut`, { status: 'disponible' });
    assert.equal(animals().getById(animal.id).status, 'disponible');
    assert.ok(!(await env.request().get('/adoptes')).text.includes('Statutaire'));
    assert.ok((await env.request().get('/animaux')).text.includes('Statutaire'));
  });

  test('le statut "reserve" est accepté et back=list renvoie vers la liste', async () => {
    const res = await send(`/admin/animaux/${animal.id}/statut`, { status: 'reserve', back: 'list' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/animaux');
    assert.equal(animals().getById(animal.id).status, 'reserve');
  });

  test('un statut inconnu est ignoré', async () => {
    await send(`/admin/animaux/${animal.id}/statut`, { status: 'vendu' });
    assert.equal(animals().getById(animal.id).status, 'reserve');
  });

  test('changer le statut d’une fiche inexistante répond 404', async () => {
    const res = await send('/admin/animaux/999999/statut', { status: 'adopte' });
    assert.equal(res.status, 404);
  });

  test('passer à "adopte" via le formulaire d’édition renseigne aussi adopted_at', async () => {
    const created = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Viaformulaire' }))));
    const res = await multipart(`/admin/animaux/${created.id}`, animalFields({ name: 'Viaformulaire', status: 'adopte' }));
    assert.equal(res.status, 303);
    const updated = animals().getById(created.id);
    assert.equal(updated.status, 'adopte');
    assert.ok(updated.adopted_at, 'adopted_at not set when status changes through the edit form');
  });

  test('une fiche créée directement avec le statut "adopte" a un adopted_at', async () => {
    const created = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Dejaadopte', status: 'adopte' }))));
    assert.ok(created.adopted_at, 'adopted_at not set on creation with status adopte');
  });

  test('la suppression retire la fiche du site et redirige vers la liste', async () => {
    const created = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Ephemere' }))));
    const res = await send(`/admin/animaux/${created.id}/supprimer`);
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/animaux');
    assert.equal((await env.request().get(`/animaux/${created.slug}`)).status, 404);
    assert.equal((await agent.get(`/admin/animaux/${created.id}`)).status, 404);
  });

  test('supprimer une fiche inexistante répond 404', async () => {
    assert.equal((await send('/admin/animaux/999999/supprimer')).status, 404);
  });

  test('la suppression d’une fiche liée à un message conserve le message', async () => {
    const created = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Lie' }))));
    const data = schemas.validate(schemas.messageSchema, { name: 'Lien Message', email: 'lien@example.fr', body: 'Pour Lie', consent: 'on', animal_id: String(created.id), topic: 'adoption' });
    await env.services.messageService.submit(data);
    assert.equal((await send(`/admin/animaux/${created.id}/supprimer`)).status, 303);
    const message = env.services.messageService.list('nouveau').find((item) => item.name === 'Lien Message');
    assert.ok(message);
    assert.equal(message.animal_id, null);
  });
});

describe('animaux : photos', () => {
  test('une photo JPEG valide est enregistrée, convertie et servie', async () => {
    const before = uploads().length;
    const res = await multipart('/admin/animaux', animalFields({ name: 'Photogenique' }), [{ field: 'photos', buffer: jpeg, filename: 'rex.jpg', contentType: 'image/jpeg' }]);
    assert.equal(res.status, 303);
    const animal = animals().getById(idFromLocation(res));
    assert.equal(animal.photos.length, 1);
    assert.equal(uploads().length, before + 2, 'expected full + thumb files');
    const page = await env.request().get(`/animaux/${animal.slug}`);
    assert.ok(page.text.includes(animal.photos[0].url));
    const image = await env.request().get(animal.photos[0].url);
    assert.equal(image.status, 200);
    assert.match(image.headers['content-type'], /image\/webp/);
  });

  test('un fichier non image déguisé en JPEG est refusé (422) sans créer de fiche', async () => {
    const before = animals().listAdmin({}).length;
    const res = await multipart('/admin/animaux', animalFields({ name: 'Fauxjpeg' }), [{ field: 'photos', buffer: Buffer.from('ceci n’est pas une image'), filename: 'faux.jpg', contentType: 'image/jpeg' }]);
    assert.equal(res.status, 422);
    assert.ok(decode(res.text).includes('pas une image lisible'));
    assert.equal(animals().listAdmin({}).length, before, 'animal row created despite invalid photo');
  });

  test('un fichier avec un type MIME non image est refusé (422) sans créer de fiche', async () => {
    const before = animals().listAdmin({}).length;
    const res = await multipart('/admin/animaux', animalFields({ name: 'Textfile' }), [{ field: 'photos', buffer: Buffer.from('hello'), filename: 'note.txt', contentType: 'text/plain' }]);
    assert.equal(res.status, 422);
    assert.equal(animals().listAdmin({}).length, before);
  });

  test('un fichier non image réaffiche le formulaire avec "Seules les images sont acceptées." et les valeurs saisies', async () => {
    const res = await multipart('/admin/animaux', animalFields({ name: 'Textfile', tagline: 'Accroche a garder' }), [{ field: 'photos', buffer: Buffer.from('hello'), filename: 'note.txt', contentType: 'text/plain' }]);
    assert.equal(res.status, 422);
    assert.ok(decode(res.text).includes('Seules les images sont acceptées'));
    assert.ok(decode(res.text).includes('Accroche a garder'));
  });

  test('un SVG (image/svg+xml) n’est pas accepté comme photo', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    const res = await multipart('/admin/animaux', animalFields({ name: 'Svgfile' }), [{ field: 'photos', buffer: svg, filename: 'x.svg', contentType: 'image/svg+xml' }]);
    assert.equal(res.status, 422);
  });

  test('ajouter une photo à une fiche existante, changer la couverture puis supprimer une photo', async () => {
    const created = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Album' }), [{ field: 'photos', buffer: jpeg, filename: 'a.jpg', contentType: 'image/jpeg' }])));
    const second = await jpegBuffer(80, 60);
    const res = await multipart(`/admin/animaux/${created.id}`, animalFields({ name: 'Album' }), [{ field: 'photos', buffer: second, filename: 'b.jpg', contentType: 'image/jpeg' }]);
    assert.equal(res.status, 303);
    const withTwo = animals().getById(created.id);
    assert.equal(withTwo.photos.length, 2);
    const [first, other] = withTwo.photos;

    const cover = await send(`/admin/animaux/${created.id}/photos/${other.id}/couverture`);
    assert.equal(cover.status, 303);
    assert.equal(animals().getById(created.id).photos[0].id, other.id);

    const files = uploads();
    const remove = await send(`/admin/animaux/${created.id}/photos/${first.id}/supprimer`);
    assert.equal(remove.status, 303);
    const after = animals().getById(created.id);
    assert.deepEqual(after.photos.map((photo) => photo.id), [other.id]);
    assert.equal(uploads().length, files.length - 2, 'photo files not removed from disk');
  });

  test('une photo invalide lors d’une mise à jour est refusée (422) et ne modifie pas la fiche', async () => {
    const created = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Intacte' }))));
    const res = await multipart(`/admin/animaux/${created.id}`, animalFields({ name: 'Intacte modifiee' }), [{ field: 'photos', buffer: Buffer.from('garbage'), filename: 'x.jpg', contentType: 'image/jpeg' }]);
    assert.equal(res.status, 422);
    assert.equal(animals().getById(created.id).name, 'Intacte');
  });

  test('ajouter une photo à une fiche inexistante répond 404 sans laisser de fichier', async () => {
    const before = uploads().length;
    const res = await multipart('/admin/animaux/999999', animalFields({ name: 'Nulle part' }), [{ field: 'photos', buffer: jpeg, filename: 'a.jpg', contentType: 'image/jpeg' }]);
    assert.equal(res.status, 404);
    assert.equal(uploads().length, before);
  });

  test('on ne peut pas supprimer la photo d’un autre animal via l’URL d’une autre fiche', async () => {
    const owner = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Proprietaire' }), [{ field: 'photos', buffer: jpeg, filename: 'p.jpg', contentType: 'image/jpeg' }])));
    const other = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Voisin' }))));
    const photoId = owner.photos[0].id;
    await send(`/admin/animaux/${other.id}/photos/${photoId}/supprimer`);
    assert.equal(animals().getById(owner.id).photos.length, 1, 'photo of another animal was deleted');
  });

  test('on ne peut pas déplacer la photo d’un autre animal comme couverture d’une autre fiche', async () => {
    const owner = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Proprio2' }), [{ field: 'photos', buffer: jpeg, filename: 'p.jpg', contentType: 'image/jpeg' }])));
    const other = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Voisin2' }))));
    await send(`/admin/animaux/${other.id}/photos/${owner.photos[0].id}/couverture`);
    assert.equal(animals().getById(owner.id).photos.length, 1);
    assert.equal(animals().getById(other.id).photos.length, 0);
  });

  test('supprimer une fiche supprime aussi ses fichiers photo', async () => {
    const created = animals().getById(idFromLocation(await multipart('/admin/animaux', animalFields({ name: 'Avecphoto' }), [{ field: 'photos', buffer: jpeg, filename: 'a.jpg', contentType: 'image/jpeg' }])));
    const base = path.basename(created.photos[0].url, '.webp');
    assert.ok(uploads().includes(`${base}.webp`));
    await send(`/admin/animaux/${created.id}/supprimer`);
    assert.ok(!uploads().includes(`${base}.webp`), 'full-size file left on disk');
    assert.ok(!uploads().includes(`${base}-thumb.webp`), 'thumbnail left on disk');
  });
});

describe('agenda : événements', () => {
  const day = (offset) => wallClockInDays(env.format, offset).slice(0, 10);
  const eventsNamed = (title) => env.services.eventService.upcoming(200, { publicOnly: false }).filter((event) => event.title === title);

  test('crée un événement public visible sur l’agenda public', async () => {
    const res = await send('/admin/agenda', { title: 'Kermesse admin', category: 'kermesse', start_date: day(20), start_time: '10:00', end_time: '18:00', location: 'Refuge', visibility: 'public' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, `/admin/agenda?mois=${day(20).slice(0, 7)}`);
    const [event] = eventsNamed('Kermesse admin');
    assert.equal(event.starts_at, `${day(20)}T10:00`);
    assert.equal(event.ends_at, `${day(20)}T18:00`);
    assert.equal((await env.request().get(`/agenda/${event.id}`)).status, 200);
    assert.ok((await env.request().get(`/agenda?mois=${day(20).slice(0, 7)}`)).text.includes('Kermesse admin'));
  });

  test('un événement interne est visible dans l’agenda admin mais pas publiquement', async () => {
    await send('/admin/agenda', { title: 'Soiree interne', category: 'benevoles', start_date: day(21), start_time: '19:00', visibility: 'interne' });
    const [event] = eventsNamed('Soiree interne');
    assert.equal(event.visibility, 'interne');
    assert.ok((await agent.get(`/admin/agenda?mois=${day(21).slice(0, 7)}`)).text.includes('Soiree interne'));
    assert.equal((await env.request().get(`/agenda/${event.id}`)).status, 404);
    assert.equal((await env.request().get(`/agenda/${event.id}.ics`)).status, 404);
    assert.ok(!(await env.request().get(`/agenda?mois=${day(21).slice(0, 7)}`)).text.includes('Soiree interne'));
    assert.ok(!(await env.request().get('/agenda.ics')).text.includes('Soiree interne'));
  });

  test('un événement sur la journée entière s’affiche "Toute la journée"', async () => {
    await send('/admin/agenda', { title: 'Fermeture exceptionnelle', category: 'fermeture', start_date: day(22), all_day: 'on', visibility: 'public' });
    const [event] = eventsNamed('Fermeture exceptionnelle');
    assert.equal(event.all_day, 1);
    assert.ok((await env.request().get(`/agenda/${event.id}`)).text.includes('Toute la journée'));
  });

  test('passer un événement public en interne le retire du site', async () => {
    await send('/admin/agenda', { title: 'Bientot interne', category: 'autre', start_date: day(23), start_time: '14:00', visibility: 'public' });
    const [event] = eventsNamed('Bientot interne');
    assert.equal((await env.request().get(`/agenda/${event.id}`)).status, 200);
    const res = await send(`/admin/agenda/${event.id}`, { title: 'Bientot interne', category: 'autre', start_date: day(23), start_time: '14:00', visibility: 'interne' });
    assert.equal(res.status, 303);
    assert.equal((await env.request().get(`/agenda/${event.id}`)).status, 404);
  });

  test('le formulaire d’édition se pré-remplit avec les valeurs de l’événement', async () => {
    const [event] = eventsNamed('Kermesse admin');
    const res = await agent.get(`/admin/agenda/${event.id}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('Kermesse admin'));
    assert.ok(res.text.includes(day(20)));
  });

  const invalid = [
    ['titre manquant', { title: '' }, 'Donnez un titre'],
    ['date manquante', { start_date: '' }, 'Choisissez une date'],
    ['date mal formée', { start_date: '25/12/2030' }, 'Choisissez une date'],
    ['heure invalide', { start_time: '9h' }, 'Heure invalide'],
    ['fin avant le début (même jour)', { start_time: '15:00', end_time: '10:00' }, 'La fin doit être après le début'],
    ['fin avant le début (jours différents)', { end_date: '2030-01-01' }, 'La fin doit être après le début'],
  ];
  for (const [label, override, message] of invalid) {
    test(`refuse un événement avec ${label} (422)`, async () => {
      const res = await send('/admin/agenda', { title: 'Invalide', category: 'autre', start_date: '2030-03-10', start_time: '10:00', visibility: 'public', ...override });
      assert.equal(res.status, 422);
      assert.ok(decode(res.text).includes(message), `missing "${message}"`);
      assert.equal(eventsNamed('Invalide').length, 0);
    });
  }

  test('une visibilité inconnue est refusée (422)', async () => {
    const res = await send('/admin/agenda', { title: 'Visibilite bizarre', start_date: day(24), visibility: 'secret' });
    assert.equal(res.status, 422);
  });

  test('supprimer un événement le retire du site', async () => {
    await send('/admin/agenda', { title: 'A supprimer', category: 'autre', start_date: day(25), start_time: '10:00', visibility: 'public' });
    const [event] = eventsNamed('A supprimer');
    const res = await send(`/admin/agenda/${event.id}/supprimer`);
    assert.equal(res.status, 303);
    assert.equal((await env.request().get(`/agenda/${event.id}`)).status, 404);
    assert.equal((await agent.get(`/admin/agenda/${event.id}`)).status, 404);
  });

  test('un événement inexistant répond 404 en édition, mise à jour et suppression', async () => {
    assert.equal((await agent.get('/admin/agenda/999999')).status, 404);
    assert.equal((await send('/admin/agenda/999999', { title: 'X', start_date: '2030-01-01' })).status, 404);
    assert.equal((await send('/admin/agenda/999999/supprimer')).status, 404);
  });

  test('l’agenda admin accepte un mois invalide sans erreur', async () => {
    assert.equal((await agent.get('/admin/agenda?mois=2030-99')).status, 200);
  });
});

describe('actualités : publication et programmation', () => {
  const postFields = (overrides = {}) => ({ title: 'Article', category: 'vie', excerpt: '', body: 'Corps de l’article', published: 'on', published_at: wallClockInDays(env.format, -1), ...overrides });
  const postByTitle = (title) => env.services.postService.listAdmin().find((post) => post.title === title);

  test('un article publié avec une date passée est visible immédiatement', async () => {
    const res = await multipart('/admin/actualites', postFields({ title: 'Publie maintenant', body: 'Bonne nouvelle' }));
    assert.equal(res.status, 303);
    assert.match(res.headers.location, /^\/admin\/actualites\/\d+$/);
    const post = postByTitle('Publie maintenant');
    const page = await env.request().get(`/actualites/${post.slug}`);
    assert.equal(page.status, 200);
    assert.ok(page.text.includes('Bonne nouvelle'));
  });

  test('un article programmé dans le futur est 404 tant que la date n’est pas atteinte', async () => {
    await multipart('/admin/actualites', postFields({ title: 'Programme', published_at: wallClockInDays(env.format, 2) }));
    const post = postByTitle('Programme');
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 404);
    assert.ok(!(await env.request().get('/actualites')).text.includes('Programme'));
    const res = await multipart(`/admin/actualites/${post.id}`, postFields({ title: 'Programme', published_at: wallClockInDays(env.format, -1) }));
    assert.equal(res.status, 303);
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 200);
  });

  test('un article programmé dans quelques minutes n’est pas encore visible (heure de Paris)', async () => {
    const soon = env.format.nowWallClock(new Date(Date.now() + 5 * 60 * 1000));
    await multipart('/admin/actualites', postFields({ title: 'Dans cinq minutes', published_at: soon }));
    const post = postByTitle('Dans cinq minutes');
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 404);
  });

  test('un article publié il y a une minute (heure de Paris) est visible', async () => {
    const justNow = env.format.nowWallClock(new Date(Date.now() - 60 * 1000));
    await multipart('/admin/actualites', postFields({ title: 'Il y a une minute', published_at: justNow }));
    const post = postByTitle('Il y a une minute');
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 200);
  });

  test('un brouillon est 404 publiquement, puis visible une fois publié', async () => {
    const fields = postFields({ title: 'Brouillon admin' });
    delete fields.published;
    await multipart('/admin/actualites', fields);
    const post = postByTitle('Brouillon admin');
    assert.equal(post.published, 0);
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 404);
    await multipart(`/admin/actualites/${post.id}`, postFields({ title: 'Brouillon admin' }));
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 200);
  });

  test('dépublier un article le rend introuvable', async () => {
    await multipart('/admin/actualites', postFields({ title: 'A depublier' }));
    const post = postByTitle('A depublier');
    const fields = postFields({ title: 'A depublier' });
    delete fields.published;
    await multipart(`/admin/actualites/${post.id}`, fields);
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 404);
  });

  const invalid = [
    ['titre manquant', { title: '' }, 'Donnez un titre'],
    ['contenu manquant', { body: '   ' }, 'Écrivez le contenu de l’article'],
    ['date de publication mal formée', { published_at: '2026-10-06 10:00' }, 'Date et heure invalides'],
    ['date de publication absente', { published_at: '' }, 'Date et heure invalides'],
  ];
  for (const [label, override, message] of invalid) {
    test(`refuse un article avec ${label} (422)`, async () => {
      const before = env.services.postService.listAdmin().length;
      const res = await multipart('/admin/actualites', postFields({ title: 'Invalide', ...override }));
      assert.equal(res.status, 422);
      assert.ok(decode(res.text).includes(message), `missing "${message}"`);
      assert.equal(env.services.postService.listAdmin().length, before);
    });
  }

  test('deux articles de même titre ont des slugs distincts', async () => {
    await multipart('/admin/actualites', postFields({ title: 'Titre double' }));
    await multipart('/admin/actualites', postFields({ title: 'Titre double' }));
    const slugs = env.services.postService.listAdmin().filter((post) => post.title === 'Titre double').map((post) => post.slug);
    assert.equal(new Set(slugs).size, 2);
  });

  test('le contenu d’un article est échappé', async () => {
    await multipart('/admin/actualites', postFields({ title: 'Article XSS', body: '<script>alert(1)</script>' }));
    const page = await env.request().get(`/actualites/${postByTitle('Article XSS').slug}`);
    assert.ok(!page.text.includes('<script>alert(1)</script>'));
    assert.ok(page.text.includes('&lt;script&gt;'));
  });

  test('une image de couverture valide est enregistrée puis peut être retirée', async () => {
    const res = await multipart('/admin/actualites', postFields({ title: 'Avec couverture' }), [{ field: 'cover', buffer: jpeg, filename: 'c.jpg', contentType: 'image/jpeg' }]);
    assert.equal(res.status, 303);
    const post = env.services.postService.getById(idFromLocation(res));
    assert.ok(post.cover, 'cover not saved');
    assert.ok(uploads().includes(`${post.cover}.webp`));
    const page = await env.request().get(`/actualites/${post.slug}`);
    assert.ok(page.text.includes(`/uploads/${post.cover}`));
    await multipart(`/admin/actualites/${post.id}`, postFields({ title: 'Avec couverture', remove_cover: 'on' }));
    assert.equal(env.services.postService.getById(post.id).cover, null);
    assert.ok(!uploads().includes(`${post.cover}.webp`), 'cover file left on disk');
  });

  test('une couverture non image est refusée (422)', async () => {
    const before = env.services.postService.listAdmin().length;
    const res = await multipart('/admin/actualites', postFields({ title: 'Couverture invalide' }), [{ field: 'cover', buffer: Buffer.from('nope'), filename: 'c.jpg', contentType: 'image/jpeg' }]);
    assert.equal(res.status, 422);
    assert.equal(env.services.postService.listAdmin().length, before);
  });

  test('supprimer un article le rend introuvable', async () => {
    await multipart('/admin/actualites', postFields({ title: 'Article a supprimer' }));
    const post = postByTitle('Article a supprimer');
    const res = await send(`/admin/actualites/${post.id}/supprimer`);
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/actualites');
    assert.equal((await env.request().get(`/actualites/${post.slug}`)).status, 404);
  });

  test('un article inexistant répond 404', async () => {
    assert.equal((await agent.get('/admin/actualites/999999')).status, 404);
    assert.equal((await send('/admin/actualites/999999/supprimer')).status, 404);
    assert.equal((await multipart('/admin/actualites/999999', postFields({ title: 'Fantome' }))).status, 404);
  });
});

describe('réglages', () => {
  test('activer le bandeau l’affiche sur les pages publiques, texte échappé', async () => {
    const res = await send('/admin/reglages/banner', { enabled: 'on', text: 'Refuge fermé le 25 <b>décembre</b>' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/reglages?onglet=banner');
    for (const url of ['/', '/animaux', '/contact']) {
      const page = await env.request().get(url);
      assert.ok(page.text.includes('class="banner"'), `banner missing on ${url}`);
      assert.ok(page.text.includes('Refuge fermé le 25 &lt;b&gt;décembre&lt;/b&gt;'), `banner text missing/unescaped on ${url}`);
    }
  });

  test('désactiver le bandeau le masque', async () => {
    await send('/admin/reglages/banner', { text: 'Texte conservé' });
    const page = await env.request().get('/');
    assert.ok(!page.text.includes('class="banner"'));
    assert.ok(!page.text.includes('Texte conservé'));
  });

  test('un bandeau activé mais vide n’est pas affiché', async () => {
    await send('/admin/reglages/banner', { enabled: 'on', text: '   ' });
    assert.ok(!(await env.request().get('/')).text.includes('class="banner"'));
  });

  const shelter = (overrides = {}) => ({
    name: 'Refuge Animalier du Pays de Landerneau',
    shortName: 'Refuge de Landerneau',
    address: '8, rue Saint Ernel',
    postcode: '29800',
    city: 'Landerneau',
    phone: '02 98 00 00 01',
    email: 'contact@refuge.test',
    hours: 'Tous les jours',
    facebook: '',
    donationUrl: '',
    intro: 'Intro',
    ...overrides,
  });

  test('les coordonnées du refuge mises à jour apparaissent sur le site', async () => {
    const res = await send('/admin/reglages/shelter', shelter({ phone: '02 98 99 88 77', email: 'nouveau@refuge.test' }));
    assert.equal(res.status, 303);
    const page = await env.request().get('/contact');
    assert.ok(page.text.includes('02 98 99 88 77'));
    assert.ok(page.text.includes('nouveau@refuge.test'));
  });

  test('un email du refuge invalide est refusé (422) et rien ne change', async () => {
    const res = await send('/admin/reglages/shelter', shelter({ email: 'pas-un-email', phone: '00 00 00 00 00' }));
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Adresse email invalide'));
    assert.ok(!(await env.request().get('/contact')).text.includes('00 00 00 00 00'));
  });

  test('un nom de refuge vide est refusé (422)', async () => {
    const res = await send('/admin/reglages/shelter', shelter({ name: '  ' }));
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Le nom est obligatoire'));
  });

  test('une adresse Facebook non web est refusée (422)', async () => {
    const res = await send('/admin/reglages/shelter', shelter({ facebook: 'pas une url' }));
    assert.equal(res.status, 422);
  });

  test('un lien javascript: est refusé pour Facebook et le lien de don (pas d’injection dans href)', async () => {
    const res = await send('/admin/reglages/shelter', shelter({ facebook: 'javascript:alert(document.cookie)', donationUrl: 'javascript:alert(1)' }));
    assert.equal(res.status, 422);
    const page = await env.request().get('/aider');
    assert.ok(!page.text.includes('href="javascript:'), 'javascript: URL rendered in a public href');
  });

  test('les tarifs mis à jour apparaissent sur la page Adopter', async () => {
    const res = await agent
      .post('/admin/reglages/fees')
      .type('form')
      .send(`_csrf=${encodeURIComponent(token)}&dogsIncluded=Tout+compris&catsIncluded=Idem&breedNote=&dogs_key=adulte&dogs_label=Chien+adulte+test&dogs_price=321+%E2%82%AC&dogs_note=&dogs_key=jeune&dogs_label=Chiot+test&dogs_price=123+%E2%82%AC&dogs_note=Note+chiot&cats_key=adulte&cats_label=Chat+adulte+test&cats_price=99+%E2%82%AC&cats_note=`);
    assert.equal(res.status, 303);
    const page = decode((await env.request().get('/adopter')).text);
    assert.ok(page.includes('Chien adulte test'));
    assert.ok(page.includes('321'));
    assert.ok(page.includes('Chiot test'));
    assert.ok(page.includes('Note chiot'));
    assert.ok(page.includes('Chat adulte test'));
  });

  test('le texte "Aider" mis à jour apparaît sur la page Aider', async () => {
    const res = await send('/admin/reglages/help', { membership: 'Adhésion test 15 euros', donation: 'Don test', volunteering: 'Bénévolat test', extras: '', inKindAnimals: 'Croquettes test\nLaisses test', inKindShelter: 'Bureau test' });
    assert.equal(res.status, 303);
    const page = decode((await env.request().get('/aider')).text);
    assert.ok(page.includes('Adhésion test 15 euros'));
    assert.ok(page.includes('Croquettes test'));
    assert.ok(page.includes('Laisses test'));
  });

  test('une section de réglages inconnue répond 404', async () => {
    assert.equal((await send('/admin/reglages/inconnue', { x: 'y' })).status, 404);
  });

  test('un onglet inconnu affiche la section par défaut', async () => {
    assert.equal((await agent.get('/admin/reglages?onglet=nimporte')).status, 200);
  });

  test('les réglages sans jeton CSRF sont refusés (403)', async () => {
    const res = await agent.post('/admin/reglages/banner').type('form').send({ enabled: 'on', text: 'Sans CSRF' });
    assert.equal(res.status, 403);
    assert.ok(!(await env.request().get('/')).text.includes('Sans CSRF'));
  });
});

describe('messages', () => {
  const submit = async (fields) => {
    const data = schemas.validate(schemas.messageSchema, { topic: 'adoption', email: 'visiteur@example.fr', consent: 'on', body: 'Bonjour', ...fields });
    await env.services.messageService.submit(data);
    return env.services.messageService.list('nouveau').find((message) => message.name === fields.name);
  };
  const statusOf = (id) => env.services.messageService.getById(id).status;

  test('un message reçu apparaît dans la boîte "nouveau" et s’affiche échappé', async () => {
    const message = await submit({ name: 'Visiteur Un', body: '<script>alert(1)</script>Je veux adopter' });
    const list = await agent.get('/admin/messages');
    assert.equal(list.status, 200);
    assert.ok(list.text.includes('Visiteur Un'));
    const show = await agent.get(`/admin/messages/${message.id}`);
    assert.equal(show.status, 200);
    assert.ok(!show.text.includes('<script>alert(1)</script>'));
    assert.ok(show.text.includes('&lt;script&gt;'));
  });

  test('un message envoyé par le formulaire public arrive dans la boîte', async () => {
    const visitor = env.newAgent();
    const html = (await visitor.get('/contact')).text;
    const csrf = /name="_csrf" value="([^"]+)"/.exec(html)[1];
    await visitor.post('/contact').type('form').send({ _csrf: csrf, name: 'Depuis Formulaire', email: 'form@example.fr', body: 'Coucou', consent: 'on', topic: 'benevolat' });
    assert.ok((await agent.get('/admin/messages')).text.includes('Depuis Formulaire'));
  });

  test('marquer un message comme traité le déplace dans "traite"', async () => {
    const message = await submit({ name: 'Visiteur Traite' });
    const res = await send(`/admin/messages/${message.id}/statut`, { status: 'traite' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/messages');
    assert.equal(statusOf(message.id), 'traite');
    assert.ok(!(await agent.get('/admin/messages')).text.includes('Visiteur Traite'));
    assert.ok((await agent.get('/admin/messages?statut=traite')).text.includes('Visiteur Traite'));
  });

  test('archiver puis remettre un message dans les nouveaux', async () => {
    const message = await submit({ name: 'Visiteur Archive' });
    await send(`/admin/messages/${message.id}/statut`, { status: 'archive' });
    assert.equal(statusOf(message.id), 'archive');
    assert.ok((await agent.get('/admin/messages?statut=archive')).text.includes('Visiteur Archive'));
    const res = await send(`/admin/messages/${message.id}/statut`, { status: 'nouveau' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, `/admin/messages/${message.id}`);
    assert.equal(statusOf(message.id), 'nouveau');
  });

  test('un statut de message inconnu est refusé (422) et le statut ne change pas', async () => {
    const message = await submit({ name: 'Visiteur Invalide' });
    const res = await send(`/admin/messages/${message.id}/statut`, { status: 'supprime' });
    assert.equal(res.status, 422);
    assert.equal(statusOf(message.id), 'nouveau');
  });

  test('supprimer un message le rend introuvable', async () => {
    const message = await submit({ name: 'Visiteur Supprime' });
    const res = await send(`/admin/messages/${message.id}/supprimer`);
    assert.equal(res.status, 303);
    assert.equal((await agent.get(`/admin/messages/${message.id}`)).status, 404);
  });

  test('un message inexistant répond 404 (lecture, statut, suppression)', async () => {
    assert.equal((await agent.get('/admin/messages/999999')).status, 404);
    assert.equal((await send('/admin/messages/999999/statut', { status: 'traite' })).status, 404);
    assert.equal((await send('/admin/messages/999999/supprimer')).status, 404);
  });

  test('un statut de filtre inconnu affiche les nouveaux messages', async () => {
    assert.equal((await agent.get('/admin/messages?statut=nimporte')).status, 200);
  });
});
