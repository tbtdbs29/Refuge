import { BACKDROPS, COMPAT, HOUSING, HOUSING_SHORT, SEX, SPECIES, STATUS } from '../config/labels.js';
import { transaction } from '../db/index.js';
import { animalRepository } from '../repositories/animalRepository.js';
import { ageFromBirthDate, ageInYears, excerpt, textToHtml } from '../utils/format.js';
import { NotFoundError } from '../utils/errors.js';
import { findUniqueSlug } from '../utils/slug.js';
import { deleteImage, imageUrl, saveImage } from './imageService.js';
import { settingsService } from './settingsService.js';
import { logger } from '../utils/logger.js';

const PUBLIC_STATUSES = ['disponible', 'reserve'];

// Coat palettes for the illustration shown until a photo is uploaded.
const COATS = [
  { fur: '#D9822B', light: '#F7E2C6', dark: '#A65A17', iris: '#9BC46A' },
  { fur: '#8C919C', light: '#ECE8E2', dark: '#5D626D', iris: '#E7C65A' },
  { fur: '#34303A', light: '#F1ECE6', dark: '#1E1B22', iris: '#F0C649' },
  { fur: '#F2EADF', light: '#FFFFFF', dark: '#C9B79C', iris: '#7FB5D9' },
  { fur: '#7A4E33', light: '#EBD6BF', dark: '#4F311F', iris: '#D9A441' },
  { fur: '#C9A26B', light: '#F5EAD6', dark: '#977041', iris: '#88B562' },
];

function hash(text) {
  let value = 0;
  for (const char of String(text)) value = (value * 31 + char.codePointAt(0)) >>> 0;
  return value;
}

const COAT_BY_BREED = [
  [/beagle|fauve|basset/i, 5],
  [/noir|black|r[ée]glisse/i, 2],
  [/roux|caramel/i, 0],
];

/** Picks an illustration and individual traits (ears, markings, grey muzzle) for an animal without photo. */
function figureFor(animal) {
  const text = `${animal.name} ${animal.breed}`;
  const seed = hash(animal.name);
  let kind = { chien: 'dog', chat: 'cat', nac: 'rabbit', ferme: 'goat' }[animal.species];
  if (animal.species === 'ferme' && /mouton|brebis|b[ée]lier|agneau/i.test(text)) kind = 'sheep';
  const years = ageInYears(animal.birth_date);
  const traits = {
    senior: years !== null && years >= (animal.species === 'chat' ? 10 : 8),
  };
  if (kind === 'dog') {
    if (/basset/i.test(text)) traits.ears = 'long';
    else if (/berger|malinois|husky|loup|shepherd|spitz/i.test(text)) traits.ears = 'pointy';
    else if (/beagle|[ée]pagneul|cocker|setter|labrador/i.test(text)) traits.ears = 'floppy';
    else traits.ears = ['floppy', 'pointy', 'floppy'][seed % 3];
    traits.pattern = /beagle/i.test(text) || seed % 4 === 1 ? 'patch' : 'none';
  } else if (kind === 'cat') {
    traits.pattern = ['tabby', 'mask', 'plain'][seed % 3];
  } else if (kind === 'rabbit') {
    traits.ears = /b[ée]lier|lop/i.test(text) ? 'lop' : 'up';
  }
  const breedCoat = COAT_BY_BREED.find(([pattern]) => pattern.test(text));
  return { kind, traits, palette: COATS[breedCoat ? breedCoat[1] : seed % COATS.length] };
}

/** Picks the fee row key matching the animal's species, age and SOS flag. */
function feeKey(animal) {
  if (animal.urgent) return 'sos';
  const years = ageInYears(animal.birth_date);
  if (years === null) return 'adulte';
  if (years < 0.5) return 'jeune';
  if (years >= 10) return 'doyen';
  const seniorFrom = animal.species === 'chien' ? 8 : 6;
  return years >= seniorFrom ? 'senior' : 'adulte';
}

function feeFor(animal, fees) {
  if (animal.fee_label) return { price: animal.fee_label, label: '' };
  const table = animal.species === 'chien' ? fees.dogs : animal.species === 'chat' ? fees.cats : null;
  if (!table) return null;
  const row = table.find((item) => item.key === feeKey(animal));
  return row ? { price: row.price, label: row.label } : null;
}

