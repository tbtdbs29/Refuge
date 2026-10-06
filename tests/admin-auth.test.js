import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { ADMIN, EDITOR, csrfFrom, decode, login, setupTestEnv } from './helpers.js';

let env;
let users;
let adminId;
let editorId;

before(async () => {
  env = await setupTestEnv('auth');
  users = env.services.userService;
  adminId = await users.create(ADMIN);
  editorId = await users.create(EDITOR);
});

after(() => env.cleanup());

async function postLogin(agent, fields) {
  const token = await csrfFrom(agent, '/admin/connexion');
  return agent.post('/admin/connexion').type('form').send({ _csrf: token, ...fields });
}

describe('accès non authentifié', () => {
  test('GET /admin redirige vers la connexion avec la page demandée', async () => {
    const res = await env.request().get('/admin');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/admin/connexion?suite=%2Fadmin');
  });

  test('une page profonde conserve son URL complète (avec query) dans "suite"', async () => {
    const res = await env.request().get('/admin/animaux?statut=adopte');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, `/admin/connexion?suite=${encodeURIComponent('/admin/animaux?statut=adopte')}`);
  });

  for (const url of ['/admin/animaux/1', '/admin/agenda', '/admin/actualites', '/admin/messages', '/admin/reglages', '/admin/comptes', '/admin/mon-compte', '/admin/page-inconnue']) {
    test(`GET ${url} sans session redirige vers la connexion`, async () => {
      const res = await env.request().get(url);
      assert.equal(res.status, 302);
      assert.match(res.headers.location, /^\/admin\/connexion\?suite=/);
    });
  }

  test('un POST avec jeton CSRF valide mais sans être connecté redirige vers la connexion sans rien créer', async () => {
    const agent = env.newAgent();
    const token = await csrfFrom(agent, '/admin/connexion');
    const before = (await env.services.eventService.month(2030, 1, {})).events.length;
    const res = await agent.post('/admin/agenda').type('form').send({ _csrf: token, title: 'Intrus', start_date: '2030-01-10' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/admin/connexion?suite=%2Fadmin');
    assert.equal((await env.services.eventService.month(2030, 1, {})).events.length, before);
  });

  test('un cookie de session forgé (non signé) ne donne pas accès', async () => {
    const forged = Buffer.from(JSON.stringify({ userId: adminId, csrf: 'x' })).toString('base64');
    const res = await env.request().get('/admin').set('Cookie', `refuge_session=${forged}`);
    assert.equal(res.status, 302);
  });

  test('les pages admin sont non indexables et non mises en cache', async () => {
    const res = await env.request().get('/admin/connexion');
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['x-robots-tag'], 'noindex');
  });
});

