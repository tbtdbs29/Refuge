import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { csrfFrom, decode, setupTestEnv, wallClockInDays } from './helpers.js';

let env;
let validate;
let schemas;
const ids = {};

async function makeAnimal(fields) {
  const data = validate(schemas.animalSchema, { published: 'on', ...fields });
  const id = await env.services.animalService.create(data, []);
  return env.services.animalService.getById(id);
}

function makeEvent(fields) {
  const data = validate(schemas.eventSchema, { category: 'adoption', ...fields });
  return env.services.eventService.create(data);
}

async function makePost(fields) {
  const data = validate(schemas.postSchema, { category: 'vie', excerpt: '', published: 'on', ...fields });
  const id = await env.services.postService.create(data, undefined);
  return env.services.postService.getById(id);
}

const messages = () => env.services.messageService.list('nouveau');

before(async () => {
  env = await setupTestEnv('public');
  schemas = await import('../src/schemas/index.js');
  validate = schemas.validate;

  ids.rex = await makeAnimal({ name: 'Rex', species: 'chien', sex: 'male', ok_kids: 'oui', ok_cats: 'non', ok_dogs: 'oui', tagline: 'Le roi des balades' });
  ids.bella = await makeAnimal({ name: 'Bella', species: 'chien', sex: 'femelle', ok_kids: 'non', ok_cats: 'oui', ok_dogs: 'non' });
  ids.minou = await makeAnimal({ name: 'Minou', species: 'chat', sex: 'male', ok_kids: 'a_tester', ok_cats: 'oui', ok_dogs: 'a_tester' });
  ids.panpan = await makeAnimal({ name: 'Panpan', species: 'nac', sex: 'femelle' });
  ids.biquette = await makeAnimal({ name: 'Biquette', species: 'ferme', sex: 'femelle' });
  ids.cache = await makeAnimal({ name: 'Fantome', species: 'chien', published: '' });
  ids.adopte = await makeAnimal({ name: 'Heureux', species: 'chat', status: 'adopte' });
  ids.adopteCache = await makeAnimal({ name: 'Secretadopte', species: 'chat', status: 'adopte', published: '' });
  ids.xss = await makeAnimal({ name: '<img src=x onerror=alert(1)>', species: 'chat', description: '<script>alert("pwn")</script>\n\n**Câlin**' });

  ids.publicEvent = makeEvent({ title: 'Journee adoption publique', start_date: wallClockInDays(env.format, 10).slice(0, 10), start_time: '10:00', end_time: '17:00', visibility: 'public' });
  ids.internalEvent = makeEvent({ title: 'Reunion secrete benevoles', start_date: wallClockInDays(env.format, 10).slice(0, 10), start_time: '19:00', visibility: 'interne', category: 'benevoles' });

  ids.livePost = await makePost({ title: 'Article publie', body: 'Contenu publie', published_at: wallClockInDays(env.format, -2) });
  ids.futurePost = await makePost({ title: 'Article programme', body: 'Contenu futur', published_at: wallClockInDays(env.format, 3) });
  ids.draftPost = await makePost({ title: 'Article brouillon', body: 'Contenu brouillon', published: '', published_at: wallClockInDays(env.format, -1) });
});

after(() => env.cleanup());

describe('pages publiques', () => {
  for (const url of ['/', '/animaux', '/adoptes', '/adopter', '/aider', '/agenda', '/actualites', '/contact', '/mentions-legales']) {
    test(`GET ${url} répond 200 en HTML`, async () => {
      const res = await env.request().get(url);
      assert.equal(res.status, 200);
      assert.match(res.headers['content-type'], /text\/html/);
      assert.ok(decode(res.text).includes('Refuge'), 'shelter name missing');
    });
  }

  test('une URL inconnue répond 404 avec une page en français', async () => {
    const res = await env.request().get('/cette-page-nexiste-pas');
    assert.equal(res.status, 404);
    assert.ok(res.text.includes('Page introuvable'));
  });

  test('les en-têtes de sécurité sont présents et X-Powered-By est masqué', async () => {
    const res = await env.request().get('/');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.ok(res.headers['content-security-policy']);
    assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/);
  });

  test('le cookie de session est HttpOnly', async () => {
    const res = await env.request().get('/contact');
    const cookie = (res.headers['set-cookie'] || []).find((value) => value.startsWith('refuge_session='));
    assert.ok(cookie, 'no session cookie');
    assert.match(cookie, /httponly/i);
  });

  test('robots.txt interdit /admin et référence le sitemap', async () => {
    const res = await env.request().get('/robots.txt');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/plain/);
    assert.ok(res.text.includes('Disallow: /admin'));
    assert.ok(res.text.includes('Sitemap: http://refuge.test/sitemap.xml'));
  });

  test('sitemap.xml liste les animaux publiés et les articles en ligne uniquement', async () => {
    const res = await env.request().get('/sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /xml/);
    assert.ok(res.text.includes(`http://refuge.test/animaux/${ids.rex.slug}`));
    assert.ok(!res.text.includes(`/animaux/${ids.cache.slug}`), 'unpublished animal in sitemap');
    assert.ok(res.text.includes(`/actualites/${ids.livePost.slug}`));
    assert.ok(!res.text.includes(`/actualites/${ids.futurePost.slug}`), 'scheduled post in sitemap');
    assert.ok(!res.text.includes(`/actualites/${ids.draftPost.slug}`), 'draft post in sitemap');
  });

  for (const [legacy, espece] of [['/chiens', 'chiens'], ['/chats', 'chats'], ['/nac', 'nac'], ['/ferme', 'ferme']]) {
    test(`l’ancienne URL ${legacy} redirige en 301 vers /animaux?espece=${espece}`, async () => {
      const res = await env.request().get(legacy);
      assert.equal(res.status, 301);
      assert.equal(res.headers.location, `/animaux?espece=${espece}`);
    });
  }
});

