import { loginSchema, userSchema, validate } from '../../schemas/index.js';
import { userService } from '../../services/userService.js';
import { ValidationError } from '../../utils/errors.js';

function safeRedirect(target) {
  return typeof target === 'string' && /^\/admin(\/|$|\?)/.test(target) ? target : '/admin';
}

export function loginForm(req, res) {
  if (req.user) return res.redirect('/admin');
  if (!userService.hasUsers()) return res.redirect('/admin/installation');
  res.render('admin/login.njk', { values: {}, errors: {}, next: safeRedirect(req.query.suite) });
}

export function login(req, res) {
  const next = safeRedirect(req.body.next);
  try {
    const { email, password } = validate(loginSchema, req.body);
    const user = userService.authenticate(email, password);
    if (!user) throw new ValidationError({ form: 'Email ou mot de passe incorrect.' });
    req.session.userId = user.id;
    req.session.csrf = null;
    res.redirect(303, next);
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    res.status(422).render('admin/login.njk', { values: { email: req.body.email }, errors: error.details, next });
  }
}

export function logout(req, res) {
  req.session = null;
  res.redirect(303, '/admin/connexion');
}

/** First-run setup: only available while no account exists. */
export function setupForm(req, res) {
  if (userService.hasUsers()) return res.redirect('/admin/connexion');
  res.render('admin/setup.njk', { values: {}, errors: {} });
}

export function setup(req, res) {
  if (userService.hasUsers()) return res.redirect('/admin/connexion');
  try {
    const data = validate(userSchema, { ...req.body, role: 'admin' });
    if (!data.password) throw new ValidationError({ password: 'Choisissez un mot de passe (10 caractères minimum).' });
    const id = userService.create(data);
    req.session.userId = id;
    req.flash('success', 'Bienvenue ! Votre compte administrateur est créé.');
    res.redirect(303, '/admin');
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    res.status(422).render('admin/setup.njk', { values: req.body, errors: error.details });
  }
}
