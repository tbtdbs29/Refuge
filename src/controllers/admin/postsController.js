import { postSchema, validate } from '../../schemas/index.js';
import { postService } from '../../services/postService.js';
import { nowWallClock } from '../../utils/format.js';
import { formAction, idParam } from './helpers.js';

export async function list(req, res) {
  res.render('admin/posts/list.njk', { posts: await postService.listAdmin() });
}

function renderForm(req, res, { values, errors = {}, post = null }) {
  res.render('admin/posts/form.njk', { values, errors, post });
}

export function newForm(req, res) {
  renderForm(req, res, { values: { category: 'vie', published: 1, published_at: nowWallClock() } });
}

export const create = formAction(
  async (req, res) => {
    const data = validate(postSchema, req.body);
    const id = await postService.create(data, req.file);
    req.flash('success', data.published ? 'Article publié.' : 'Brouillon enregistré.');
    res.redirect(303, `/admin/actualites/${id}`);
  },
  (req, res, state) => renderForm(req, res, state),
);

export async function editForm(req, res) {
  const post = await postService.getById(idParam(req));
  renderForm(req, res, { values: post, post });
}

export const update = formAction(
  async (req, res) => {
    const id = idParam(req);
    const data = validate(postSchema, req.body);
    await postService.update(id, data, req.file, { removeCover: req.body.remove_cover === 'on' });
    req.flash('success', 'Article mis à jour.');
    res.redirect(303, `/admin/actualites/${id}`);
  },
  async (req, res, state) => renderForm(req, res, { ...state, post: await postService.getById(idParam(req)) }),
);

export async function remove(req, res) {
  await postService.delete(idParam(req));
  req.flash('success', 'Article supprimé.');
  res.redirect(303, '/admin/actualites');
}