describe('liste des animaux et filtres', () => {
  const names = (html) => ['Rex', 'Bella', 'Minou', 'Panpan', 'Biquette'].filter((name) => html.includes(name));

  test('sans filtre, liste tous les animaux publiés à l’adoption', async () => {
    const res = await env.request().get('/animaux');
    assert.equal(res.status, 200);
    assert.deepEqual(names(res.text), ['Rex', 'Bella', 'Minou', 'Panpan', 'Biquette']);
  });

  test('espece=chats ne liste que les chats', async () => {
    const res = await env.request().get('/animaux?espece=chats');
    assert.deepEqual(names(res.text), ['Minou']);
  });

  test('espece=chiens ne liste que les chiens', async () => {
    const res = await env.request().get('/animaux?espece=chiens');
    assert.deepEqual(names(res.text), ['Rex', 'Bella']);
  });

  test('espece=nac et espece=ferme filtrent les NAC et animaux de ferme', async () => {
    assert.deepEqual(names((await env.request().get('/animaux?espece=nac')).text), ['Panpan']);
    assert.deepEqual(names((await env.request().get('/animaux?espece=ferme')).text), ['Biquette']);
  });

  test('sexe=femelle ne garde que les femelles', async () => {
    const res = await env.request().get('/animaux?sexe=femelle');
    assert.deepEqual(names(res.text), ['Bella', 'Panpan', 'Biquette']);
  });

  test('enfants=1 ne garde que les animaux compatibles avec les enfants', async () => {
    const res = await env.request().get('/animaux?enfants=1');
    const found = names(res.text);
    assert.ok(found.includes('Rex'));
    assert.ok(!found.includes('Bella'), 'ok_kids=non shown');
    assert.ok(!found.includes('Minou'), 'ok_kids=a_tester shown');
  });

  test('chats=1 ne garde que les animaux qui s’entendent avec les chats', async () => {
    const found = names((await env.request().get('/animaux?chats=1')).text);
    assert.ok(found.includes('Bella') && found.includes('Minou'));
    assert.ok(!found.includes('Rex'));
  });

  test('chiens=1 ne garde que les animaux qui s’entendent avec les chiens', async () => {
    const found = names((await env.request().get('/animaux?chiens=1')).text);
    assert.ok(found.includes('Rex'));
    assert.ok(!found.includes('Bella') && !found.includes('Minou'));
  });

  test('les filtres se combinent (chiens + femelle)', async () => {
    assert.deepEqual(names((await env.request().get('/animaux?espece=chiens&sexe=femelle')).text), ['Bella']);
  });

  test('une espèce inconnue est ignorée et ne provoque pas d’erreur', async () => {
    const res = await env.request().get('/animaux?espece=dragons');
    assert.equal(res.status, 200);
    assert.equal(names(res.text).length, 5);
  });

  test('des paramètres répétés (tableaux) ne provoquent pas d’erreur serveur', async () => {
    const res = await env.request().get('/animaux?espece=chats&espece=chiens&sexe=male&sexe=femelle&enfants=1&enfants=1');
    assert.equal(res.status, 200);
  });

  test('les animaux non publiés n’apparaissent pas dans la liste ni sur l’accueil', async () => {
    assert.ok(!(await env.request().get('/animaux')).text.includes('Fantome'));
    assert.ok(!(await env.request().get('/')).text.includes('Fantome'));
  });

  test('les animaux adoptés n’apparaissent pas dans la liste à l’adoption', async () => {
    assert.ok(!(await env.request().get('/animaux')).text.includes('Heureux'));
  });
});

