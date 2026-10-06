import { Router } from 'express';
import * as animals from '../controllers/admin/animalsController.js';
import * as auth from '../controllers/admin/authController.js';
import { dashboard } from '../controllers/admin/dashboardController.js';
import * as events from '../controllers/admin/eventsController.js';
import * as messages from '../controllers/admin/messagesController.js';
import * as posts from '../controllers/admin/postsController.js';
import * as settings from '../controllers/admin/settingsController.js';
import * as users from '../controllers/admin/usersController.js';
import { requireAdmin, requireAuth } from '../middlewares/auth.js';
import { rateLimit } from '../middlewares/security.js';
import { uploadCover, uploadPhotos } from '../middlewares/upload.js';
import { messageService } from '../services/messageService.js';

export const adminRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: 'Trop de tentatives de connexion. Patientez 15 minutes.' });

adminRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  next();
});

adminRouter.get('/connexion', auth.loginForm);
adminRouter.post('/connexion', loginLimiter, auth.login);
adminRouter.get('/installation', auth.setupForm);
adminRouter.post('/installation', loginLimiter, auth.setup);

adminRouter.use(requireAuth);
adminRouter.use(async (req, res, next) => {
  res.locals.unreadMessages = (await messageService.counts()).nouveau;
  next();
});

adminRouter.post('/deconnexion', auth.logout);
adminRouter.get('/', dashboard);

adminRouter.get('/animaux', animals.list);
adminRouter.get('/animaux/nouveau', animals.newForm);
adminRouter.post('/animaux', uploadPhotos, animals.create);
adminRouter.get('/animaux/:id', animals.editForm);
adminRouter.post('/animaux/:id', uploadPhotos, animals.update);
adminRouter.post('/animaux/:id/statut', animals.setStatus);
adminRouter.post('/animaux/:id/supprimer', animals.remove);
adminRouter.post('/animaux/:id/photos/:photoId/supprimer', animals.removePhoto);
adminRouter.post('/animaux/:id/photos/:photoId/couverture', animals.makeCover);

adminRouter.get('/agenda', events.calendar);
adminRouter.get('/agenda/nouveau', events.newForm);
adminRouter.post('/agenda', events.create);
adminRouter.get('/agenda/:id', events.editForm);
adminRouter.post('/agenda/:id', events.update);
adminRouter.post('/agenda/:id/supprimer', events.remove);

adminRouter.get('/actualites', posts.list);
adminRouter.get('/actualites/nouveau', posts.newForm);
adminRouter.post('/actualites', uploadCover, posts.create);
adminRouter.get('/actualites/:id', posts.editForm);
adminRouter.post('/actualites/:id', uploadCover, posts.update);
adminRouter.post('/actualites/:id/supprimer', posts.remove);

adminRouter.get('/messages', messages.list);
adminRouter.get('/messages/:id', messages.show);
adminRouter.post('/messages/:id/statut', messages.setStatus);
adminRouter.post('/messages/:id/supprimer', messages.remove);

adminRouter.get('/reglages', settings.show);
adminRouter.post('/reglages/:section', settings.update);

adminRouter.get('/mon-compte', users.accountForm);
adminRouter.post('/mon-compte', users.changePassword);

adminRouter.get('/comptes', requireAdmin, users.list);
adminRouter.get('/comptes/nouveau', requireAdmin, users.newForm);
adminRouter.post('/comptes', requireAdmin, users.create);
adminRouter.get('/comptes/:id', requireAdmin, users.editForm);
adminRouter.post('/comptes/:id', requireAdmin, users.update);
adminRouter.post('/comptes/:id/supprimer', requireAdmin, users.remove);
