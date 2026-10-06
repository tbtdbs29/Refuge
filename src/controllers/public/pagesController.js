import { config } from '../../config/index.js';
import { SPECIES, SPECIES_BY_PATH } from '../../config/labels.js';
import { messageSchema, validate } from '../../schemas/index.js';
import { animalService } from '../../services/animalService.js';
import { eventService } from '../../services/eventService.js';
import { messageService } from '../../services/messageService.js';
import { postService } from '../../services/postService.js';
import { ValidationError } from '../../utils/errors.js';

/** A positive integer id from user input, or 0 (which matches nothing and yields a 404). */
const toId = (value) => (/^\d{1,12}$/.test(String(value ?? '')) ? Number(value) : 0);

export async function home(req, res) {
  const [featured, recent, counts, urgent, events, posts, adoptedRecent] = await Promise.all([
    animalService.featured(6),
    animalService.listPublic({ order: 'recent', limit: 6 }),
    animalService.countsBySpecies(),
    animalService.urgent(),
    eventService.upcoming(3),
    postService.latest(3),
    animalService.adopted({ limit: 6 }),
  ]);
  res.render('public/home.njk', { featured, recent, counts, urgent: urgent.slice(0, 3), events, posts, adoptedRecent });
}

export async function animals(req, res) {
  const speciesPath = typeof req.query.espece === 'string' ? req.query.espece : '';
  const species = SPECIES_BY_PATH[speciesPath];
  const filters = {
    species,
    sex: ['male', 'femelle'].includes(req.query.sexe) ? req.query.sexe : undefined,
    okKids: req.query.enfants === '1',
    okCats: req.query.chats === '1',
    okDogs: req.query.chiens === '1',
  };
  const [list, counts] = await Promise.all([animalService.listPublic(filters), animalService.countsBySpecies()]);
  res.render('public/animals.njk', {
    animals: list,
    counts,
    species,
    speciesInfo: species ? SPECIES[species] : null,
    query: { espece: speciesPath, sexe: filters.sex || '', enfants: filters.okKids, chats: filters.okCats, chiens: filters.okDogs },
    hasFilters: Boolean(filters.sex || filters.okKids || filters.okCats || filters.okDogs),
  });
}

export async function animal(req, res) {
  const item = await animalService.getPublic(req.params.slug, { allowUnpublished: Boolean(req.user) });
  res.render('public/animal.njk', { animal: item, siblings: item.status === 'adopte' ? [] : await animalService.siblings(item) });
}

export async function adopted(req, res) {
  const [animals, total] = await Promise.all([animalService.adopted({ limit: 120 }), animalService.countAdopted()]);
  res.render('public/adopted.njk', { animals, total });
}

export function adopt(req, res) {
  res.render('public/adopt.njk');
}

export async function help(req, res) {
  res.render('public/help.njk', { urgent: await animalService.urgent() });
}

export async function agenda(req, res) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(req.query.mois || ''));
  const [month, upcoming] = await Promise.all([
    eventService.month(match ? Number(match[1]) : undefined, match ? Number(match[2]) : undefined, { publicOnly: true }),
    eventService.upcoming(8),
  ]);
  res.render('public/agenda.njk', { month, upcoming });
}

export async function agendaEvent(req, res) {
  res.render('public/event.njk', { event: await eventService.getById(toId(req.params.id), { publicOnly: true }) });
}

export async function agendaEventIcs(req, res) {
  const event = await eventService.getById(toId(req.params.id), { publicOnly: true });
  res.type('text/calendar').attachment(`refuge-evenement-${event.id}.ics`).send(eventService.toIcs([event]));
}

export async function agendaFeed(req, res) {
  res.type('text/calendar').send(eventService.toIcs(await eventService.upcoming(100)));
}

export async function news(req, res) {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const category = typeof req.query.categorie === 'string' && req.query.categorie ? req.query.categorie : undefined;
  res.render('public/news.njk', { ...(await postService.listPublic({ page, category })), category });
}

export async function newsPost(req, res) {
  const post = await postService.getPublic(req.params.slug);
  const latest = await postService.latest(4);
  res.render('public/post.njk', { post, more: latest.filter((item) => item.id !== post.id).slice(0, 3) });
}

async function contactContext(req, values = {}) {
  const slug = typeof req.query.animal === 'string' ? req.query.animal : '';
  let linkedAnimal = null;
  if (slug) {
    linkedAnimal = await animalService.getPublic(slug).catch(() => null);
  } else if (values.animal_id) {
    linkedAnimal = await animalService.findPublicById(toId(values.animal_id));
  }
  return {
    linkedAnimal,
    values: {
      topic: linkedAnimal ? 'adoption' : typeof req.query.sujet === 'string' ? req.query.sujet : 'adoption',
      animal_id: linkedAnimal?.id || '',
      ...values,
    },
    errors: {},
  };
}

export async function contact(req, res) {
  res.render('public/contact.njk', { ...(await contactContext(req)), sent: req.query.envoye === '1' });
}

export async function contactSubmit(req, res) {
  // Honeypot: bots fill the hidden "website" field; pretend success without saving.
  if (req.body.website) return res.redirect(303, '/contact?envoye=1');
  try {
    const data = validate(messageSchema, req.body);
    await messageService.submit(data);
    res.redirect(303, '/contact?envoye=1');
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    const context = await contactContext(req, req.body);
    res.status(422).render('public/contact.njk', { ...context, errors: error.details });
  }
}

export function legal(req, res) {
  res.render('public/legal.njk');
}

export function robots(req, res) {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
}

export async function sitemap(req, res) {
  const pages = ['/', '/animaux', '/adopter', '/adoptes', '/agenda', '/actualites', '/aider', '/contact'];
  const animalsUrls = (await animalService.listPublic()).map((item) => item.url);
  const postUrls = (await postService.listPublic({ page: 1 })).posts.map((post) => post.url);
  const urls = [...pages, ...animalsUrls, ...postUrls].map((url) => `<url><loc>${config.baseUrl}${url}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}
