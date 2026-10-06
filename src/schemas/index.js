import { z } from 'zod';
import { BACKDROPS, EVENT_CATEGORIES, MESSAGE_STATUS, MESSAGE_TOPICS, POST_CATEGORIES, ROLES } from '../config/labels.js';
import { ValidationError } from '../utils/errors.js';

const keys = (object) => Object.keys(object);

// Missing form fields arrive as undefined: treat them as empty strings so messages stay in French.
const str = (schema) => z.preprocess((value) => (value === undefined || value === null ? '' : value), schema);
const text = (max, message = `${max} caractères maximum`) => str(z.string().trim().max(max, message));
const required = (max, message = 'Ce champ est obligatoire') => str(z.string().trim().min(1, message).max(max, `${max} caractères maximum`));
const email = str(z.string().trim().max(160).email('Adresse email invalide'));
const checkbox = z.preprocess((value) => (value === 'on' || value === '1' || value === 'true' || value === true ? 1 : 0), z.number());
const optionalDate = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide').nullable(),
);
const dateTime = str(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Date et heure invalides'));

export const animalSchema = z.object({
  name: required(60, 'Donnez un nom à l’animal'),
  species: z.enum(['chien', 'chat', 'nac', 'ferme'], { message: 'Choisissez une espèce' }),
  sex: z.enum(['male', 'femelle', 'groupe', 'inconnu']).default('inconnu'),
  breed: text(80),
  birth_date: optionalDate,
  age_label: text(40),
  tagline: text(140),
  description: text(6000),
  ok_dogs: z.enum(['oui', 'non', 'a_tester']).default('a_tester'),
  ok_cats: z.enum(['oui', 'non', 'a_tester']).default('a_tester'),
  ok_kids: z.enum(['oui', 'non', 'a_tester', 'grands']).default('a_tester'),
  housing: z.enum(['appartement', 'maison', 'jardin_clos', 'exterieur']).default('maison'),
  identification: text(40),
  vaccinated: checkbox,
  sterilized: checkbox,
  dewormed: checkbox,
  foster_note: text(120),
  status: z.enum(['disponible', 'reserve', 'adopte']).default('disponible'),
  urgent: checkbox,
  featured: checkbox,
  published: checkbox,
  backdrop: z.enum(keys(BACKDROPS)).default('ajonc'),
  fee_label: text(60),
});

export const eventSchema = z
  .object({
    title: required(120, 'Donnez un titre'),
    description: text(4000),
    location: text(160),
    category: z.enum(keys(EVENT_CATEGORIES)).default('autre'),
    all_day: checkbox,
    start_date: str(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choisissez une date')),
    start_time: str(z.string().regex(/^(\d{2}:\d{2})?$/, 'Heure invalide')),
    end_date: str(z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Date invalide')),
    end_time: str(z.string().regex(/^(\d{2}:\d{2})?$/, 'Heure invalide')),
    visibility: z.enum(['public', 'interne']).default('public'),
  })
  .transform((data) => {
    const startTime = data.all_day ? '00:00' : data.start_time || '10:00';
    const endDate = data.end_date || data.start_date;
    const endTime = data.all_day ? '23:59' : data.end_time;
    return {
      title: data.title,
      description: data.description,
      location: data.location,
      category: data.category,
      all_day: data.all_day,
      visibility: data.visibility,
      starts_at: `${data.start_date}T${startTime}`,
      ends_at: endTime || data.end_date ? `${endDate}T${endTime || startTime}` : null,
    };
  })
  .refine((event) => !event.ends_at || event.ends_at >= event.starts_at, { message: 'La fin doit être après le début', path: ['end_date'] });

export const postSchema = z.object({
  title: required(140, 'Donnez un titre'),
  category: z.enum(keys(POST_CATEGORIES)).default('vie'),
  excerpt: text(300),
  body: required(20000, 'Écrivez le contenu de l’article'),
  published: checkbox,
  published_at: dateTime,
});

export const messageSchema = z.object({
  topic: z.enum(keys(MESSAGE_TOPICS)).default('autre'),
  name: required(80, 'Indiquez votre nom'),
  email,
  phone: str(z.string().trim().max(30).regex(/^[0-9 +().-]*$/, 'Numéro invalide')),
  animal_id: z.preprocess((value) => (value ? Number(value) : null), z.number().int().positive().nullable()),
  home: text(3000),
  body: required(5000, 'Écrivez votre message'),
  consent: z.literal('on', { message: 'Merci d’accepter que nous conservions votre message pour vous répondre' }),
});

export const messageStatusSchema = z.object({ status: z.enum(keys(MESSAGE_STATUS)) });

export const loginSchema = z.object({
  email: required(160, 'Indiquez votre email'),
  password: str(z.string().min(1, 'Indiquez votre mot de passe').max(200)),
});

const password = str(z.string().min(10, '10 caractères minimum').max(200));

export const userSchema = z.object({
  name: required(80, 'Indiquez un nom'),
  email,
  role: z.enum(keys(ROLES)).default('editor'),
  password: str(z.union([z.literal(''), z.string().min(10, '10 caractères minimum').max(200)])),
});

export const passwordChangeSchema = z
  .object({
    current: str(z.string().min(1, 'Indiquez votre mot de passe actuel')),
    password,
    confirm: str(z.string()),
  })
  .refine((data) => data.password === data.confirm, { message: 'Les deux mots de passe ne correspondent pas', path: ['confirm'] });

/** Parses data with a schema and throws a ValidationError mapping field -> first message. */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const details = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] ?? 'form';
    details[field] ??= issue.message;
  }
  throw new ValidationError(details);
}