describe('connexion', () => {
  test('le formulaire de connexion contient un jeton CSRF', async () => {
    const res = await env.request().get('/admin/connexion');
    assert.equal(res.status, 200);
    assert.match(res.text, /name="_csrf" value="[^"]{20,}"/);
  });

  test('des identifiants valides connectent et redirigent (303) vers /admin', async () => {
    const agent = env.newAgent();
    const res = await postLogin(agent, { email: ADMIN.email, password: ADMIN.password });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin');
    const dashboard = await agent.get('/admin');
    assert.equal(dashboard.status, 200);
    assert.ok(dashboard.text.includes(ADMIN.name));
  });

  test('un utilisateur déjà connecté qui ouvre /admin/connexion est renvoyé vers /admin', async () => {
    const agent = env.newAgent();
    await login(agent, ADMIN.email, ADMIN.password);
    const res = await agent.get('/admin/connexion');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/admin');
  });

  test('l’email est insensible à la casse et aux espaces', async () => {
    const res = await postLogin(env.newAgent(), { email: `  ${ADMIN.email.toUpperCase()} `, password: ADMIN.password });
    assert.equal(res.status, 303);
  });

  test('après connexion, la redirection suit le paramètre next interne', async () => {
    const res = await postLogin(env.newAgent(), { email: ADMIN.email, password: ADMIN.password, next: '/admin/animaux?statut=adopte' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/animaux?statut=adopte');
  });

  for (const next of ['https://evil.example/admin', '//evil.example/admin', '/administrateur', '/admin.evil.example', 'javascript:alert(1)', '/']) {
    test(`next="${next}" ne permet pas de redirection hors du back office`, async () => {
      const res = await postLogin(env.newAgent(), { email: ADMIN.email, password: ADMIN.password, next });
      assert.equal(res.status, 303);
      assert.equal(res.headers.location, '/admin');
    });
  }

  test('le paramètre suite externe n’est pas repris dans le formulaire', async () => {
    const res = await env.request().get('/admin/connexion?suite=https://evil.example');
    assert.ok(res.text.includes('name="next" value="/admin"'));
  });

  test('un mauvais mot de passe est refusé (422) avec un message générique', async () => {
    const agent = env.newAgent();
    const res = await postLogin(agent, { email: ADMIN.email, password: 'mauvais-mot-de-passe' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Email ou mot de passe incorrect.'));
    assert.equal((await agent.get('/admin')).status, 302);
  });

  test('un email inconnu donne exactement le même message (pas d’énumération)', async () => {
    const res = await postLogin(env.newAgent(), { email: 'inconnu@refuge.test', password: 'peu-importe-123' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Email ou mot de passe incorrect.'));
  });

  test('l’email saisi est réaffiché mais jamais le mot de passe', async () => {
    const res = await postLogin(env.newAgent(), { email: ADMIN.email, password: 'secret-tres-visible-42' });
    assert.ok(res.text.includes(ADMIN.email));
    assert.ok(!res.text.includes('secret-tres-visible-42'));
  });

  test('des champs vides donnent des messages en français', async () => {
    const res = await postLogin(env.newAgent(), { email: '', password: '' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Indiquez votre email'));
    assert.ok(res.text.includes('Indiquez votre mot de passe'));
  });

  test('une connexion sans jeton CSRF est refusée (403)', async () => {
    const agent = env.newAgent();
    await agent.get('/admin/connexion');
    const res = await agent.post('/admin/connexion').type('form').send({ email: ADMIN.email, password: ADMIN.password });
    assert.equal(res.status, 403);
    assert.equal((await agent.get('/admin')).status, 302);
  });

  test('le jeton CSRF obtenu avant la connexion n’est plus valable après', async () => {
    const agent = env.newAgent();
    const oldToken = await csrfFrom(agent, '/admin/connexion');
    await agent.post('/admin/connexion').type('form').send({ _csrf: oldToken, email: ADMIN.email, password: ADMIN.password });
    const res = await agent.post('/admin/deconnexion').type('form').send({ _csrf: oldToken });
    assert.equal(res.status, 403);
  });

  test('au-delà de 10 tentatives en 15 minutes depuis la même IP, la réponse est 429', async () => {
    const agent = env.newAgent();
    const token = await csrfFrom(agent, '/admin/connexion');
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await agent.post('/admin/connexion').type('form').send({ _csrf: token, email: ADMIN.email, password: `faux-${i}` });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(422));
    assert.equal(statuses[10], 429);
    assert.ok(decode((await agent.post('/admin/connexion').type('form').send({ _csrf: token, email: ADMIN.email, password: ADMIN.password })).text).includes('Trop de tentatives'));
  });
});

describe('déconnexion', () => {
  test('la déconnexion redirige vers la connexion et ferme la session', async () => {
    const agent = env.newAgent();
    const token = await login(agent, ADMIN.email, ADMIN.password);
    const res = await agent.post('/admin/deconnexion').type('form').send({ _csrf: token });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/connexion');
    assert.equal((await agent.get('/admin')).status, 302);
  });

  test('la déconnexion sans jeton CSRF est refusée (403) et la session reste ouverte', async () => {
    const agent = env.newAgent();
    await login(agent, ADMIN.email, ADMIN.password);
    const res = await agent.post('/admin/deconnexion').type('form').send({});
    assert.equal(res.status, 403);
    assert.equal((await agent.get('/admin')).status, 200);
  });
});

describe('rôles', () => {
  let editor;
  let editorToken;

  before(async () => {
    editor = env.newAgent();
    editorToken = await login(editor, EDITOR.email, EDITOR.password);
  });

  for (const url of ['/admin', '/admin/animaux', '/admin/animaux/nouveau', '/admin/agenda', '/admin/actualites', '/admin/messages', '/admin/reglages', '/admin/mon-compte']) {
    test(`un éditeur accède à ${url}`, async () => {
      assert.equal((await editor.get(url)).status, 200);
    });
  }

  for (const url of ['/admin/comptes', '/admin/comptes/nouveau']) {
    test(`un éditeur reçoit 403 sur ${url}`, async () => {
      const res = await editor.get(url);
      assert.equal(res.status, 403);
      assert.ok(res.text.includes('réservée aux administrateurs'));
    });
  }

  test('un éditeur reçoit 403 sur la fiche d’un compte', async () => {
    assert.equal((await editor.get(`/admin/comptes/${adminId}`)).status, 403);
  });

  test('un éditeur ne peut pas créer de compte (403, aucun compte créé)', async () => {
    const res = await editor.post('/admin/comptes').type('form').send({ _csrf: editorToken, name: 'Pirate', email: 'pirate@refuge.test', role: 'admin', password: 'pirate-password-1' });
    assert.equal(res.status, 403);
    assert.ok(!(await users.list()).some((user) => user.email === 'pirate@refuge.test'));
  });

  test('un éditeur ne peut pas se promouvoir administrateur (403)', async () => {
    const res = await editor.post(`/admin/comptes/${editorId}`).type('form').send({ _csrf: editorToken, name: EDITOR.name, email: EDITOR.email, role: 'admin', password: '' });
    assert.equal(res.status, 403);
    assert.equal((await users.getById(editorId)).role, 'editor');
  });

  test('un éditeur ne peut pas supprimer un compte (403)', async () => {
    const res = await editor.post(`/admin/comptes/${adminId}/supprimer`).type('form').send({ _csrf: editorToken });
    assert.equal(res.status, 403);
    assert.ok(await users.findById(adminId));
  });

  test('un administrateur accède à la gestion des comptes', async () => {
    const agent = env.newAgent();
    await login(agent, ADMIN.email, ADMIN.password);
    const res = await agent.get('/admin/comptes');
    assert.equal(res.status, 200);
    assert.ok(res.text.includes(EDITOR.email));
  });
});

describe('mon compte : changement de mot de passe', () => {
  const account = { name: 'Paula Password', email: 'paula@refuge.test', password: 'ancien-mot-de-passe', role: 'editor' };
  let agent;
  let token;

  before(async () => {
    await users.create(account);
    agent = env.newAgent();
    token = await login(agent, account.email, account.password);
  });

  const change = (fields) => agent.post('/admin/mon-compte').type('form').send({ _csrf: token, ...fields });

  test('un mot de passe actuel erroné est refusé (422)', async () => {
    const res = await change({ current: 'pas-le-bon', password: 'nouveau-mot-de-passe', confirm: 'nouveau-mot-de-passe' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Mot de passe actuel incorrect.'));
  });

  test('une confirmation différente est refusée (422)', async () => {
    const res = await change({ current: account.password, password: 'nouveau-mot-de-passe', confirm: 'autre-mot-de-passe' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Les deux mots de passe ne correspondent pas'));
  });

  test('un nouveau mot de passe de moins de 10 caractères est refusé (422)', async () => {
    const res = await change({ current: account.password, password: '123456789', confirm: '123456789' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('10 caractères minimum'));
  });

  test('un changement valide permet de se connecter avec le nouveau mot de passe seulement', async () => {
    const res = await change({ current: account.password, password: 'nouveau-mot-de-passe', confirm: 'nouveau-mot-de-passe' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/mon-compte');
    assert.equal((await postLogin(env.newAgent(), { email: account.email, password: account.password })).status, 422);
    assert.equal((await postLogin(env.newAgent(), { email: account.email, password: 'nouveau-mot-de-passe' })).status, 303);
  });
});

describe('gestion des comptes (administrateur)', () => {
  let agent;
  let token;

  before(async () => {
    agent = env.newAgent();
    token = await login(agent, ADMIN.email, ADMIN.password);
  });

  const send = (url, fields = {}) => agent.post(url).type('form').send({ _csrf: token, ...fields });

  test('crée un compte éditeur qui peut ensuite se connecter', async () => {
    const res = await send('/admin/comptes', { name: 'Nouvelle Benevole', email: 'nouvelle@refuge.test', role: 'editor', password: 'provisoire-123' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin/comptes');
    const created = (await users.list()).find((user) => user.email === 'nouvelle@refuge.test');
    assert.equal(created.role, 'editor');
    assert.equal((await postLogin(env.newAgent(), { email: 'nouvelle@refuge.test', password: 'provisoire-123' })).status, 303);
  });

  test('la liste des comptes n’expose pas les hash de mot de passe', async () => {
    const res = await agent.get('/admin/comptes');
    assert.ok(!res.text.includes('scrypt$'));
  });

  test('refuse un compte sans mot de passe provisoire (422)', async () => {
    const res = await send('/admin/comptes', { name: 'Sans Mdp', email: 'sansmdp@refuge.test', role: 'editor', password: '' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Choisissez un mot de passe provisoire'));
    assert.ok(!(await users.list()).some((user) => user.email === 'sansmdp@refuge.test'));
  });

  test('refuse un mot de passe trop court (422)', async () => {
    const res = await send('/admin/comptes', { name: 'Court', email: 'court@refuge.test', role: 'editor', password: 'court' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('10 caractères minimum'));
  });

  test('refuse un email déjà utilisé, même avec une casse différente (422)', async () => {
    const res = await send('/admin/comptes', { name: 'Doublon', email: EDITOR.email.toUpperCase(), role: 'editor', password: 'doublon-12345' });
    assert.equal(res.status, 422);
    assert.ok(res.text.includes('Un compte utilise déjà cet email.'));
  });

  test('refuse un email invalide et un rôle inconnu (422)', async () => {
    assert.equal((await send('/admin/comptes', { name: 'X', email: 'pas-un-email', role: 'editor', password: 'valide-12345' })).status, 422);
    const res = await send('/admin/comptes', { name: 'X', email: 'role@refuge.test', role: 'superadmin', password: 'valide-12345' });
    assert.equal(res.status, 422);
    assert.ok(!(await users.list()).some((user) => user.email === 'role@refuge.test'));
  });

  test('modifier un compte sans mot de passe conserve l’ancien', async () => {
    const id = await users.create({ name: 'Garde Mdp', email: 'garde@refuge.test', password: 'garde-password-1', role: 'editor' });
    const res = await send(`/admin/comptes/${id}`, { name: 'Garde Renomme', email: 'garde@refuge.test', role: 'editor', password: '' });
    assert.equal(res.status, 303);
    assert.equal((await users.getById(id)).name, 'Garde Renomme');
    assert.equal((await postLogin(env.newAgent(), { email: 'garde@refuge.test', password: 'garde-password-1' })).status, 303);
  });

  test('modifier un compte vers un email déjà pris est refusé (422)', async () => {
    const id = await users.create({ name: 'Autre', email: 'autre@refuge.test', password: 'autre-password-1', role: 'editor' });
    const res = await send(`/admin/comptes/${id}`, { name: 'Autre', email: ADMIN.email, role: 'editor', password: '' });
    assert.equal(res.status, 422);
    assert.equal((await users.getById(id)).email, 'autre@refuge.test');
  });

  test('un compte inexistant répond 404', async () => {
    assert.equal((await agent.get('/admin/comptes/99999')).status, 404);
    assert.equal((await send('/admin/comptes/99999/supprimer')).status, 404);
  });

  test('un administrateur ne peut pas supprimer son propre compte', async () => {
    const res = await send(`/admin/comptes/${adminId}/supprimer`);
    assert.equal(res.status, 400);
    assert.ok(decode(res.text).includes('Vous ne pouvez pas supprimer votre propre compte.'));
    assert.ok(await users.findById(adminId));
  });

  test('le dernier administrateur ne peut pas être rétrogradé', async () => {
    const admins = (await users.list()).filter((user) => user.role === 'admin');
    assert.equal(admins.length, 1);
    const res = await send(`/admin/comptes/${adminId}`, { name: ADMIN.name, email: ADMIN.email, role: 'editor', password: '' });
    assert.equal(res.status, 422);
    assert.ok(decode(res.text).includes('Il doit rester au moins un administrateur.'));
    assert.equal((await users.getById(adminId)).role, 'admin');
  });

  test('un administrateur ne peut pas changer son propre rôle même s’il reste un autre admin', async () => {
    const otherAdmin = await users.create({ name: 'Second Admin', email: 'second@refuge.test', password: 'second-admin-123', role: 'admin' });
    const res = await send(`/admin/comptes/${adminId}`, { name: ADMIN.name, email: ADMIN.email, role: 'editor', password: '' });
    assert.equal(res.status, 403);
    assert.equal((await users.getById(adminId)).role, 'admin');
    await users.delete(otherAdmin, { id: adminId });
  });

  test('un administrateur peut rétrograder puis supprimer un autre administrateur', async () => {
    const otherAdmin = await users.create({ name: 'Troisieme Admin', email: 'troisieme@refuge.test', password: 'troisieme-admin-1', role: 'admin' });
    const demote = await send(`/admin/comptes/${otherAdmin}`, { name: 'Troisieme Admin', email: 'troisieme@refuge.test', role: 'editor', password: '' });
    assert.equal(demote.status, 303);
    assert.equal((await users.getById(otherAdmin)).role, 'editor');
    const remove = await send(`/admin/comptes/${otherAdmin}/supprimer`);
    assert.equal(remove.status, 303);
    assert.equal(await users.findById(otherAdmin), undefined);
  });

  test('un compte supprimé perd immédiatement l’accès à sa session ouverte', async () => {
    const id = await users.create({ name: 'Bientot Parti', email: 'parti@refuge.test', password: 'parti-password-1', role: 'editor' });
    const victim = env.newAgent();
    await login(victim, 'parti@refuge.test', 'parti-password-1');
    assert.equal((await victim.get('/admin')).status, 200);
    assert.equal((await send(`/admin/comptes/${id}/supprimer`)).status, 303);
    assert.equal((await victim.get('/admin')).status, 302);
  });

  test('un compte rétrogradé perd immédiatement l’accès aux pages administrateur', async () => {
    const id = await users.create({ name: 'Ex Admin', email: 'exadmin@refuge.test', password: 'exadmin-password', role: 'admin' });
    const other = env.newAgent();
    await login(other, 'exadmin@refuge.test', 'exadmin-password');
    assert.equal((await other.get('/admin/comptes')).status, 200);
    await send(`/admin/comptes/${id}`, { name: 'Ex Admin', email: 'exadmin@refuge.test', role: 'editor', password: '' });
    assert.equal((await other.get('/admin/comptes')).status, 403);
  });
});