/** The ruled caption under each portrait plate: the animal's character in five cells. */
function captionFor(animal, age) {
  const cells = [
    { label: 'Âge', value: age || '—' },
    { label: 'Chats', value: COMPAT[animal.ok_cats] },
    { label: 'Chiens', value: COMPAT[animal.ok_dogs] },
    { label: 'Enfants', value: animal.ok_kids === 'grands' ? 'Grands' : COMPAT[animal.ok_kids] },
    { label: 'Logement', value: HOUSING_SHORT[animal.housing] },
  ];
  if (animal.species === 'ferme') cells.splice(1, 2, { label: 'Sexe', value: SEX[animal.sex] });
  return cells;
}

function decorate(animal, photos = [], fees) {
  const age = animal.age_label || ageFromBirthDate(animal.birth_date);
  return {
    ...animal,
    age,
    speciesLabel: SPECIES[animal.species].label,
    speciesPath: SPECIES[animal.species].path,
    sexLabel: SEX[animal.sex],
    statusLabel: STATUS[animal.status],
    backdropHex: (BACKDROPS[animal.backdrop] || BACKDROPS.ajonc).hex,
    caption: captionFor(animal, age),
    url: `/animaux/${animal.slug}`,
    photos: photos.map((photo) => ({ ...photo, url: imageUrl(photo.filename), thumb: imageUrl(photo.filename, 'thumb') })),
    cover: photos[0] ? { url: imageUrl(photos[0].filename), thumb: imageUrl(photos[0].filename, 'thumb') } : null,
    summary: animal.tagline || excerpt(animal.description, 120),
    descriptionHtml: textToHtml(animal.description),
    fee: feeFor(animal, fees),
    housingLabel: HOUSING[animal.housing],
    inFoster: Boolean(animal.foster_note),
    figure: figureFor(animal),
    altText: `${SPECIES[animal.species].label} ${animal.name}${animal.breed ? `, ${animal.breed}` : ''}`,
  };
}

async function decorateOne(animal) {
  const [photos, settings] = await Promise.all([animalRepository.photos(animal.id), settingsService.get()]);
  return decorate(animal, photos, settings.fees);
}

async function decorateMany(animalsPromise) {
  const animals = await animalsPromise;
  const [photos, settings] = await Promise.all([animalRepository.photosFor(animals.map((animal) => animal.id)), settingsService.get()]);
  const byAnimal = Map.groupBy(photos, (photo) => photo.animal_id);
  return animals.map((animal) => decorate(animal, byAnimal.get(animal.id) || [], settings.fees));
}

const today = () => new Date().toISOString().slice(0, 10);

