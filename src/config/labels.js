// User-facing labels for enumerated values stored in the database.

export const SPECIES = {
  chien: { label: 'Chien', plural: 'Chiens', path: 'chiens' },
  chat: { label: 'Chat', plural: 'Chats', path: 'chats' },
  nac: { label: 'NAC', plural: 'NAC & rongeurs', path: 'nac' },
  ferme: { label: 'Animal de ferme', plural: 'Animaux de ferme', path: 'ferme' },
};

export const SPECIES_BY_PATH = Object.fromEntries(Object.entries(SPECIES).map(([key, value]) => [value.path, key]));

export const SEX = {
  male: 'Mâle',
  femelle: 'Femelle',
  groupe: 'Fratrie / groupe',
  inconnu: 'Non précisé',
};

export const STATUS = {
  disponible: 'À l’adoption',
  reserve: 'Réservé',
  adopte: 'Adopté',
};

export const COMPAT = {
  oui: 'Oui',
  non: 'Non',
  a_tester: 'À tester',
  grands: 'Grands enfants',
};

export const HOUSING = {
  appartement: 'Appartement possible',
  maison: 'Maison',
  jardin_clos: 'Jardin clos',
  exterieur: 'Pré / extérieur',
};

// Short versions for the ruled caption under each plate.
export const HOUSING_SHORT = {
  appartement: 'Appart. OK',
  maison: 'Maison',
  jardin_clos: 'Jardin clos',
  exterieur: 'Pré',
};

// Flat painted backdrops for portrait plates, named after Breton landscapes.
export const BACKDROPS = {
  ajonc: { label: 'Ajonc', hex: '#E9B43C' },
  bruyere: { label: 'Bruyère', hex: '#D98FAE' },
  fougere: { label: 'Fougère', hex: '#7E9B5B' },
  ecume: { label: 'Écume', hex: '#9CCBC2' },
  ciel: { label: 'Ciel d’Elorn', hex: '#8FB3DE' },
  corail: { label: 'Goémon', hex: '#E58E6B' },
};

export const EVENT_CATEGORIES = {
  adoption: 'Journée d’adoption',
  kermesse: 'Kermesse',
  collecte: 'Collecte',
  benevoles: 'Bénévoles',
  fermeture: 'Fermeture',
  autre: 'Autre',
};

export const POST_CATEGORIES = {
  vie: 'Vie du refuge',
  appel: 'Appel à l’aide',
  conseil: 'Conseils',
  merci: 'Merci !',
};

export const MESSAGE_TOPICS = {
  adoption: 'Adoption',
  accueil: 'Famille d’accueil',
  benevolat: 'Bénévolat',
  don: 'Don / adhésion',
  abandon: 'Abandon / animal trouvé',
  autre: 'Autre question',
};

export const MESSAGE_STATUS = {
  nouveau: 'Nouveau',
  traite: 'Traité',
  archive: 'Archivé',
};

export const ROLES = {
  admin: 'Administrateur',
  editor: 'Éditeur',
};
