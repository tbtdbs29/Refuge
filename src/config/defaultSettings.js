// Initial shelter information, taken from the shelter's former website.
// Every value is editable from the back office (Réglages).

export const DEFAULT_SETTINGS = {
  shelter: {
    name: 'Refuge Animalier du Pays de Landerneau',
    shortName: 'Refuge de Landerneau',
    address: '8, rue Saint Ernel (ex rue du Calvaire)',
    postcode: '29800',
    city: 'Landerneau',
    phone: '02 98 21 57 27',
    email: 'refugedelanderneau@yahoo.fr',
    hours: 'Tous les jours, de 10 h à 12 h et de 14 h à 17 h 30',
    facebook: '',
    donationUrl: '',
    intro:
      'Depuis sa création, le refuge a trouvé un foyer à plus de 13 000 animaux. Chiens, chats, lapins, chèvres ou moutons : chacun est soigné, identifié et attend la famille qui lui correspond.',
  },
  banner: {
    enabled: false,
    text: '',
  },
  fees: {
    dogsIncluded:
      'Identification, primo-vaccin CHPPiL (et éventuellement toux du chenil), déparasitage interne et externe, certificat vétérinaire et stérilisation selon l’âge.',
    catsIncluded:
      'Identification, primo-vaccin typhus/coryza, déparasitage interne et externe, certificat vétérinaire et stérilisation selon l’âge.',
    dogs: [
      { key: 'jeune', label: 'Chiot jusqu’à 6 mois', price: 'à partir de 230 €', note: 'Stérilisation obligatoire, à la charge de l’adoptant' },
      { key: 'adulte', label: 'Chien de 6 mois à 7 ans révolus', price: 'à partir de 280 €', note: '' },
      { key: 'senior', label: 'Chien de 8 à 9 ans révolus', price: 'à partir de 200 €', note: '' },
      { key: 'doyen', label: 'Chien de plus de 10 ans', price: '50 €', note: 'Contrat doyen avec 30 Millions d’Amis' },
      { key: 'sos', label: 'Chien en SOS', price: '150 €', note: '' },
    ],
    cats: [
      { key: 'jeune', label: 'Chaton jusqu’à 6 mois', price: 'à partir de 130 €', note: 'Stérilisation obligatoire, à la charge de l’adoptant' },
      { key: 'adulte', label: 'Chat de 6 mois à 5 ans révolus', price: 'à partir de 190 €', note: '' },
      { key: 'senior', label: 'Chat de 6 à 9 ans révolus', price: 'à partir de 170 €', note: '' },
      { key: 'doyen', label: 'Chat de plus de 10 ans', price: '50 €', note: 'Contrat doyen avec 30 Millions d’Amis' },
      { key: 'sos', label: 'Chat en SOS', price: '100 €', note: '' },
    ],
    others: [
      { key: '', label: 'Lapin mâle castré', price: '80 €', note: '' },
      { key: '', label: 'Lapin femelle stérilisée', price: '130 €', note: '' },
      { key: '', label: 'Lapin non stérilisé', price: '40 €', note: '' },
      { key: '', label: 'Couple de lapins stérilisés', price: '200 €', note: '' },
      { key: '', label: 'Cochon d’Inde', price: '15 €', note: '' },
      { key: '', label: 'Hamster', price: '10 €', note: '' },
      { key: '', label: 'Chinchilla', price: '60 €', note: '' },
      { key: '', label: 'Octodon', price: '25 €', note: '' },
      { key: '', label: 'Rat', price: '15 €', note: '' },
      { key: '', label: 'Souris', price: '5 €', note: '' },
      { key: '', label: 'Furet', price: '150 €', note: '' },
      { key: '', label: 'Poule', price: 'à partir de 10 €', note: '' },
      { key: '', label: 'Autre oiseau', price: 'selon l’espèce', note: '' },
    ],
    breedNote:
      'Des frais plus élevés peuvent être appliqués pour les animaux de race. Cette différence est une aide solidaire qui finance les soins des animaux malades ou âgés.',
  },
  help: {
    membership:
      'La carte d’adhérent aide à financer les soins vétérinaires (stérilisations, vaccins, traitements), le confort des chiens et les sauvetages. Demandez-la au refuge ou par courrier.',
    donation:
      'Les dons sont déductibles des impôts : 66 % du montant, dans la limite de 20 % de vos revenus imposables. Un reçu fiscal (CERFA) vous est envoyé dès réception. Vous pouvez donner au refuge ou envoyer votre don par courrier.',
    volunteering:
      'L’équipe est petite. Si vous avez un moment dans la semaine ou le week-end, venez promener les chiens, le matin comme l’après-midi : une promenade, c’est le meilleur moment de leur journée.',
    inKindAnimals: ['Laisses et colliers', 'Couvertures pour les paniers', 'Croquettes et pâtées', 'Gamelles en inox (le plastique ne résiste pas)'],
    inKindShelter: ['Meubles et casiers de rangement', 'Fournitures et chaises de bureau', 'Serpillières, éponges, produits d’entretien'],
    extras: 'Les pièces rouges vous encombrent ? Collectez-les et apportez-les au refuge : elles nous sont utiles.',
  },
};
