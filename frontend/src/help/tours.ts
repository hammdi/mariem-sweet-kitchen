import { Tour } from './types';

/**
 * Visites guidées. Chaque étape cible un élément par son attribut data-tour.
 * Si l'élément n'est pas visible (liste vide, écran étroit…), la bulle
 * s'affiche au centre : la visite ne bloque jamais.
 */
export const TOURS: Record<string, Tour> = {
  'dashboard-overview': {
    id: 'dashboard-overview',
    title: 'Découvrir le tableau de bord',
    route: '/admin',
    steps: [
      {
        target: 'topbar-kpis',
        title: 'Vos chiffres du jour',
        body: 'Chiffre d’affaires, commandes et stock. Passez la souris dessus pour le détail, cliquez pour ouvrir la page.',
      },
      {
        target: 'dash-quick-actions',
        title: 'Actions rapides',
        body: 'Les gestes du quotidien en un clic : nouvelle commande, stock, liste de courses, caisse…',
      },
      {
        target: 'dash-revenue',
        title: 'Chiffre d’affaires',
        body: 'Ce que vous avez vendu, ce qui est déjà encaissé et ce qui reste à encaisser.',
      },
      {
        target: 'dash-orders',
        title: 'Commandes du jour',
        body: 'Les commandes prévues aujourd’hui, avec leur avancement et leur paiement.',
      },
      {
        target: 'dash-action',
        title: 'Ce qui demande votre attention',
        body: 'Les commandes bloquées par un ingrédient manquant, les plus urgentes en premier.',
      },
      {
        target: 'help-fab',
        title: 'Besoin d’aide ?',
        body: 'Ce bouton ✨ est sur toutes les pages. Il propose de l’aide adaptée à la page où vous êtes.',
      },
    ],
  },

  'create-order': {
    id: 'create-order',
    title: 'Créer une commande',
    route: '/admin/orders/new',
    steps: [
      { target: 'order-client', title: '1. Le client', body: 'Choisissez votre client, ou tapez son nom et son téléphone.' },
      { target: 'order-product', title: '2. Le produit', body: 'Choisissez la recette et la taille.' },
      { target: 'order-quantity', title: '3. La quantité', body: 'Indiquez combien en faire.' },
      { target: 'order-date', title: '4. La date', body: 'Quand le client vient chercher sa commande.' },
      {
        target: 'order-stock',
        title: '5. Les ingrédients nécessaires',
        body: 'Ici vous voyez ce que la commande va utiliser, et ce qui manque éventuellement.',
      },
      {
        title: '6. Il manque un ingrédient ? Pas de problème',
        body: 'La commande est enregistrée et l’ingrédient manquant part dans la liste de courses.',
        flow: 'missing',
      },
      {
        target: 'order-submit',
        title: '7. Créer la commande',
        body: 'Vous pouvez créer la commande même si un ingrédient manque. Le stock ne bouge pas à ce moment-là.',
      },
      {
        title: '8. Et ensuite ?',
        body: 'Une fois le stock suffisant, vous pourrez lancer la préparation depuis la fiche de la commande. Le paiement s’enregistre à part, quand le client paie.',
        flow: 'payment',
      },
    ],
  },

  'understand-stats': {
    id: 'understand-stats',
    title: 'Comprendre mes statistiques',
    route: '/admin/statistics',
    steps: [
      { target: 'stats-period', title: 'La période', body: 'Aujourd’hui, cette semaine, ce mois… ou vos propres dates.' },
      {
        target: 'stats-kpis',
        title: 'Les chiffres clés',
        body: 'Chiffre d’affaires = ce que vous avez vendu (payé ou non). Encaissé = l’argent reçu. À encaisser = la différence.',
      },
      { title: 'Vendre ≠ encaisser', body: 'Une vente compte tout de suite ; la caisse augmente seulement quand le client paie.', flow: 'sale' },
      { target: 'stats-sales-chart', title: 'L’évolution des ventes', body: 'Survolez une barre pour voir le détail. Le bouton tableau affiche les chiffres.' },
      {
        target: 'stats-cash',
        title: 'La caisse',
        body: 'L’argent réellement entré et sorti sur la période, et la liquidité à la fin.',
      },
      {
        target: 'stats-purchases',
        title: 'Achats et dépenses',
        body: 'Tous vos achats et dépenses, y compris ceux payés avec votre argent personnel (qui ne sortent pas de la caisse).',
      },
    ],
  },

  attention: {
    id: 'attention',
    title: 'Voir ce qui nécessite mon attention',
    route: '/admin',
    steps: [
      {
        target: 'dash-action',
        title: 'Commandes bloquées',
        body: 'Chaque commande indique l’ingrédient qui manque et la quantité. Les plus proches sont en haut.',
      },
      {
        target: 'dash-stock',
        title: 'Stock à surveiller',
        body: 'Les ingrédients passés sous le seuil d’alerte que vous avez choisi.',
      },
      {
        target: 'topbar-kpis',
        title: 'En un coup d’œil',
        body: 'L’indicateur « Commandes » devient rouge s’il y a une urgence, « Stock » orange s’il faut acheter.',
      },
    ],
    finish: { label: 'Ouvrir la liste de courses', to: '/admin/shopping-list' },
  },

  'understand-stock': {
    id: 'understand-stock',
    title: 'Comprendre mon stock',
    route: '/admin/stock',
    steps: [
      { target: 'stock-summary', title: 'Le résumé', body: 'Combien d’ingrédients sont OK, à surveiller ou manquants.' },
      {
        target: 'stock-table',
        title: 'Chaque ingrédient',
        body: 'Stock actuel, seuil d’alerte, état, dernier prix payé et source.',
      },
      {
        title: 'Quand le stock bouge-t-il ?',
        body: 'Il augmente à chaque achat, et diminue quand une commande passe « En préparation ». Créer une commande ne le change pas.',
        flow: 'purchase',
      },
      { target: 'stock-history-tab', title: 'L’historique', body: 'Chaque mouvement est noté : achats, utilisations, corrections (avec leur raison).' },
    ],
  },

  'correct-stock': {
    id: 'correct-stock',
    title: 'Corriger un stock',
    route: '/admin/stock',
    steps: [
      {
        target: 'stock-correct',
        title: 'Le bouton « Corriger »',
        body: 'Sur la ligne de l’ingrédient. Il ouvre une fenêtre : rien n’est modifié tant que vous n’avez pas validé.',
      },
      {
        title: 'Une raison est demandée',
        body: 'Inventaire, erreur de saisie, perte, casse… L’ancienne valeur, la nouvelle, la différence et la raison sont gardées dans l’historique.',
      },
      { target: 'stock-history-tab', title: 'Retrouver une correction', body: 'Toutes les corrections apparaissent dans l’historique.' },
    ],
  },

  'buy-ingredient': {
    id: 'buy-ingredient',
    title: 'Acheter un ingrédient',
    route: '/admin/shopping-list',
    steps: [
      {
        target: 'shop-card',
        title: 'Ce qu’il faut acheter',
        body: 'Quantité à acheter, commandes concernées, source connue et dernier prix payé.',
      },
      {
        target: 'shop-buy',
        title: 'Le bouton « Acheter »',
        body: 'Indiquez la quantité achetée, le prix réellement payé et avec quel argent.',
      },
      { title: 'Ce que fait un achat', body: 'Le stock augmente ; la caisse baisse seulement si vous avez payé avec la caisse.', flow: 'purchase' },
    ],
  },

  'understand-missing': {
    id: 'understand-missing',
    title: 'Comprendre un manque',
    route: '/admin/orders',
    steps: [
      {
        target: 'orders-list',
        title: 'Les commandes bloquées sont signalées',
        body: 'Une pastille rouge « ingrédient manquant » apparaît sur la commande concernée.',
      },
      { title: 'D’où vient le manque ?', body: 'Le stock est réservé aux commandes les plus proches en premier.', flow: 'missing' },
    ],
    finish: { label: 'Voir la liste de courses', to: '/admin/shopping-list' },
  },

  'prepare-order': {
    id: 'prepare-order',
    title: 'Préparer une commande',
    route: '/admin/orders',
    steps: [
      { target: 'orders-filters', title: 'Trouver la commande', body: 'Filtrez par avancement : « Confirmées » sont prêtes à être préparées.' },
      { target: 'orders-list', title: 'Ouvrir la commande', body: 'Cliquez sur une commande pour ouvrir sa fiche.' },
      {
        title: 'Lancer la préparation',
        body: 'Sur la fiche, le bouton « Commencer la préparation » utilise les ingrédients (une seule fois). Il est disponible même si la commande n’est pas payée, dès que le stock suffit.',
        flow: 'payment',
      },
    ],
  },

  'collect-payment': {
    id: 'collect-payment',
    title: 'Encaisser une commande',
    route: '/admin/cash?tab=receivables',
    steps: [
      { target: 'cash-receivables-tab', title: 'Commandes à encaisser', body: 'Toutes les ventes pas encore (entièrement) payées.' },
      { title: 'Encaisser', body: 'Le bouton « Encaisser » enregistre l’argent reçu : la caisse augmente, le reste à encaisser diminue.', flow: 'sale' },
    ],
  },

  'cash-income': {
    id: 'cash-income',
    title: 'Ajouter une entrée',
    route: '/admin/cash',
    steps: [
      { target: 'cash-tiles', title: 'Votre caisse', body: 'Liquidité, entrées, sorties et ce qui reste à encaisser.' },
      {
        target: 'cash-add-income',
        title: '« + Entrée »',
        body: 'Pour l’argent qui entre hors commande (fonds de caisse, autre recette). Les paiements de commandes se font avec « Encaisser ».',
      },
    ],
    finish: { label: 'Ouvrir le formulaire d’entrée', to: '/admin/cash?open=income' },
  },

  'cash-expense': {
    id: 'cash-expense',
    title: 'Ajouter une dépense',
    route: '/admin/cash',
    steps: [
      {
        target: 'cash-add-expense',
        title: '« − Dépense »',
        body: 'Emballages, gaz, transport… (pas les ingrédients : ce sont des achats de stock).',
      },
      {
        title: 'Avec quel argent ?',
        body: 'Payée avec la caisse : la caisse baisse. Avec votre argent personnel ou la banque : la caisse ne bouge pas, mais la dépense compte dans les statistiques.',
      },
    ],
    finish: { label: 'Ouvrir le formulaire de dépense', to: '/admin/cash?open=expense' },
  },

  'cash-purchase': {
    id: 'cash-purchase',
    title: 'Acheter du stock',
    route: '/admin/cash',
    steps: [
      { target: 'cash-add-purchase', title: '« Achat de stock »', body: 'Pour enregistrer des ingrédients achetés.' },
      { title: 'Ce que fait un achat', body: 'Stock +, et caisse − seulement si payé avec la caisse.', flow: 'purchase' },
    ],
    finish: { label: 'Ouvrir le formulaire d’achat', to: '/admin/cash?open=purchase' },
  },

  'shopping-needs': {
    id: 'shopping-needs',
    title: 'Comprendre les besoins',
    route: '/admin/shopping-list',
    steps: [
      { target: 'shop-summary', title: 'Le total', body: 'Le nombre d’ingrédients à acheter, les commandes concernées et le coût estimé.' },
      { target: 'shop-card', title: 'Un ingrédient', body: 'La priorité dépend de la commande la plus proche : Urgent, Bientôt ou Plus tard.' },
      {
        target: 'shop-orders',
        title: 'Le détail par commande',
        body: 'Combien manque pour chaque commande. Un achat partiel sert d’abord les commandes les plus proches.',
      },
    ],
  },

  'blocked-orders': {
    id: 'blocked-orders',
    title: 'Voir les commandes bloquées',
    route: '/admin',
    steps: [
      { target: 'dash-action', title: 'Commandes bloquées', body: 'Elles attendent un ingrédient. Achetez-le depuis la liste de courses pour les débloquer.' },
    ],
    finish: { label: 'Ouvrir la liste de courses', to: '/admin/shopping-list' },
  },
  'ingredients-overview': {
    id: 'ingredients-overview',
    title: 'La page Ingrédients',
    route: '/admin/ingredients',
    steps: [
      { title: 'Vos ingrédients', body: 'Chaque ingrédient a un prix de référence (utilisé pour le prix des recettes), une unité et un seuil d’alerte de stock.' },
      { title: 'Prix chez vos sources', body: 'Ouvrez un ingrédient pour noter les prix vus chez Carrefour, au grossiste… et enregistrer vos achats réels.', flow: 'purchase' },
    ],
    finish: { label: 'Voir les sources d’achat', to: '/admin/sources' },
  },
  'recipes-overview': {
    id: 'recipes-overview',
    title: 'La page Recettes',
    route: '/admin/recipes',
    steps: [
      { title: 'Une carte par recette', body: 'Chaque taille affiche ses portions et son prix de vente calculé.' },
      { title: 'Comment le prix est calculé', body: 'Ingrédients + électricité des machines + eau + marge. Les commandes déjà prises gardent leur prix.', flow: 'recipe' },
    ],
  },
  'clients-overview': {
    id: 'clients-overview',
    title: 'La page Clients',
    route: '/admin/clients',
    steps: [
      { title: 'Vos clients', body: 'Particuliers et cafés, avec leur nombre de commandes, le chiffre d’affaires généré et leur dernière commande.' },
      { title: 'Généré ≠ encaissé', body: 'Le chiffre d’affaires généré compte les commandes confirmées, payées ou non. Ouvrez un client pour voir ce qui a été encaissé.', flow: 'sale' },
    ],
  },
};
