import { Router } from 'express';
import * as pages from '../controllers/public/pagesController.js';
import { rateLimit } from '../middlewares/security.js';

export const publicRouter = Router();

const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: 'Trop de messages envoyés. Réessayez un peu plus tard ou appelez-nous.' });

publicRouter.get('/', pages.home);
publicRouter.get('/animaux', pages.animals);
publicRouter.get('/animaux/:slug', pages.animal);
publicRouter.get('/adoptes', pages.adopted);
publicRouter.get('/adopter', pages.adopt);
publicRouter.get('/aider', pages.help);
publicRouter.get('/agenda', pages.agenda);
publicRouter.get('/agenda.ics', pages.agendaFeed);
publicRouter.get('/agenda/:id.ics', pages.agendaEventIcs);
publicRouter.get('/agenda/:id', pages.agendaEvent);
publicRouter.get('/actualites', pages.news);
publicRouter.get('/actualites/:slug', pages.newsPost);
publicRouter.get('/contact', pages.contact);
publicRouter.post('/contact', contactLimiter, pages.contactSubmit);
publicRouter.get('/mentions-legales', pages.legal);
publicRouter.get('/robots.txt', pages.robots);
publicRouter.get('/sitemap.xml', pages.sitemap);

// Former blog category URLs keep working.
publicRouter.get(['/chiens', '/chats', '/nac', '/ferme'], (req, res) => res.redirect(301, `/animaux?espece=${req.path.slice(1)}`));
