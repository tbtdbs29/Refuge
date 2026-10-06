import { z } from 'zod';
import { validate } from '../../schemas/index.js';
import { settingsService } from '../../services/settingsService.js';
import { NotFoundError } from '../../utils/errors.js';
import { asArray, formAction } from './helpers.js';

const field = (max) => z.string().trim().max(max, `${max} caractères maximum`).default('');
const url = z
  .preprocess((value) => (value === undefined ? '' : value), z.union([z.literal(''), z.string().trim().max(300).regex(/^https?:\/\/[^\s"'<>]+$/i, 'Adresse web invalide (commencez par https://)')]));
const lines = (value) => String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 40);

const shelterSchema = z.object({
  name: field(120).pipe(z.string().min(1, 'Le nom est obligatoire')),
  shortName: field(60),
  address: field(160),
  postcode: field(10),
  city: field(80),
  phone: field(30),
  email: z.string().trim().email('Adresse email invalide').max(160),
  hours: field(200),
  facebook: url,
  donationUrl: url,
  intro: field(800),
});

const bannerSchema = z.object({
  enabled: z.preprocess((value) => value === 'on', z.boolean()),
  text: field(240),
});

function feeRows(body, prefix) {
  const labels = asArray(body[`${prefix}_label`]);
  const prices = asArray(body[`${prefix}_price`]);
  const notes = asArray(body[`${prefix}_note`]);
  const keys = asArray(body[`${prefix}_key`]);
  return labels
    .map((label, index) => ({
      key: String(keys[index] || '').slice(0, 20),
      label: String(label).trim().slice(0, 120),
      price: String(prices[index] || '').trim().slice(0, 60),
      note: String(notes[index] || '').trim().slice(0, 160),
    }))
    .filter((row) => row.label);
}

const SECTIONS = {
  shelter: (body) => validate(shelterSchema, body),
  banner: (body) => validate(bannerSchema, body),
  fees: (body) => ({
    dogsIncluded: String(body.dogsIncluded || '').trim().slice(0, 600),
    catsIncluded: String(body.catsIncluded || '').trim().slice(0, 600),
    breedNote: String(body.breedNote || '').trim().slice(0, 600),
    dogs: feeRows(body, 'dogs'),
    cats: feeRows(body, 'cats'),
    others: feeRows(body, 'others'),
  }),
  help: (body) => ({
    membership: String(body.membership || '').trim().slice(0, 1200),
    donation: String(body.donation || '').trim().slice(0, 1200),
    volunteering: String(body.volunteering || '').trim().slice(0, 1200),
    extras: String(body.extras || '').trim().slice(0, 600),
    inKindAnimals: lines(body.inKindAnimals),
    inKindShelter: lines(body.inKindShelter),
  }),
};

async function render(req, res, { errors = {}, section = req.params.section || 'shelter', values } = {}) {
  const settings = await settingsService.get();
  res.render('admin/settings.njk', { errors, section, values: values || settings[section] || {}, all: settings });
}

export async function show(req, res) {
  const section = SECTIONS[req.query.onglet] ? req.query.onglet : 'shelter';
  await render(req, res, { section });
}

export const update = formAction(
  async (req, res) => {
    const section = req.params.section;
    if (!SECTIONS[section]) throw new NotFoundError();
    await settingsService.update(section, SECTIONS[section](req.body));
    req.flash('success', 'Réglages enregistrés. Le site est à jour.');
    res.redirect(303, `/admin/reglages?onglet=${section}`);
  },
  (req, res, state) => render(req, res, state),
);
