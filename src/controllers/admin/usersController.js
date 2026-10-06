import { passwordChangeSchema, userSchema, validate } from '../../schemas/index.js';
import { userService } from '../../services/userService.js';
import { ValidationError } from '../../utils/errors.js';
import { formAction, idParam } from './helpers.js';

export function list(req, res) {
  res.render('admin/users/list.njk', { users: userService.list() });
}

function renderForm(req, res, { values, errors = {}, account = null }) {
  res.render('admin/users/form.njk', { values, errors, account });
}

export function newForm(req, res) {
  renderForm(req, res, { values: { role: 'editor' } });
}

export const create = formAction(
  (req, res) => {
    const data = validate(userSchema, req.body);
    if (!data.password) throw new ValidationError({ password: 'Choisissez un mot de passe provisoire (10 caractères minimum).' });
    userService.create(data);
    req.flash('success', `Compte créé pour ${data.name}. Transmettez-lui son mot de passe provisoire.`);
    res.redirect(303, '/admin/comptes');
  },
  (req, res, state) => renderForm(req, res, state),
);

export function editForm(req, res) {
  const account = userService.getById(idParam(req));
  renderForm(req, res, { values: account, account });
}

export const update = formAction(
  (req, res) => {
    const data = validate(userSchema, req.body);
    userService.update(idParam(req), data, req.user);
    req.flash('success', 'Compte mis à jour.');
    res.redirect(303, '/admin/comptes');
  },
  (req, res, state) => renderForm(req, res, { ...state, account: userService.getById(idParam(req)) }),
);

export function remove(req, res) {
  userService.delete(idParam(req), req.user);
  req.flash('success', 'Compte supprimé.');
  res.redirect(303, '/admin/comptes');
}

export function accountForm(req, res) {
  res.render('admin/users/account.njk', { errors: {} });
}

export const changePassword = formAction(
  (req, res) => {
    const data = validate(passwordChangeSchema, req.body);
    userService.changeOwnPassword(req.user.id, data.current, data.password);
    req.flash('success', 'Mot de passe modifié.');
    res.redirect(303, '/admin/mon-compte');
  },
  (req, res, state) => res.render('admin/users/account.njk', state),
);
