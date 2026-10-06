import { passwordChangeSchema, userSchema, validate } from '../../schemas/index.js';
import { userService } from '../../services/userService.js';
import { ValidationError } from '../../utils/errors.js';
import { formAction, idParam } from './helpers.js';

export async function list(req, res) {
  res.render('admin/users/list.njk', { users: await userService.list() });
}

function renderForm(req, res, { values, errors = {}, account = null }) {
  res.render('admin/users/form.njk', { values, errors, account });
}

export function newForm(req, res) {
  renderForm(req, res, { values: { role: 'editor' } });
}

export const create = formAction(
  async (req, res) => {
    const data = validate(userSchema, req.body);
    if (!data.password) throw new ValidationError({ password: 'Choisissez un mot de passe provisoire (10 caractères minimum).' });
    await userService.create(data);
    req.flash('success', `Compte créé pour ${data.name}. Transmettez-lui son mot de passe provisoire.`);
    res.redirect(303, '/admin/comptes');
  },
  (req, res, state) => renderForm(req, res, state),
);

export async function editForm(req, res) {
  const account = await userService.getById(idParam(req));
  renderForm(req, res, { values: account, account });
}

export const update = formAction(
  async (req, res) => {
    const data = validate(userSchema, req.body);
    await userService.update(idParam(req), data, req.user);
    req.flash('success', 'Compte mis à jour.');
    res.redirect(303, '/admin/comptes');
  },
  async (req, res, state) => renderForm(req, res, { ...state, account: await userService.getById(idParam(req)) }),
);

export async function remove(req, res) {
  await userService.delete(idParam(req), req.user);
  req.flash('success', 'Compte supprimé.');
  res.redirect(303, '/admin/comptes');
}

export function accountForm(req, res) {
  res.render('admin/users/account.njk', { errors: {} });
}

export const changePassword = formAction(
  async (req, res) => {
    const data = validate(passwordChangeSchema, req.body);
    await userService.changeOwnPassword(req.user.id, data.current, data.password);
    req.flash('success', 'Mot de passe modifié.');
    res.redirect(303, '/admin/mon-compte');
  },
  (req, res, state) => res.render('admin/users/account.njk', state),
);
