// Loads example content (fictional animals, events and news) into an empty database.
// Usage: npm run seed            (refuses if animals already exist)
//        npm run seed -- --force (wipes animals, events, posts and messages first)
import { closeDb, getDb, transaction } from './index.js';
import { animalService } from '../services/animalService.js';
import { eventRepository } from '../repositories/eventRepository.js';
import { postService } from '../services/postService.js';
import { nowWallClock } from '../utils/format.js';

const base = {
  breed: '', age_label: '', identification: '', foster_note: '', fee_label: '',
  vaccinated: 1, dewormed: 1, sterilized: 1, example: 1, urgent: 0, featured: 0, published: 1, status: 'disponible',
  ok_dogs: 'a_tester', ok_cats: 'a_tester', ok_kids: 'a_tester', housing: 'maison',
};

const ANIMALS = [
  { name: 'Biscotte', species: 'chien', sex: 'femelle', breed: 'Croisée épagneul', birth_date: '2021-04-02', backdrop: 'ajonc', featured: 1,
    ok_dogs: 'oui', ok_cats: 'non', ok_kids: 'oui', housing: 'jardin_clos',
    tagline: 'Une boule d’énergie qui adore les balades en forêt et les câlins du soir.',
    description: 'Biscotte est arrivée au refuge après le décès de sa propriétaire. C’est une chienne joyeuse, très attachée à l’humain, qui apprend vite.\n\nElle s’entend bien avec les chiens calmes mais poursuit les chats : pas de minou à la maison. Un jardin clos est indispensable, elle sait sauter !\n\n- Marche bien en laisse\n- Connaît « assis » et « couché »\n- Supporte quelques heures de solitude' },
  { name: 'Gribouille', species: 'chien', sex: 'male', breed: 'Beagle', birth_date: '2019-05-19', backdrop: 'ciel', featured: 1,
    ok_dogs: 'oui', ok_cats: 'oui', ok_kids: 'grands', housing: 'jardin_clos',
    tagline: 'Un nez de détective et une voix de ténor : maison avec jardin exigée.',
    description: 'Gribouille n’a connu que le chenil. Il découvre le confort d’un panier et adore ça. Sociable, un peu réservé au départ, il se détend vite avec des friandises.\n\nComme beaucoup de beagles, il donne de la voix : pas d’appartement. Terrain clos obligatoire, il suit les pistes sans regarder derrière lui.' },
  { name: 'Moka', species: 'chien', sex: 'male', breed: 'Berger croisé', birth_date: '2015-08-24', backdrop: 'bruyere', urgent: 1, featured: 1,
    ok_dogs: 'oui', ok_cats: 'a_tester', ok_kids: 'oui', housing: 'maison',
    tagline: 'Papy tranquille cherche coussin moelleux pour ses vieux jours.',
    description: 'Moka a passé toute sa vie dans la même famille, qui ne pouvait plus le garder. À 11 ans, il est doux, propre et calme. Il marche à son rythme et dort beaucoup.\n\nIl bénéficie du **contrat doyen** : frais d’adoption réduits. Il lui faut une maison de plain-pied, ses hanches n’aiment plus les escaliers.' },
  { name: 'Pistache', species: 'chien', sex: 'femelle', breed: 'Croisée basset', birth_date: '2026-06-01', backdrop: 'fougere', featured: 1, sterilized: 0,
    ok_dogs: 'oui', ok_cats: 'oui', ok_kids: 'oui', housing: 'maison',
    tagline: 'Des oreilles qui traînent par terre et un cœur gros comme ça.',
    description: 'Pistache fait partie d’une portée de chiots nés au refuge. Curieuse, gourmande et câline, elle a tout à apprendre : il faudra du temps et de la patience pour l’éducation.\n\nLa stérilisation est obligatoire et reste à la charge de l’adoptant.' },
  { name: 'Hercule', species: 'chien', sex: 'male', breed: 'Malinois x boxer', birth_date: '2022-06-15', backdrop: 'ecume', status: 'reserve',
    ok_dogs: 'a_tester', ok_cats: 'non', ok_kids: 'grands', housing: 'jardin_clos',
    tagline: 'Sportif cherche maître actif pour partager footings et jeux de balle.',
    description: 'Hercule déborde d’énergie. Il a besoin de longues promenades et d’activités pour se dépenser : canicross, jeux de flair, obéissance.\n\nAdoptant expérimenté souhaité. Pas de chat.' },
  { name: 'Caramel', species: 'chat', sex: 'male', birth_date: '2022-03-10', backdrop: 'ecume', featured: 1,
    ok_dogs: 'oui', ok_cats: 'oui', ok_kids: 'oui', housing: 'appartement', foster_note: 'chez Annick, Plouédern',
    tagline: 'Pot de colle certifié : ronronne dès qu’on le regarde.',
    description: 'Caramel a été trouvé errant, très maigre. Il a repris des forces en famille d’accueil et s’est révélé d’une gentillesse rare. Il vit avec des chats, un chien et des enfants : tout lui va.\n\nIl peut vivre en appartement s’il a de quoi grimper et jouer.' },
  { name: 'Plume', species: 'chat', sex: 'femelle', birth_date: '2024-04-15', backdrop: 'bruyere',
    ok_dogs: 'non', ok_cats: 'oui', ok_kids: 'grands', housing: 'maison', foster_note: 'chez Éric et Fabienne',
    tagline: 'Timide au début, puis la plus douce des compagnes.',
    description: 'Plume est née dehors d’une maman craintive. Elle a appris à faire confiance à l’humain, doucement. Il lui faut un foyer calme, sans chien ni jeunes enfants.\n\nUn autre chat sociable l’aiderait à prendre ses marques.' },
  { name: 'Mistigri et Filou', species: 'chat', sex: 'groupe', birth_date: '2026-06-10', backdrop: 'ajonc', sterilized: 0,
    ok_dogs: 'a_tester', ok_cats: 'oui', ok_kids: 'oui', housing: 'appartement', foster_note: 'chez Maëlle, Landerneau',
    tagline: 'Deux frères farceurs, à adopter ensemble pour doubler la joie.',
    description: 'Mistigri et Filou sont inséparables : ils jouent, dorment et font des bêtises en duo. Nous souhaitons qu’ils soient adoptés ensemble.\n\nStérilisation obligatoire à leurs 6 mois, à la charge de l’adoptant.' },
  { name: 'Nuage', species: 'chat', sex: 'femelle', birth_date: '2013-01-20', backdrop: 'ciel', urgent: 1,
    ok_dogs: 'non', ok_cats: 'a_tester', ok_kids: 'grands', housing: 'appartement', foster_note: 'chez Sylvie, Daoulas',
    tagline: 'Mamie chatte en quête d’un rebord de fenêtre ensoleillé.',
    description: 'Nuage a 13 ans et ne demande qu’un plaid et des caresses. Elle a un léger souci de reins, suivi par une alimentation adaptée.\n\nElle bénéficie du **contrat doyen**.' },
  { name: 'Réglisse', species: 'chat', sex: 'male', birth_date: '2023-09-01', backdrop: 'fougere',
    ok_dogs: 'oui', ok_cats: 'oui', ok_kids: 'oui', housing: 'maison', foster_note: 'chez Annick, Plouédern',
    tagline: 'Panthère miniature, grand chasseur de bouchons.',
    description: 'Réglisse est un chat noir très joueur, qui aime l’extérieur. Il s’entend avec tout le monde. Un accès sécurisé à un jardin serait idéal.' },
  { name: 'Noisette', species: 'nac', sex: 'femelle', breed: 'Lapine bélier', birth_date: '2024-02-01', backdrop: 'corail',
    ok_dogs: 'a_tester', ok_cats: 'a_tester', ok_kids: 'grands', housing: 'appartement', fee_label: '130 €',
    tagline: 'Petite lapine curieuse, adore les fanes de carottes.',
    description: 'Noisette est stérilisée et vaccinée. Elle a besoin d’espace pour courir chaque jour : pas de cage fermée toute la journée.' },
  { name: 'Flocon', species: 'nac', sex: 'male', breed: 'Lapin nain', birth_date: '2025-03-01', backdrop: 'ciel',
    ok_dogs: 'a_tester', ok_cats: 'a_tester', ok_kids: 'grands', housing: 'appartement', fee_label: '80 €',
    tagline: 'Un nuage de poils qui fait des bonds de joie.',
    description: 'Flocon est castré et vacciné. Il serait heureux avec une lapine compagne.' },
  { name: 'Biquette et Cabri', species: 'ferme', sex: 'groupe', breed: 'Chèvres semi-naines', birth_date: '2023-05-01', backdrop: 'fougere', featured: 0,
    ok_dogs: 'a_tester', ok_cats: 'oui', ok_kids: 'oui', housing: 'exterieur', fee_label: 'Nous consulter',
    tagline: 'Deux copines à adopter ensemble, pour entretenir votre pré.',
    description: 'Biquette et Cabri ont besoin d’un pré bien clôturé et d’un abri. Elles sont habituées à la main et viennent quand on les appelle.' },
  { name: 'Moutons d’Ouessant', species: 'ferme', sex: 'groupe', breed: 'Mouton d’Ouessant', backdrop: 'ajonc', age_label: '2 à 6 ans',
    ok_dogs: 'a_tester', ok_cats: 'oui', ok_kids: 'oui', housing: 'exterieur', fee_label: 'Nous consulter',
    tagline: 'Le plus petit mouton du monde cherche des pâturages bretons.',
    description: 'Un petit troupeau de moutons d’Ouessant (béliers et brebis) cherche des adoptants, par deux minimum. Pré clos et abri indispensables.' },
];