export const animalService = {
  PUBLIC_STATUSES,

  listPublic(filters = {}) {
    return decorateMany(animalRepository.list({ ...filters, publishedOnly: true, statuses: PUBLIC_STATUSES, order: filters.order || 'urgent' }));
  },

  async featured(limit = 6) {
    const featured = await animalRepository.list({ publishedOnly: true, statuses: PUBLIC_STATUSES, featured: true, order: 'urgent', limit });
    if (featured.length >= 3) return decorateMany(featured);
    const extra = (await animalRepository.list({ publishedOnly: true, statuses: PUBLIC_STATUSES, order: 'urgent', limit: limit * 2 })).filter(
      (animal) => !featured.some((item) => item.id === animal.id),
    );
    return decorateMany([...featured, ...extra].slice(0, limit));
  },

  urgent() {
    return decorateMany(animalRepository.list({ publishedOnly: true, statuses: PUBLIC_STATUSES, urgent: true }));
  },

  adopted({ limit, offset } = {}) {
    return decorateMany(animalRepository.list({ publishedOnly: true, statuses: ['adopte'], order: 'adopted', limit, offset }));
  },

  countAdopted() {
    return animalRepository.count({ publishedOnly: true, statuses: ['adopte'] });
  },

  async countsBySpecies() {
    const rows = await animalRepository.countBySpecies(PUBLIC_STATUSES);
    return Object.fromEntries(Object.keys(SPECIES).map((species) => [species, rows.find((row) => row.species === species)?.total || 0]));
  },

  async getPublic(slug, { allowUnpublished = false } = {}) {
    const animal = await animalRepository.findBySlug(slug);
    if (!animal || (!animal.published && !allowUnpublished)) throw new NotFoundError('Cet animal n’est plus en ligne.');
    return decorateOne(animal);
  },

  /** Public animal by id, or null (used to link a contact message to an animal). */
  async findPublicById(id) {
    const animal = id ? await animalRepository.findById(id) : null;
    return animal && animal.published ? decorateOne(animal) : null;
  },

  async siblings(animal, limit = 3) {
    const list = await animalRepository.list({ publishedOnly: true, statuses: PUBLIC_STATUSES, species: animal.species, order: 'urgent', limit: limit + 1 });
    return decorateMany(list.filter((item) => item.id !== animal.id).slice(0, limit));
  },

  // Back office

  listAdmin(filters = {}) {
    return decorateMany(animalRepository.list({ ...filters, order: filters.order || 'updated' }));
  },

  async getById(id) {
    const animal = await animalRepository.findById(id);
    if (!animal) throw new NotFoundError('Animal introuvable.');
    return decorateOne(animal);
  },

  async stats() {
    const [available, reserved, adopted] = await Promise.all([
      animalRepository.count({ statuses: ['disponible'] }),
      animalRepository.count({ statuses: ['reserve'] }),
      animalRepository.count({ statuses: ['adopte'] }),
    ]);
    return { available, reserved, adopted };
  },

  /** Photos are processed first so an invalid file never leaves a half-created animal. */
  async create(data, files = []) {
    const saved = [];
    for (const file of files) saved.push(await saveImage(file.buffer, 'animal'));
    // Two volunteers creating the same name at once may pick the same slug: retry on the unique constraint.
    let id;
    for (let attempt = 0; !id; attempt += 1) {
      const slug = await findUniqueSlug(data.name, (candidate) => animalRepository.slugExists(candidate));
      try {
        id = await transaction(async (tx) => {
          const newId = await animalRepository.create({ ...data, slug, adopted_at: data.status === 'adopte' ? today() : null }, tx);
          for (const photo of saved) await animalRepository.addPhoto(newId, photo, tx);
          return newId;
        });
      } catch (error) {
        if (attempt >= 3 || !/UNIQUE constraint failed: animals\.slug/.test(error.message)) throw error;
      }
    }
    logger.info('animal.created', { id });
    return id;
  },

  async update(id, data) {
    const current = await this.getById(id);
    // A record saved by a volunteer is no longer example content.
    const patch = { ...data, example: 0 };
    if (data.name && data.name !== current.name) {
      patch.slug = await findUniqueSlug(data.name, (candidate) => animalRepository.slugExists(candidate, id));
    }
    if (data.status === 'adopte' && current.status !== 'adopte') patch.adopted_at = today();
    if (data.status && data.status !== 'adopte') patch.adopted_at = null;
    await animalRepository.update(id, patch);
    logger.info('animal.updated', { id });
  },

  setStatus(id, status) {
    return this.update(id, { status });
  },

  async delete(id) {
    const animal = await this.getById(id);
    await transaction((tx) => animalRepository.delete(id, tx));
    for (const photo of animal.photos) await deleteImage(photo.filename);
    logger.info('animal.deleted', { id });
  },

  async addPhotos(id, files) {
    await this.getById(id);
    for (const file of files) {
      const saved = await saveImage(file.buffer, 'animal');
      await animalRepository.addPhoto(id, saved);
    }
  },

  async deletePhoto(animalId, photoId) {
    const photo = await animalRepository.findPhoto(photoId);
    if (!photo || photo.animal_id !== animalId) throw new NotFoundError('Photo introuvable.');
    await animalRepository.deletePhoto(photoId);
    await deleteImage(photo.filename);
  },

  /** Moves a photo to the first position, making it the cover. */
  async makeCover(animalId, photoId) {
    const photos = await animalRepository.photos(animalId);
    if (!photos.some((photo) => photo.id === photoId)) throw new NotFoundError('Photo introuvable.');
    const ordered = [photos.find((photo) => photo.id === photoId), ...photos.filter((photo) => photo.id !== photoId)];
    await transaction(async (tx) => {
      for (const [index, photo] of ordered.entries()) await animalRepository.setPhotoPosition(photo.id, index, tx);
    });
  },
};
