import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { setupTestEnv } from './helpers.js';

let env;
let slug;
let format;
let password;
let eventService;

before(async () => {
  env = await setupTestEnv('utils');
  slug = await import('../src/utils/slug.js');
  password = await import('../src/utils/password.js');
  format = env.format;
  eventService = env.services.eventService;
});

after(() => env.cleanup());

describe('slugify', () => {
  test('retire les accents et met en minuscules', () => {
    assert.equal(slug.slugify('Éléonore'), 'eleonore');
  });

  test('remplace & par "et" et les séparateurs par des tirets', () => {
    assert.equal(slug.slugify('Tom & Jerry'), 'tom-et-jerry');
  });

  test('supprime les tirets en début et en fin', () => {
    assert.equal(slug.slugify('  --Rex !!  '), 'rex');
  });

  test('retire les emojis et la ponctuation', () => {
    assert.equal(slug.slugify('Noël 🐶 (le chien)'), 'noel-le-chien');
  });

  test('renvoie "sans-titre" pour une chaîne vide ou sans caractère latin', () => {
    assert.equal(slug.slugify(''), 'sans-titre');
    assert.equal(slug.slugify('!!!'), 'sans-titre');
    assert.equal(slug.slugify('Мурка'), 'sans-titre');
  });

  test('limite la longueur à 80 caractères', () => {
    const result = slug.slugify('chat '.repeat(100));
    assert.ok(result.length <= 80, `length ${result.length}`);
  });

  test('ne se termine jamais par un tiret, même après troncature', () => {
    // 79 letters, a space, then more text: truncation at 80 lands right on the separator.
    const result = slug.slugify(`${'a'.repeat(79)} suite`);
    assert.ok(result.length <= 80);
    assert.ok(!result.endsWith('-'), `slug ends with a dash: "${result}"`);
  });

  test('convertit les nombres en chaîne', () => {
    assert.equal(slug.slugify(2026), '2026');
  });
});

describe('uniqueSlug', () => {
  test('renvoie le slug de base quand il est libre', () => {
    assert.equal(slug.uniqueSlug('Rex', () => false), 'rex');
  });

  test('ajoute -2, -3... tant que le slug existe', () => {
    const taken = new Set(['rex', 'rex-2']);
    assert.equal(slug.uniqueSlug('Rex', (candidate) => taken.has(candidate)), 'rex-3');
  });
});

describe('findUniqueSlug (asynchrone)', () => {
  test('renvoie le slug de base quand il est libre', async () => {
    assert.equal(await slug.findUniqueSlug('Éclair', async () => false), 'eclair');
  });

  test('ajoute -2, -3... tant que le prédicat asynchrone indique que le slug existe', async () => {
    const taken = new Set(['rex', 'rex-2']);
    assert.equal(await slug.findUniqueSlug('Rex', async (candidate) => taken.has(candidate)), 'rex-3');
  });

  test('propage l’erreur du prédicat asynchrone', async () => {
    await assert.rejects(slug.findUniqueSlug('Rex', async () => { throw new Error('db down'); }), /db down/);
  });
});

