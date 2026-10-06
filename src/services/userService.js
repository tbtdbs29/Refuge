import { userRepository } from '../repositories/userRepository.js';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';

// Computed once so failed logins on unknown emails cost the same time as real ones.
const DUMMY_HASH = hashPassword('timing-equalizer');

export const userService = {
  authenticate(email, password) {
    const user = userRepository.findWithHashByEmail(email.trim());
    const valid = verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !valid) {
      logger.warn('auth.failed');
      return null;
    }
    userRepository.touchLogin(user.id);
    logger.info('auth.success', { userId: user.id });
    return userRepository.findById(user.id);
  },

  findById(id) {
    return userRepository.findById(id);
  },

  list() {
    return userRepository.list();
  },

  getById(id) {
    const user = userRepository.findById(id);
    if (!user) throw new NotFoundError('Compte introuvable.');
    return user;
  },

  hasUsers() {
    return userRepository.count() > 0;
  },

  create({ name, email, password, role }) {
    if (userRepository.emailExists(email)) throw new ValidationError({ email: 'Un compte utilise déjà cet email.' });
    const id = userRepository.create({ name, email, role, passwordHash: hashPassword(password) });
    logger.info('user.created', { id, role });
    return id;
  },

  update(id, { name, email, role, password }, actor) {
    const user = this.getById(id);
    if (userRepository.emailExists(email, id)) throw new ValidationError({ email: 'Un compte utilise déjà cet email.' });
    if (user.role === 'admin' && role !== 'admin' && userRepository.countAdmins() <= 1) {
      throw new ValidationError({ role: 'Il doit rester au moins un administrateur.' });
    }
    if (actor.id === id && role !== actor.role) throw new ForbiddenError('Vous ne pouvez pas changer votre propre rôle.');
    userRepository.update(id, { name, email, role });
    if (password) userRepository.setPassword(id, hashPassword(password));
    logger.info('user.updated', { id });
  },

  changeOwnPassword(id, currentPassword, newPassword) {
    if (!verifyPassword(currentPassword, userRepository.findHashById(id))) {
      throw new ValidationError({ current: 'Mot de passe actuel incorrect.' });
    }
    userRepository.setPassword(id, hashPassword(newPassword));
    logger.info('user.password_changed', { id });
  },

  delete(id, actor) {
    const user = this.getById(id);
    if (actor.id === id) throw new AppError('Vous ne pouvez pas supprimer votre propre compte.', { status: 400, code: 'SELF_DELETE' });
    if (user.role === 'admin' && userRepository.countAdmins() <= 1) {
      throw new AppError('Il doit rester au moins un administrateur.', { status: 400, code: 'LAST_ADMIN' });
    }
    userRepository.delete(id);
    logger.info('user.deleted', { id });
  },
};
