import { animalService } from '../../services/animalService.js';
import { eventService } from '../../services/eventService.js';
import { messageService } from '../../services/messageService.js';

export async function dashboard(req, res) {
  const [animals, stats, messages, messageCounts, events] = await Promise.all([
    animalService.listAdmin({ statuses: ['disponible', 'reserve'] }),
    animalService.stats(),
    messageService.list('nouveau'),
    messageService.counts(),
    eventService.upcoming(5, { publicOnly: false }),
  ]);
  res.render('admin/dashboard.njk', {
    stats,
    messages: messages.slice(0, 5),
    messageCounts,
    events,
    withoutPhoto: animals.filter((animal) => !animal.cover).slice(0, 6),
  });
}
