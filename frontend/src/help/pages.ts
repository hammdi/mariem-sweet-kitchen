import { HelpAction, PageHelp } from './types';

/**
 * Aide contextuelle par page : ce que l'on propose quand Rahma clique sur ✨.
 * Seules les fonctionnalités qui existent réellement sont proposées.
 */
const flowsActions: HelpAction[] = [
  { id: 'flow-sale', label: 'Comment marche une vente ?', icon: '🧾', kind: 'flow', flowId: 'sale' },
  { id: 'flow-purchase', label: 'Comment marche un achat ?', icon: '🛒', kind: 'flow', flowId: 'purchase' },
];

export const PAGE_HELP: PageHelp[] = [
  {
    id: 'new-order',
    title: 'Nouvelle commande',
    match: (p) => p === '/admin/orders/new',
    intro: 'Je vous montre comment remplir la commande, étape par étape.',
    actions: [
      { id: 'tour-create-order', label: 'Créer une commande', description: 'Visite guidée du formulaire', icon: '🧾', kind: 'tour', tourId: 'create-order' },
      { id: 'flow-missing', label: 'Il manque un ingrédient ?', description: 'Ce qui se passe ensuite', icon: '⚠️', kind: 'flow', flowId: 'missing' },
    ],
  },
  {
    id: 'order-detail',
    title: 'Fiche commande',
    match: (p) => /^\/admin\/orders\/(?!new)[^/]+$/.test(p),
    intro: 'Avancement, ingrédients et paiement de cette commande.',
    actions: [
      { id: 'flow-payment', label: 'Préparer une commande', description: 'Avancement et paiement sont séparés', icon: '👩‍🍳', kind: 'flow', flowId: 'payment' },
      { id: 'flow-sale-detail', label: 'Encaisser une commande', description: 'Vente → à encaisser → caisse', icon: '💰', kind: 'flow', flowId: 'sale' },
      { id: 'flow-missing-detail', label: 'Comprendre un manque', icon: '⚠️', kind: 'flow', flowId: 'missing' },
      { id: 'flow-cancel', label: 'Annuler une commande', description: 'Avant ou après la préparation', icon: '✖️', kind: 'flow', flowId: 'cancel' },
    ],
  },
  {
    id: 'orders',
    title: 'Commandes',
    match: (p) => p === '/admin/orders',
    intro: 'Que voulez-vous faire avec vos commandes ?',
    actions: [
      { id: 'tour-create-order', label: 'Créer une commande', description: 'Visite guidée du formulaire', icon: '🧾', kind: 'tour', tourId: 'create-order' },
      { id: 'tour-missing', label: 'Comprendre un manque', icon: '⚠️', kind: 'tour', tourId: 'understand-missing' },
      { id: 'tour-prepare', label: 'Préparer une commande', icon: '👩‍🍳', kind: 'tour', tourId: 'prepare-order' },
      { id: 'tour-collect', label: 'Encaisser une commande', icon: '💰', kind: 'tour', tourId: 'collect-payment' },
      { id: 'flow-order-check', label: 'Du client à la préparation', description: 'Le manque ne bloque que la préparation', icon: '🔁', kind: 'flow', flowId: 'order-check' },
    ],
  },
  {
    id: 'stock',
    title: 'Stock',
    match: (p) => p === '/admin/stock',
    intro: 'Ce que vous avez à la maison, et comment il évolue.',
    actions: [
      { id: 'tour-stock', label: 'Comprendre mon stock', icon: '📦', kind: 'tour', tourId: 'understand-stock' },
      { id: 'tour-correct', label: 'Corriger un stock', description: 'Inventaire, perte, casse…', icon: '✏️', kind: 'tour', tourId: 'correct-stock' },
      { id: 'tour-buy', label: 'Acheter un ingrédient', icon: '🛒', kind: 'tour', tourId: 'buy-ingredient' },
      { id: 'flow-stock', label: 'La vie du stock', description: 'Achat, réservation, consommation, correction', icon: '📦', kind: 'flow', flowId: 'stock' },
    ],
  },
  {
    id: 'shopping',
    title: 'Liste de courses',
    match: (p) => p === '/admin/shopping-list',
    intro: 'Ce qu’il faut acheter pour vos commandes.',
    actions: [
      { id: 'tour-needs', label: 'Comprendre les besoins', icon: '📋', kind: 'tour', tourId: 'shopping-needs' },
      { id: 'tour-buy', label: 'Acheter', icon: '🛒', kind: 'tour', tourId: 'buy-ingredient' },
      { id: 'tour-blocked', label: 'Voir les commandes bloquées', icon: '⛔', kind: 'tour', tourId: 'blocked-orders' },
      { id: 'flow-shopping', label: 'Pourquoi cet ingrédient est là ?', description: 'De la commande bloquée à la commande débloquée', icon: '❓', kind: 'flow', flowId: 'shopping' },
    ],
  },
  {
    id: 'cash',
    title: 'Caisse',
    match: (p) => p === '/admin/cash',
    intro: 'L’argent qui entre et qui sort.',
    actions: [
      { id: 'tour-income', label: 'Ajouter une entrée', icon: '➕', kind: 'tour', tourId: 'cash-income' },
      { id: 'tour-expense', label: 'Ajouter une dépense', icon: '➖', kind: 'tour', tourId: 'cash-expense' },
      { id: 'tour-purchase', label: 'Acheter du stock', icon: '🛒', kind: 'tour', tourId: 'cash-purchase' },
      { id: 'tour-collect', label: 'Encaisser une commande', icon: '💰', kind: 'tour', tourId: 'collect-payment' },
      { id: 'flow-cash', label: 'Ce qui fait bouger la caisse', description: 'Entrée, dépense, achat, paiement', icon: '🏦', kind: 'flow', flowId: 'cash' },
    ],
  },
  {
    id: 'statistics',
    title: 'Statistiques',
    match: (p) => p === '/admin/statistics',
    intro: 'Comprendre vos chiffres.',
    actions: [
      { id: 'tour-stats', label: 'Comprendre mes statistiques', icon: '📊', kind: 'tour', tourId: 'understand-stats' },
      { id: 'flow-stats', label: 'Vendu ≠ dans la caisse', description: 'CA, encaissements, à encaisser, liquidité…', icon: '⚖️', kind: 'flow', flowId: 'stats' },
      ...flowsActions,
    ],
  },
  {
    id: 'ingredient-detail',
    title: 'Fiche ingrédient',
    match: (p) => /^\/admin\/ingredients\/[^/]+$/.test(p),
    intro: 'Prix chez vos sources, achats réels et stock de cet ingrédient.',
    actions: [
      { id: 'flow-purchase-ing', label: 'Enregistrer un achat', description: 'Ce que fait un achat', icon: '🛒', kind: 'flow', flowId: 'purchase' },
      { id: 'flow-stock-ing', label: 'La vie du stock', icon: '📦', kind: 'flow', flowId: 'stock' },
      { id: 'nav-shopping', label: 'Ouvrir la liste de courses', icon: '📋', kind: 'navigate', to: '/admin/shopping-list' },
    ],
  },
  {
    id: 'ingredients',
    title: 'Ingrédients',
    match: (p) => p === '/admin/ingredients',
    intro: 'Vos ingrédients et leurs prix. Le stock se gère dans « Stock ».',
    actions: [
      { id: 'tour-ingredients', label: 'Découvrir la page', icon: '🥚', kind: 'tour', tourId: 'ingredients-overview' },
      { id: 'flow-recipe-ing', label: 'Du prix de l’ingrédient au prix de vente', icon: '🏷️', kind: 'flow', flowId: 'recipe' },
      { id: 'nav-sources', label: 'Gérer les sources d’achat', icon: '🏪', kind: 'navigate', to: '/admin/sources' },
    ],
  },
  {
    id: 'recipes',
    title: 'Recettes',
    match: (p) => p.startsWith('/admin/recipes'),
    intro: 'Tailles, portions, ingrédients, machines, temps et prix.',
    actions: [
      { id: 'flow-recipe', label: 'Comment le prix est calculé', description: 'Ingrédients + électricité + eau + marge', icon: '🎂', kind: 'flow', flowId: 'recipe' },
      { id: 'tour-recipes', label: 'Découvrir la page', icon: '✨', kind: 'tour', tourId: 'recipes-overview' },
      { id: 'nav-new-recipe', label: 'Créer une recette', description: 'Ouvre un formulaire vide', icon: '➕', kind: 'navigate', to: '/admin/recipes/new' },
    ],
  },
  {
    id: 'clients',
    title: 'Clients',
    match: (p) => p.startsWith('/admin/clients'),
    intro: 'Particuliers et cafés, leurs commandes et ce qu’ils ont généré.',
    actions: [
      { id: 'tour-clients', label: 'Découvrir la page', icon: '👥', kind: 'tour', tourId: 'clients-overview' },
      { id: 'flow-sale-client', label: 'CA généré ou encaissé ?', icon: '🧾', kind: 'flow', flowId: 'sale' },
      { id: 'tour-create-order-client', label: 'Créer une commande', icon: '🧾', kind: 'tour', tourId: 'create-order' },
    ],
  },
  {
    id: 'settings',
    title: 'Paramètres',
    match: (p) => p === '/admin/settings',
    intro: 'Calcul des prix, alertes, catégories, apparence.',
    actions: [
      { id: 'flow-recipe-settings', label: 'À quoi servent ces réglages ?', description: 'Électricité, eau, marge → prix de vente', icon: '⚙️', kind: 'flow', flowId: 'recipe' },
      { id: 'nav-categories', label: 'Gérer les catégories', icon: '🏷️', kind: 'navigate', to: '/admin/settings?tab=categories' },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendrier',
    match: (p) => p === '/admin/calendar',
    intro: 'Vos commandes jour par jour.',
    actions: [
      { id: 'flow-payment-cal', label: 'Avancement et paiement', icon: '📅', kind: 'flow', flowId: 'payment' },
      { id: 'tour-create-order-cal', label: 'Créer une commande', icon: '🧾', kind: 'tour', tourId: 'create-order' },
    ],
  },
  {
    id: 'dashboard',
    title: 'Tableau de bord',
    match: (p) => p === '/admin' || p === '/admin/',
    intro: 'Que voulez-vous faire ?',
    actions: [
      { id: 'tour-create-order', label: 'Créer une commande', icon: '🧾', kind: 'tour', tourId: 'create-order' },
      { id: 'tour-stats', label: 'Comprendre mes statistiques', icon: '📊', kind: 'tour', tourId: 'understand-stats' },
      { id: 'tour-attention', label: 'Voir ce qui nécessite mon attention', icon: '🔔', kind: 'tour', tourId: 'attention' },
      { id: 'tour-stock', label: 'Comprendre le stock', icon: '📦', kind: 'tour', tourId: 'understand-stock' },
      { id: 'tour-dashboard', label: 'Découvrir le tableau de bord', description: 'Visite guidée de cette page', icon: '✨', kind: 'tour', tourId: 'dashboard-overview' },
    ],
  },
];

const DEFAULT_HELP: PageHelp = {
  id: 'default',
  title: 'Administration',
  match: () => true,
  intro: 'Que voulez-vous faire ?',
  actions: [
    { id: 'tour-create-order', label: 'Créer une commande', icon: '🧾', kind: 'tour', tourId: 'create-order' },
    { id: 'nav-dashboard', label: 'Retour au tableau de bord', icon: '🏠', kind: 'navigate', to: '/admin' },
    ...flowsActions,
  ],
};

export const helpForPath = (pathname: string): PageHelp =>
  PAGE_HELP.find((h) => h.match(pathname)) || DEFAULT_HELP;