const ADOPTED = [
  { name: 'Pirouette', species: 'chat', sex: 'femelle', birth_date: '2023-05-01', backdrop: 'bruyere', adopted: '2026-09-28' },
  { name: 'Gaston', species: 'chien', sex: 'male', birth_date: '2020-02-01', backdrop: 'ajonc', adopted: '2026-09-21' },
  { name: 'Lulu', species: 'chien', sex: 'femelle', birth_date: '2024-11-01', backdrop: 'ecume', adopted: '2026-09-14' },
  { name: 'Oscar', species: 'chat', sex: 'male', birth_date: '2021-07-01', backdrop: 'ciel', adopted: '2026-09-02' },
  { name: 'Zélie', species: 'nac', sex: 'femelle', birth_date: '2024-01-01', backdrop: 'corail', adopted: '2026-08-25' },
  { name: 'Tango', species: 'chien', sex: 'male', birth_date: '2018-03-01', backdrop: 'fougere', adopted: '2026-08-12' },
];

function shiftDays(days, time) {
  const date = new Date(`${nowWallClock().slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.toISOString().slice(0, 10)}T${time}`;
}

const EVENTS = [
  { title: 'Journée d’adoption chats', category: 'adoption', starts_at: shiftDays(5, '10:00'), ends_at: shiftDays(5, '17:00'), location: 'Galerie commerciale, Landerneau',
    description: 'Venez rencontrer une partie de nos chats et leurs familles d’accueil. Pensez à apporter votre certificat d’engagement si vous l’avez déjà signé.' },
  { title: 'Visite du vétérinaire', category: 'autre', visibility: 'interne', starts_at: shiftDays(3, '09:00'), ends_at: shiftDays(3, '11:00'), location: 'Refuge',
    description: 'Vaccins et contrôles de la semaine. Prévoir deux bénévoles pour la contention.' },
  { title: 'Grande collecte de croquettes', category: 'collecte', starts_at: shiftDays(12, '09:00'), ends_at: shiftDays(13, '18:00'), location: 'Supermarché de Landerneau',
    description: 'Nos bénévoles seront à l’entrée du magasin. Croquettes, pâtées, litière : tout est bienvenu !' },
  { title: 'Matinée promenade des bénévoles', category: 'benevoles', starts_at: shiftDays(19, '10:00'), ends_at: shiftDays(19, '12:00'), location: 'Refuge',
    description: 'Nouveaux bénévoles bienvenus : nous vous présentons les chiens et les consignes de promenade.' },
  { title: 'Fermeture exceptionnelle l’après-midi', category: 'fermeture', all_day: 0, starts_at: shiftDays(26, '14:00'), ends_at: shiftDays(26, '17:30'), location: 'Refuge',
    description: 'Le refuge sera fermé au public l’après-midi. Ouverture normale le matin.' },
];

const POSTS = [
  { title: 'Bienvenue sur notre nouveau site', category: 'vie', published_at: shiftDays(-1, '09:00'),
    body: 'Le refuge fait peau neuve ! Retrouvez tous nos animaux à l’adoption, notre agenda et toutes les façons de nous aider.\n\nChaque animal a désormais sa planche : en un coup d’œil, vous savez s’il s’entend avec les chats, les chiens et les enfants.\n\nBonne visite, et merci de partager !' },
  { title: 'L’hiver arrive : nous manquons de gamelles en inox', category: 'appel', published_at: shiftDays(-6, '18:00'),
    body: 'Les gamelles en plastique ne résistent pas longtemps aux dents de nos pensionnaires. Si vous avez des gamelles en inox dont vous ne vous servez plus, déposez-les au refuge aux heures d’ouverture.\n\nNous recherchons aussi des couvertures pour les paniers des chiens.' },
  { title: 'Bien préparer l’arrivée d’un chat', category: 'conseil', published_at: shiftDays(-14, '10:00'),
    body: 'Les premiers jours comptent beaucoup. Quelques conseils pour que tout se passe bien :\n\n- Préparez une pièce calme avec litière, eau, nourriture et cachette\n- Laissez-le explorer à son rythme\n- Gardez-le à l’intérieur au moins trois semaines\n- Présentez les autres animaux progressivement\n\nUne question ? Appelez-nous, nous sommes là pour vous.' },
];

async function seed({ force }) {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) AS total FROM animals').get().total;
  if (existing && !force) {
    console.log('The database already contains animals. Use --force to replace the example content.');
    return;
  }
  transaction(() => {
    if (force) db.exec('DELETE FROM animal_photos; DELETE FROM animals; DELETE FROM events; DELETE FROM posts; DELETE FROM messages;');
  });
  for (const animal of ANIMALS) await animalService.create({ ...base, birth_date: null, ...animal });
  for (const animal of ADOPTED) {
    const id = await animalService.create({ ...base, ...animal, adopted: undefined, status: 'adopte', tagline: 'A trouvé une famille aimante.' });
    db.prepare('UPDATE animals SET adopted_at = ? WHERE id = ?').run(animal.adopted, id);
  }
  for (const event of EVENTS) eventRepository.create({ all_day: 0, visibility: 'public', example: 1, ...event });
  for (const post of POSTS) await postService.create({ excerpt: '', published: 1, example: 1, ...post });
  console.log(`Seeded ${ANIMALS.length + ADOPTED.length} animals, ${EVENTS.length} events, ${POSTS.length} posts.`);
}

await seed({ force: process.argv.includes('--force') });
closeDb();
