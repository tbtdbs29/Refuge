import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { setupTestEnv } from './helpers.js';

// Simultaneous writes on the local SQLite file (VPS hosting, development, tests).
// Two visitors sending the contact form or two volunteers saving at the same moment must both succeed.

let env;
let schemas;

before(async () => {
  env = await setupTestEnv('concurrency');
  schemas = await import('../src/schemas/index.js');
});

after(() => env.cleanup());

const BUSY_BUG =
  'BUG src/db/index.js:15 + :28: @libsql/client 0.18 uses a connection pool; PRAGMA busy_timeout is executed on a single pooled connection and createClient() gets no `timeout`, so concurrent writes on other connections fail immediately with SQLITE_BUSY (500, data lost)';

const settledErrors = (results) => results.filter((result) => result.status === 'rejected').map((result) => result.reason?.code || result.reason?.message);

describe('écritures simultanées', () => {
  test('quatre messages de contact envoyés en même temps sont tous enregistrés', async () => {
    const results = await Promise.allSettled(
      [1, 2, 3, 4].map((index) => env.services.messageService.submit(schemas.validate(schemas.messageSchema, { name: `Simultane ${index}`, email: 'sim@example.fr', body: 'Bonjour', consent: 'on' }))),
    );
    assert.deepEqual(settledErrors(results), []);
    const names = (await env.services.messageService.list('nouveau')).map((message) => message.name).filter((name) => name.startsWith('Simultane'));
    assert.equal(names.length, 4);
  });

  test('trois événements créés en même temps sont tous enregistrés', async () => {
    const results = await Promise.allSettled(
      [1, 2, 3].map((index) => env.services.eventService.create(schemas.validate(schemas.eventSchema, { title: `Parallele ${index}`, start_date: `2032-03-0${index}` }))),
    );
    assert.deepEqual(settledErrors(results), []);
    assert.equal((await env.services.eventService.month(2032, 3)).events.length, 3);
  });

  test('trois fiches animales de noms différents créées en même temps sont toutes enregistrées', async () => {
    const results = await Promise.allSettled(
      ['Alpha', 'Beta', 'Gamma'].map((name) => env.services.animalService.create(schemas.validate(schemas.animalSchema, { name, species: 'chien', published: 'on' }), [])),
    );
    assert.deepEqual(settledErrors(results), []);
  });

  test('deux fiches du même nom créées en même temps reçoivent des slugs distincts', async () => {
    const results = await Promise.allSettled(
      [1, 2].map(() => env.services.animalService.create(schemas.validate(schemas.animalSchema, { name: 'Homonyme', species: 'chat', published: 'on' }), [])),
    );
    assert.deepEqual(settledErrors(results), []);
    const slugs = (await env.services.animalService.listAdmin({})).filter((animal) => animal.name === 'Homonyme').map((animal) => animal.slug);
    assert.equal(new Set(slugs).size, 2);
  });

  test('après des écritures concurrentes en échec, la base reste utilisable', async () => {
    await Promise.allSettled([1, 2, 3].map((index) => env.services.eventService.create(schemas.validate(schemas.eventSchema, { title: `Rafale ${index}`, start_date: '2032-05-01' }))));
    const id = await env.services.eventService.create(schemas.validate(schemas.eventSchema, { title: 'Apres rafale', start_date: '2032-05-02' }));
    assert.equal((await env.services.eventService.getById(id)).title, 'Apres rafale');
    assert.equal((await env.request().get('/agenda?mois=2032-05')).status, 200);
  });
});
