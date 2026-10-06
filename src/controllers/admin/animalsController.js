import { animalSchema, validate } from '../../schemas/index.js';
import { animalService } from '../../services/animalService.js';
import { formAction, idParam } from './helpers.js';

const DEFAULTS = { species: 'chien', sex: 'inconnu', ok_dogs: 'a_tester', ok_cats: 'a_tester', ok_kids: 'a_tester', housing: 'maison', status: 'disponible', published: 1, backdrop: 'ajonc' };

export function list(req, res) {
  const status = ['disponible', 'reserve', 'adopte'].includes(req.query.statut) ? req.query.statut : '';
  const species = ['chien', 'chat', 'nac', 'ferme'].includes(req.query.espece) ? req.query.espece : '';
  const search = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';
  res.render('admin/animals/list.njk', {
    animals: animalService.listAdmin({ statuses: status ? [status] : undefined, species: species || undefined, search: search || undefined }),
    filters: { status, species, search },
    stats: animalService.stats(),
  });
}

function renderForm(req, res, { values, errors = {}, animal = null }) {
  res.render('admin/animals/form.njk', { values, errors, animal });
}

export function newForm(req, res) {
  renderForm(req, res, { values: { ...DEFAULTS, species: req.query.espece || DEFAULTS.species } });
}

export const create = formAction(
  async (req, res) => {
    const data = validate(animalSchema, req.body);
    const id = await animalService.create(data, req.files || []);
    req.flash('success', `${data.name} est enregistré${data.sex === 'femelle' ? 'e' : ''}.`);
    res.redirect(303, `/admin/animaux/${id}`);
  },
  (req, res, state) => renderForm(req, res, state),
);

export function editForm(req, res) {
  const animal = animalService.getById(idParam(req));
  renderForm(req, res, { values: animal, animal });
}

export const update = formAction(
  async (req, res) => {
    const id = idParam(req);
    const data = validate(animalSchema, req.body);
    if (req.files?.length) await animalService.addPhotos(id, req.files);
    animalService.update(id, data);
    req.flash('success', 'Fiche mise à jour.');
    res.redirect(303, `/admin/animaux/${id}`);
  },
  (req, res, state) => renderForm(req, res, { ...state, animal: animalService.getById(idParam(req)) }),
);

export function setStatus(req, res) {
  const id = idParam(req);
  const status = ['disponible', 'reserve', 'adopte'].includes(req.body.status) ? req.body.status : null;
  if (status) {
    animalService.setStatus(id, status);
    req.flash('success', status === 'adopte' ? 'Bravo ! L’animal rejoint l’album des adoptés.' : 'Statut mis à jour.');
  }
  res.redirect(303, req.body.back === 'list' ? '/admin/animaux' : `/admin/animaux/${id}`);
}

export async function remove(req, res) {
  const animal = animalService.getById(idParam(req));
  await animalService.delete(animal.id);
  req.flash('success', `La fiche de ${animal.name} a été supprimée.`);
  res.redirect(303, '/admin/animaux');
}

export async function removePhoto(req, res) {
  const id = idParam(req);
  await animalService.deletePhoto(id, idParam(req, 'photoId'));
  req.flash('success', 'Photo supprimée.');
  res.redirect(303, `/admin/animaux/${id}#photos`);
}

export function makeCover(req, res) {
  const id = idParam(req);
  animalService.makeCover(id, idParam(req, 'photoId'));
  req.flash('success', 'Photo principale changée.');
  res.redirect(303, `/admin/animaux/${id}#photos`);
}
