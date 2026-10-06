import { config } from '../../config/index.js';
import { SPECIES, SPECIES_BY_PATH } from '../../config/labels.js';
import { messageSchema, validate } from '../../schemas/index.js';
import { animalService } from '../../services/animalService.js';
import { eventService } from '../../services/eventService.js';
import { messageService } from '../../services/messageService.js';
import { postService } from '../../services/postService.js';
import { ValidationError } from '../../utils/errors.js';

export function home(req, res) {
  res.render('public/home.njk', {
    featured: animalService.featured(6),
    recent: animalService.listPublic({ order: 'recent', limit: 6 }),
    counts: animalService.countsBySpecies(),
    urgent: animalService.urgent().slice(0, 3),
    events: eventService.upcoming(3),
    posts: postService.latest(3),
    adoptedRecent: animalService.adopted({ limit: 6 }),
  });
}

export function animals(req, res) {
  const speciesPath = typeof req.query.espece === 'string' ? req.query.espece : '';
  const species = SPECIES_BY_PATH[speciesPath];
  const filters = {
    species,
    sex: ['male', 'femelle'].includes(req.query.sexe) ? req.query.sexe : undefined,
    okKids: req.query.enfants === '1',
    okCats: req.query.chats === '1',
    okDogs: req.query.chiens === '1',
  };
  const list = animalService.listPublic(filters);
  res.render('public/animals.njk', {
    animals: list,
    counts: animalService.countsBySpecies(),
    species,
    speciesInfo: species ? SPECIES[species] : null,
    query: { espece: speciesPath, sexe: filters.sex || '', enfants: filters.okKids, chats: filters.okCats, chiens: filters.okDogs },
    hasFilters: Boolean(filters.sex || filters.okKids || filters.okCats || filters.okDogs),
  });
}

export function animal(req, res) {
  const item = animalService.getPublic(req.params.slug, { allowUnpublished: Boolean(req.user) });
  res.render('public/animal.njk', { animal: item, siblings: item.status === 'adopte' ? [] : animalService.siblings(item) });
}

export function adopted(req, res) {
  res.render('public/adopted.njk', { animals: animalService.adopted({ limit: 120 }), total: animalService.countAdopted() });
}

export function adopt(req, res) {
  res.render('public/adopt.njk');
}

export function help(req, res) {
  res.render('public/help.njk', { urgent: animalService.urgent() });
}

export function agenda(req, res) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(req.query.mois || ''));
  const month = eventService.month(match ? Number(match[1]) : undefined, match ? Number(match[2]) : undefined, { publicOnly: true });
  res.render('public/agenda.njk', { month, upcoming: eventService.upcoming(8) });
}

export function agendaEvent(req, res) {
  res.render('public/event.njk', { event: eventService.getById(Number(req.params.id), { publicOnly: true }) });
}

export function agendaEventIcs(req, res) {
  const event = eventService.getById(Number(req.params.id), { publicOnly: true });
  res.type('text/calendar').attachment(`refuge-evenement-${event.id}.ics`).send(eventService.toIcs([event]));
}

export function agendaFeed(req, res) {
  res.type('text/calendar').send(eventService.toIcs(eventService.upcoming(100)));
}

export function news(req, res) {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const category = typeof req.query.categorie === 'string' && req.query.categorie ? req.query.categorie : undefined;
  res.render('public/news.njk', { ...postService.listPublic({ page, category }), category });
}

export function newsPost(req, res) {
  const post = postService.getPublic(req.params.slug);
  res.render('public/post.njk', { post, more: postService.latest(4).filter((item) => item.id !== post.id).slice(0, 3) });
}

function contactContext(req, values = {}) {
  const slug = typeof req.query.animal === 'string' ? req.query.animal : '';
  let linkedAnimal = null;
  if (slug) {
    try {
      linkedAnimal = animalService.getPublic(slug);
    } catch {
      linkedAnimal = null;
    }
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

export function contact(req, res) {
  res.render('public/contact.njk', { ...contactContext(req), sent: req.query.envoye === '1' });
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
    const context = contactContext(req, req.body);
    if (req.body.animal_id && !context.linkedAnimal) {
      try {
        const list = animalService.listPublic();
        context.linkedAnimal = list.find((item) => item.id === Number(req.body.animal_id)) || null;
      } catch {
        context.linkedAnimal = null;
      }
    }
    res.status(422).render('public/contact.njk', { ...context, errors: error.details });
  }
}

export function legal(req, res) {
  res.render('public/legal.njk');
}

export function robots(req, res) {
  res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
}

export function sitemap(req, res) {
  const pages = ['/', '/animaux', '/adopter', '/adoptes', '/agenda', '/actualites', '/aider', '/contact'];
  const animalsUrls = animalService.listPublic().map((item) => item.url);
  const postUrls = postService.listPublic({ page: 1 }).posts.map((post) => post.url);
  const urls = [...pages, ...animalsUrls, ...postUrls].map((url) => `<url><loc>${config.baseUrl}${url}</loc></url>`).join('');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}
