import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { csrfFrom, setupTestEnv } from './helpers.js';

let env;

before(async () => {
  env = await setupTestEnv('setup');
});

after(() => env.cleanup());

describe('installation initiale (base sans compte)', () => {
  test('sans aucun compte, /admin/connexion redirige vers l’installation', async () => {
    const res = await env.request().get('/admin/connexion');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/admin/installation');
  });

  test('le formulaire d’installation est accessible et protégé par CSRF', async () => {
    const res = await env.request().get('/admin/installation');
    assert.equal(res.status, 200);
    assert.match(res.text, /name="_csrf" value="[^"]{20,}"/);
  });

  test('l’installation sans jeton CSRF est refusée (403)', async () => {
    const agent = env.newAgent();
    await agent.get('/admin/installation');
    const res = await agent.post('/admin/installation').type('form').send({ name: 'X', email: 'x@refuge.test', password: 'mot-de-passe-123' });
    assert.equal(res.status, 403);
    assert.equal(env.services.userService.hasUsers(), false);
  });

  test('l’installation refuse un mot de passe absent ou trop court (422)', async () => {
    const agent = env.newAgent();
    const token = await csrfFrom(agent, '/admin/installation');
    const empty = await agent.post('/admin/installation').type('form').send({ _csrf: token, name: 'Admin', email: 'admin@refuge.test', password: '' });
    assert.equal(empty.status, 422);
    assert.ok(empty.text.includes('Choisissez un mot de passe'));
    const short = await agent.post('/admin/installation').type('form').send({ _csrf: token, name: 'Admin', email: 'admin@refuge.test', password: 'court' });
    assert.equal(short.status, 422);
    assert.ok(short.text.includes('10 caractères minimum'));
    assert.equal(env.services.userService.hasUsers(), false);
  });

  test('l’installation crée un administrateur (même si un autre rôle est envoyé) et le connecte', async () => {
    const agent = env.newAgent();
    const token = await csrfFrom(agent, '/admin/installation');
    const res = await agent.post('/admin/installation').type('form').send({ _csrf: token, name: 'Premier Admin', email: 'premier@refuge.test', password: 'premier-mot-de-passe', role: 'editor' });
    assert.equal(res.status, 303);
    assert.equal(res.headers.location, '/admin');
    const [user] = env.services.userService.list();
    assert.equal(user.email, 'premier@refuge.test');
    assert.equal(user.role, 'admin');
    const dashboard = await agent.get('/admin');
    assert.equal(dashboard.status, 200);
    assert.ok(dashboard.text.includes('Bienvenue'));
  });

  test('une fois un compte créé, l’installation n’est plus accessible', async () => {
    const res = await env.request().get('/admin/installation');
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/admin/connexion');
  });

  test('un second POST d’installation ne crée pas de nouveau compte', async () => {
    const agent = env.newAgent();
    const token = await csrfFrom(agent, '/admin/connexion');
    const res = await agent.post('/admin/installation').type('form').send({ _csrf: token, name: 'Attaquant', email: 'attaquant@refuge.test', password: 'attaquant-password' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/admin/connexion');
    assert.equal(env.services.userService.list().length, 1);
    assert.equal((await agent.get('/admin')).status, 302);
  });
});