describe('fiche animal', () => {
  test('la fiche d’un animal publié répond 200 avec son nom et son accroche', async () => {
    const res = await env.request().get(`/animaux/${ids.rex.slug}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('Rex'));
    assert.ok(res.text.includes('Le roi des balades'));
  });

  test('un slug inconnu répond 404', async () => {
    const res = await env.request().get('/animaux/personne-de-ce-nom');
    assert.equal(res.status, 404);
  });

  test('un animal non publié répond 404 pour un visiteur', async () => {
    const res = await env.request().get(`/animaux/${ids.cache.slug}`);
    assert.equal(res.status, 404);
    assert.ok(!res.text.includes('Fantome'));
  });

  test('un animal non publié n’apparaît pas dans les suggestions d’une autre fiche', async () => {
    const res = await env.request().get(`/animaux/${ids.rex.slug}`);
    assert.ok(!res.text.includes('Fantome'));
  });

  test('le nom et la description sont échappés (pas d’injection HTML)', async () => {
    const res = await env.request().get(`/animaux/${ids.xss.slug}`);
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes('<img src=x onerror=alert(1)>'), 'raw name injected');
    assert.ok(!res.text.includes('<script>alert("pwn")</script>'), 'raw script injected');
    assert.ok(res.text.includes('&lt;script&gt;'));
    assert.ok(res.text.includes('<strong>Câlin</strong>'));
  });

  test('le formulaire de contact pré-rempli avec ?animal= affiche l’animal', async () => {
    const res = await env.request().get(`/contact?animal=${ids.rex.slug}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes(`name="animal_id" value="${ids.rex.id}"`));
  });

  test('le formulaire de contact ne révèle pas un animal non publié via ?animal=', async () => {
    const res = await env.request().get(`/contact?animal=${ids.cache.slug}`);
    assert.equal(res.status, 200);
    assert.ok(!res.text.includes('Fantome'));
    assert.ok(!res.text.includes(`name="animal_id" value="${ids.cache.id}"`));
  });
});

describe('album des adoptés', () => {
  test('liste les animaux adoptés publiés', async () => {
    const res = await env.request().get('/adoptes');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('Heureux'));
    assert.ok(!res.text.includes('Rex'));
  });

  test('n’affiche pas un animal adopté non publié', async () => {
    const res = await env.request().get('/adoptes');
    assert.ok(!res.text.includes('Secretadopte'));
  });
});

describe('agenda', () => {
  const month = () => wallClockInDays(env.format, 10).slice(0, 7);

  test('la vue du mois affiche les événements publics mais pas les internes', async () => {
    const res = await env.request().get(`/agenda?mois=${month()}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('Journee adoption publique'));
    assert.ok(!res.text.includes('Reunion secrete benevoles'));
  });

  test('la page /agenda (mois courant + à venir) ne montre pas l’événement interne', async () => {
    const res = await env.request().get('/agenda');
    assert.ok(!res.text.includes('Reunion secrete benevoles'));
  });

  test('l’accueil ne montre pas l’événement interne', async () => {
    assert.ok(!(await env.request().get('/')).text.includes('Reunion secrete benevoles'));
  });

  test('un paramètre mois invalide retombe sur le mois courant', async () => {
    for (const mois of ['2026-13', 'abc', '99999-01', '']) {
      const res = await env.request().get(`/agenda?mois=${mois}`);
      assert.equal(res.status, 200, `mois=${mois}`);
    }
  });

  test('la fiche d’un événement public répond 200', async () => {
    const res = await env.request().get(`/agenda/${ids.publicEvent}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('Journee adoption publique'));
  });

  test('la fiche d’un événement interne répond 404', async () => {
    const res = await env.request().get(`/agenda/${ids.internalEvent}`);
    assert.equal(res.status, 404);
    assert.ok(!res.text.includes('Reunion secrete benevoles'));
  });

  test('un identifiant d’événement inconnu ou non numérique répond 404', async () => {
    assert.equal((await env.request().get('/agenda/999999')).status, 404);
    assert.equal((await env.request().get('/agenda/abc')).status, 404);
  });

  test('l’export .ics d’un événement public est un fichier calendrier', async () => {
    const res = await env.request().get(`/agenda/${ids.publicEvent}.ics`);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/calendar/);
    assert.match(res.headers['content-disposition'], /attachment/);
    assert.ok(res.text.includes('BEGIN:VEVENT'));
    assert.ok(res.text.includes('SUMMARY:Journee adoption publique'));
  });

  test('l’export .ics d’un événement interne répond 404', async () => {
    const res = await env.request().get(`/agenda/${ids.internalEvent}.ics`);
    assert.equal(res.status, 404);
    assert.ok(!res.text.includes('Reunion secrete'));
  });

  test('le flux agenda.ics contient les événements publics à venir et pas les internes', async () => {
    const res = await env.request().get('/agenda.ics');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/calendar/);
    assert.ok(res.text.includes('SUMMARY:Journee adoption publique'));
    assert.ok(!res.text.includes('Reunion secrete benevoles'));
  });
});