describe('password', () => {
  test('hashPassword produit un hash scrypt qui ne contient pas le mot de passe', () => {
    const hash = password.hashPassword('motdepasse-secret');
    assert.match(hash, /^scrypt\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    assert.ok(!hash.includes('motdepasse-secret'));
  });

  test('deux hash du même mot de passe sont différents (sel aléatoire)', () => {
    assert.notEqual(password.hashPassword('identique-123'), password.hashPassword('identique-123'));
  });

  test('verifyPassword accepte le bon mot de passe et refuse un mauvais', () => {
    const hash = password.hashPassword('correct-horse-battery');
    assert.equal(password.verifyPassword('correct-horse-battery', hash), true);
    assert.equal(password.verifyPassword('correct-horse-batterY', hash), false);
    assert.equal(password.verifyPassword('', hash), false);
  });

  test('verifyPassword gère les mots de passe Unicode', () => {
    const hash = password.hashPassword('mötdepasse€🐶');
    assert.equal(password.verifyPassword('mötdepasse€🐶', hash), true);
    assert.equal(password.verifyPassword('motdepasse€🐶', hash), false);
  });

  test('verifyPassword renvoie false pour un hash stocké mal formé', () => {
    assert.equal(password.verifyPassword('x', ''), false);
    assert.equal(password.verifyPassword('x', 'plaintext'), false);
    assert.equal(password.verifyPassword('x', 'bcrypt$10$abc$def'), false);
    assert.equal(password.verifyPassword('x', null), false);
  });

  test('verifyPassword renvoie false (sans lever) si le coût stocké est invalide', () => {
    assert.equal(password.verifyPassword('x', 'scrypt$abc$c2FsdHNhbHQ=$aGFzaGhhc2g='), false);
  });
});

describe('textToHtml', () => {
  test('renvoie une chaîne vide pour une valeur vide', () => {
    assert.equal(format.textToHtml(''), '');
    assert.equal(format.textToHtml(null), '');
    assert.equal(format.textToHtml(undefined), '');
  });

  test('échappe le HTML (pas de balise script exécutable)', () => {
    const html = format.textToHtml('<script>alert("x")</script> & <img src=x onerror=alert(1)>');
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes('<img'));
    assert.ok(html.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;img'));
  });

  test('échappe les apostrophes', () => {
    assert.equal(format.textToHtml("l'ami"), '<p>l&#39;ami</p>');
  });

  test('une ligne vide sépare les paragraphes, un retour simple donne <br>', () => {
    assert.equal(format.textToHtml('Ligne 1\nLigne 2\n\nParagraphe 2'), '<p>Ligne 1<br>Ligne 2</p>\n<p>Paragraphe 2</p>');
  });

  test('gère les fins de ligne Windows', () => {
    assert.equal(format.textToHtml('A\r\n\r\nB'), '<p>A</p>\n<p>B</p>');
  });

  test('les lignes commençant par "- " deviennent une liste', () => {
    assert.equal(format.textToHtml('- croquettes\n- laisse'), '<ul><li>croquettes</li><li>laisse</li></ul>');
  });

  test('**texte** devient du gras', () => {
    assert.equal(format.textToHtml('Très **câlin**'), '<p>Très <strong>câlin</strong></p>');
  });

  test('les URLs http(s) deviennent des liens sans avaler la ponctuation finale', () => {
    const html = format.textToHtml('Voir https://exemple.fr/page.');
    assert.equal(html, '<p>Voir <a href="https://exemple.fr/page" rel="noopener" target="_blank">https://exemple.fr/page</a>.</p>');
  });

  test('ne transforme pas javascript: en lien', () => {
    const html = format.textToHtml('javascript:alert(1)');
    assert.ok(!html.includes('<a'));
  });

  test('une URL contenant un guillemet ne peut pas sortir de l’attribut href', () => {
    const html = format.textToHtml('https://exemple.fr/"onmouseover="alert(1)');
    assert.ok(!/href="[^"]*"\s*onmouseover/.test(html), html);
  });

  test('le gras ne permet pas d’injecter du HTML', () => {
    const html = format.textToHtml('**<b>gras</b>**');
    assert.equal(html, '<p><strong>&lt;b&gt;gras&lt;/b&gt;</strong></p>');
  });
});

describe('excerpt', () => {
  test('renvoie le texte tel quel s’il est court', () => {
    assert.equal(format.excerpt('Un chien  très\n gentil', 180), 'Un chien très gentil');
  });

  test('coupe sur un mot entier et ajoute une ellipse', () => {
    const result = format.excerpt('alpha beta gamma delta', 12);
    assert.equal(result, 'alpha beta…');
  });

  test('retire les marqueurs de gras', () => {
    assert.equal(format.excerpt('**Urgent** : Rex'), 'Urgent : Rex');
  });

  test('gère null', () => {
    assert.equal(format.excerpt(null), '');
  });
});

describe('dates', () => {
  const now = new Date('2026-10-06T12:00:00Z');

  test('ageFromBirthDate exprime l’âge en années au-delà de 2 ans', () => {
    assert.equal(format.ageFromBirthDate('2020-10-06', now), '6 ans');
    assert.equal(format.ageFromBirthDate('2024-10-06', now), '2 ans');
  });

  test('ageFromBirthDate exprime l’âge en mois en dessous de 2 ans', () => {
    assert.equal(format.ageFromBirthDate('2024-10-07', now), '23 mois');
    assert.equal(format.ageFromBirthDate('2025-10-06', now), '12 mois');
    assert.equal(format.ageFromBirthDate('2026-09-06', now), '1 mois');
  });

  test('ageFromBirthDate renvoie "Quelques semaines" pour moins d’un mois', () => {
    assert.equal(format.ageFromBirthDate('2026-09-20', now), 'Quelques semaines');
  });

  test('ageFromBirthDate renvoie une chaîne vide pour une date future, vide ou invalide', () => {
    assert.equal(format.ageFromBirthDate('2027-01-01', now), '');
    assert.equal(format.ageFromBirthDate('', now), '');
    assert.equal(format.ageFromBirthDate('pas-une-date', now), '');
  });

  test('nowWallClock donne l’heure de Paris (été et hiver)', () => {
    assert.equal(format.nowWallClock(new Date('2026-07-01T10:00:00Z')), '2026-07-01T12:00');
    assert.equal(format.nowWallClock(new Date('2026-01-15T23:30:00Z')), '2026-01-16T00:30');
  });

  test('formatDate / formatTime / formatMonth en français, sans décalage de fuseau', () => {
    assert.equal(format.formatDate('2026-10-06'), '6 octobre 2026');
    assert.equal(format.formatDate('2026-12-31T23:30'), '31 décembre 2026');
    assert.equal(format.formatTime('2026-10-06T14:30'), '14h30');
    assert.equal(format.formatMonth(2026, 10), 'Octobre 2026');
    assert.equal(format.formatDate(''), '');
    assert.equal(format.formatDate('n/importe quoi'), '');
  });
});

describe('eventService.month', () => {
  test('octobre 2026 : semaines du lundi, 3 cases vides avant le jeudi 1er, 5 semaines', async () => {
    const month = await eventService.month(2026, 10);
    assert.equal(month.year, 2026);
    assert.equal(month.month, 10);
    assert.equal(month.label, 'Octobre 2026');
    assert.equal(month.weeks.length, 5);
    for (const week of month.weeks) assert.equal(week.length, 7);
    assert.deepEqual(month.weeks[0].slice(0, 3), [null, null, null]);
    assert.equal(month.weeks[0][3].day, 1);
    assert.equal(month.weeks[0][3].key, '2026-10-01');
    const days = month.weeks.flat().filter(Boolean);
    assert.equal(days.length, 31);
    assert.equal(days.at(-1).key, '2026-10-31');
  });

  test('février 2027 commence un lundi et tient en exactement 4 semaines', async () => {
    const month = await eventService.month(2027, 2);
    assert.equal(month.weeks.length, 4);
    assert.equal(month.weeks[0][0].key, '2027-02-01');
    assert.equal(month.weeks[3][6].key, '2027-02-28');
  });

  test('février d’une année bissextile compte 29 jours', async () => {
    const days = (await eventService.month(2028, 2)).weeks.flat().filter(Boolean);
    assert.equal(days.length, 29);
  });

  test('mois précédent/suivant passent correctement l’année', async () => {
    const december = await eventService.month(2026, 12);
    assert.deepEqual(december.next, { year: 2027, month: 1 });
    assert.deepEqual(december.prev, { year: 2026, month: 11 });
    const january = await eventService.month(2027, 1);
    assert.deepEqual(january.prev, { year: 2026, month: 12 });
  });

  test('un mois ou une année hors limites retombe sur le mois courant', async () => {
    const current = format.nowWallClock();
    const month = await eventService.month(2026, 13);
    assert.equal(month.month, Number(current.slice(5, 7)));
    const year = await eventService.month(1500, 3);
    assert.equal(year.year, Number(current.slice(0, 4)));
    const none = await eventService.month();
    assert.equal(none.year, Number(current.slice(0, 4)));
    assert.equal(none.month, Number(current.slice(5, 7)));
  });

  test('un événement est rangé dans la case de son jour', async () => {
    await eventService.create({ title: 'Kermesse unit', description: '', location: '', category: 'kermesse', all_day: 0, visibility: 'public', starts_at: '2030-05-14T10:00', ends_at: '2030-05-14T17:00' });
    const month = await eventService.month(2030, 5);
    const cell = month.weeks.flat().find((item) => item?.key === '2030-05-14');
    assert.deepEqual(cell.events.map((event) => event.title), ['Kermesse unit']);
    const other = month.weeks.flat().find((item) => item?.key === '2030-05-15');
    assert.equal(other.events.length, 0);
  });

  test('un événement sur plusieurs jours apparaît sur chacun de ses jours', async () => {
    await eventService.create({ title: 'Collecte 3 jours', description: '', location: '', category: 'collecte', all_day: 1, visibility: 'public', starts_at: '2030-06-10T00:00', ends_at: '2030-06-12T23:59' });
    const cells = (await eventService.month(2030, 6)).weeks.flat().filter(Boolean);
    const withEvent = cells.filter((cell) => cell.events.some((event) => event.title === 'Collecte 3 jours')).map((cell) => cell.key);
    assert.deepEqual(withEvent, ['2030-06-10', '2030-06-11', '2030-06-12']);
  });

  test('un événement commencé le mois précédent apparaît sur les premiers jours du mois suivant', async () => {
    await eventService.create({ title: 'À cheval sur deux mois', description: '', location: '', category: 'autre', all_day: 1, visibility: 'public', starts_at: '2030-07-30T00:00', ends_at: '2030-08-02T23:59' });
    const cells = (await eventService.month(2030, 8)).weeks.flat().filter(Boolean);
    const withEvent = cells.filter((cell) => cell.events.some((event) => event.title === 'À cheval sur deux mois')).map((cell) => cell.key);
    assert.deepEqual(withEvent, ['2030-08-01', '2030-08-02']);
  });

  test('publicOnly exclut les événements internes, la vue complète les inclut', async () => {
    await eventService.create({ title: 'Réunion interne', description: '', location: '', category: 'benevoles', all_day: 0, visibility: 'interne', starts_at: '2030-09-03T19:00', ends_at: null });
    assert.equal((await eventService.month(2030, 9, { publicOnly: true })).events.length, 0);
    assert.equal((await eventService.month(2030, 9)).events.length, 1);
  });
});

describe('eventService.toIcs', () => {
  test('produit un VCALENDAR avec fins de ligne CRLF et échappe , ; et retours à la ligne', async () => {
    const id = await eventService.create({ title: 'Kermesse, tombola; buvette', description: 'Ligne 1\nLigne 2', location: 'Refuge', category: 'kermesse', all_day: 0, visibility: 'public', starts_at: '2031-06-07T10:00', ends_at: '2031-06-07T17:30' });
    const ics = eventService.toIcs([await eventService.getById(id)]);
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
    assert.ok(!/[^\r]\n/.test(ics), 'bare LF found');
    assert.ok(ics.includes('SUMMARY:Kermesse\\, tombola\\; buvette\r\n'));
    assert.ok(ics.includes('DESCRIPTION:Ligne 1\\nLigne 2\r\n'));
    assert.ok(ics.includes('DTSTART;TZID=Europe/Paris:20310607T100000'));
    assert.ok(ics.includes('DTEND;TZID=Europe/Paris:20310607T173000'));
    assert.ok(ics.includes(`UID:event-${id}@refuge.test`));
  });

  test('un événement sur la journée entière a un DTEND exclusif au lendemain', async () => {
    const id = await eventService.create({ title: 'Fermeture', description: '', location: '', category: 'fermeture', all_day: 1, visibility: 'public', starts_at: '2031-12-31T00:00', ends_at: '2031-12-31T23:59' });
    const ics = eventService.toIcs([await eventService.getById(id)]);
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20311231'));
    assert.ok(ics.includes('DTEND;VALUE=DATE:20320101'));
  });
});
