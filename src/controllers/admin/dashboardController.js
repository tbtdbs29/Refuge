import { animalService } from '../../services/animalService.js';
import { eventService } from '../../services/eventService.js';
import { messageService } from '../../services/messageService.js';
import { postService } from '../../services/postService.js';

export function dashboard(req, res) {
  const animals = animalService.listAdmin({ statuses: ['disponible', 'reserve'] });
  res.render('admin/dashboard.njk', {
    stats: animalService.stats(),
    messages: messageService.list('nouveau').slice(0, 5),
    messageCounts: messageService.counts(),
    events: eventService.upcoming(5, { publicOnly: false }),
    withoutPhoto: animals.filter((animal) => !animal.cover).slice(0, 6),
    urgent: animals.filter((animal) => animal.urgent),
    recentPosts: postService.listAdmin().slice(0, 3),
  });
}