describe('actualités', () => {
  test('un article publié dans le passé est visible et listé', async () => {
    const res = await env.request().get(`/actualites/${ids.livePost.slug}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('Contenu publie'));
    assert.ok((await env.request().get('/actualites')).text.includes('Article publie'));
  });

  test('un article programmé dans le futur répond 404 et n’est listé nulle part', async () => {
    assert.equal((await env.request().get(`/actualites/${ids.futurePost.slug}`)).status, 404);
    assert.ok(!(await env.request().get('/actualites')).text.includes('Article programme'));
    assert.ok(!(await env.request().get('/')).text.includes('Article programme'));
  });

  test('un brouillon (non publié) répond 404 et n’est listé nulle part', async () => {
    assert.equal((await env.request().get(`/actualites/${ids.draftPost.slug}`)).status, 404);
    assert.ok(!(await env.request().get('/actualites')).text.includes('Article brouillon'));
    assert.ok(!(await env.request().get('/')).text.includes('Article brouillon'));
  });

  test('les suggestions sous un article ne contiennent ni brouillon ni article programmé', async () => {
    const res = await env.request().get(`/actualites/${ids.livePost.slug}`);
    assert.ok(!res.text.includes('Article programme'));
    assert.ok(!res.text.includes('Article brouillon'));
  });

  test('un slug inconnu répond 404', async () => {
    assert.equal((await env.request().get('/actualites/inconnu')).status, 404);
  });

  test('une pagination ou catégorie farfelue ne provoque pas d’erreur serveur', async () => {
    for (const query of ['page=abc', 'page=-3', 'page=0', 'page=99999', 'categorie=inexistante', 'page=1.5']) {
      const res = await env.request().get(`/actualites?${query}`);
      assert.equal(res.status, 200, query);
    }
  });
});

describe('formulaire de contact', () => {
  const valid = (overrides = {}) => ({
    topic: 'adoption',
    name: 'Jeanne Martin',
    email: 'jeanne@example.fr',
    phone: '06 12 34 56 78',
    home: 'Maison avec jardin clos',
    body: 'Bonjour, Rex m’intéresse beaucoup.',
    consent: 'on',
    ...overrides,
  });

  async function post(fields, { agent = env.newAgent(), token } = {}) {
    const csrf = token ?? (await csrfFrom(agent, '/contact'));
    return agent.post('/contact').type('form').send({ _csrf: csrf, ...fields });
  }

  test('le formulaire contient un jeton CSRF et le champ piège', async () => {
    const res = await env.request().get('/contact');
    assert.match(res.text, /name="_csrf" value="[^"]{20,}"/);
    assert.ok(res.text.includes('name="website"'));
  });

  test('un message valide est enregistré puis redirige vers la confirmation', async () => {
    const before = messages().length;
    const agent = env.newAgent();
    const res = await post(valid({ name: 'Jeanne Valide', animal_id: String(ids.rex.id) }), { agent });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/contact?envoye=1');
    const list = messages();
    assert.equal(list.length, before + 1);
    const saved = list.find((message) => message.name === 'Jeanne Valide');
    assert.equal(saved.email, 'jeanne@example.fr');
    assert.equal(saved.topic, 'adoption');
    assert.equal(saved.status, 'nouveau');
    assert.equal(saved.animal_id, ids.rex.id);
    const confirmation = await agent.get('/contact?envoye=1');
    assert.ok(confirmation.text.includes('Merci, votre message est bien parti'));
  });

  test('les espaces autour du nom et de l’email sont retirés', async () => {
    await post(valid({ name: '  Paul Espace  ', email: '  paul@example.fr ' }));
    const saved = messages().find((message) => message.name === 'Paul Espace');
    assert.ok(saved, 'name not trimmed');
    assert.equal(saved.email, 'paul@example.fr');
  });

  test('sans sujet, le message est classé "autre"', async () => {
    const fields = valid({ name: 'Sans Sujet' });
    delete fields.topic;
    const res = await post(fields);
    assert.equal(res.status, 303);
    assert.equal(messages().find((message) => message.name === 'Sans Sujet').topic, 'autre');
  });

  const invalidCases = [
    ['nom manquant', { name: '' }, 'Indiquez votre nom'],
    ['nom composé d’espaces', { name: '    ' }, 'Indiquez votre nom'],
    ['email invalide', { email: 'pas-un-email' }, 'Adresse email invalide'],
    ['email manquant', { email: '' }, 'Adresse email invalide'],
    ['message manquant', { body: '' }, 'Écrivez votre message'],
    ['consentement absent', { consent: '' }, 'Merci d’accepter que nous conservions votre message pour vous répondre'],
    ['téléphone avec lettres', { phone: 'appelez-moi' }, 'Numéro invalide'],
    ['nom trop long', { name: 'x'.repeat(81) }, '80 caractères maximum'],
  ];
  for (const [label, override, message] of invalidCases) {
    test(`refuse un message avec ${label} (422, message en français, rien n’est enregistré)`, async () => {
      const before = messages().length;
      const res = await post(valid({ name: 'Invalide', ...override }));
      assert.equal(res.status, 422);
      assert.ok(decode(res.text).includes(message), `missing "${message}"`);
      assert.equal(messages().length, before);
    });
  }

  test('refuse un sujet hors liste (422)', async () => {
    const before = messages().length;
    const res = await post(valid({ topic: 'piratage' }));
    assert.equal(res.status, 422);
    assert.equal(messages().length, before);
  });

  test('en cas d’erreur, les valeurs saisies sont réaffichées échappées', async () => {
    const res = await post(valid({ name: '<script>alert(1)</script>', consent: '' }));
    assert.equal(res.status, 422);
    assert.ok(!res.text.includes('<script>alert(1)</script>'));
    assert.ok(res.text.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  test('un champ envoyé en double (tableau) est refusé proprement en 422', async () => {
    const agent = env.newAgent();
    const csrf = await csrfFrom(agent, '/contact');
    const res = await agent.post('/contact').type('form').send(`_csrf=${encodeURIComponent(csrf)}&name=a&name=b&email=a%40b.fr&body=x&consent=on`);
    assert.equal(res.status, 422);
  });

  test('un animal_id inexistant ne provoque pas d’erreur serveur', async () => {
    const res = await post(valid({ name: 'Animal Fantome', animal_id: '987654' }));
    assert.ok(res.status < 500, `status ${res.status}`);
  });

  test('le champ piège rempli simule un succès sans rien enregistrer', async () => {
    const before = messages().length;
    const res = await post(valid({ name: 'Robot Spam', website: 'http://spam.example' }));
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/contact?envoye=1');
    assert.equal(messages().length, before);
    assert.ok(!messages().some((message) => message.name === 'Robot Spam'));
  });

  test('un envoi sans jeton CSRF est refusé (403) et rien n’est enregistré', async () => {
    const before = messages().length;
    const agent = env.newAgent();
    await agent.get('/contact');
    const res = await agent.post('/contact').type('form').send(valid());
    assert.equal(res.status, 403);
    assert.ok(decode(res.text).includes('Le formulaire a expiré'));
    assert.equal(messages().length, before);
  });

  test('un jeton CSRF erroné est refusé (403)', async () => {
    const res = await post(valid(), { token: 'jeton-totalement-faux-000000000000' });
    assert.equal(res.status, 403);
  });

  test('un jeton CSRF provenant d’une autre session est refusé (403)', async () => {
    const other = env.newAgent();
    const foreignToken = await csrfFrom(other, '/contact');
    const agent = env.newAgent();
    await agent.get('/contact');
    const res = await post(valid(), { agent, token: foreignToken });
    assert.equal(res.status, 403);
  });

  test('un POST sans cookie de session est refusé (403)', async () => {
    const token = await csrfFrom(env.newAgent(), '/contact');
    const res = await env.request().post('/contact').type('form').send({ _csrf: token, ...valid() });
    assert.equal(res.status, 403);
  });

  test('au-delà de 8 envois en 15 minutes depuis la même IP, la réponse est 429', async () => {
    const agent = env.newAgent();
    const statuses = [];
    for (let i = 0; i < 9; i += 1) {
      const res = await post(valid({ name: `Flood ${i}`, website: 'bot' }), { agent });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 8), Array(8).fill(303));
    assert.equal(statuses[8], 429);
  });
});

describe('bandeau d’information', () => {
  test('le bandeau est masqué par défaut', async () => {
    const res = await env.request().get('/');
    assert.ok(!res.text.includes('class="banner"'));
  });
});
