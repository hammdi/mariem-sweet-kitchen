import { ReactNode } from 'react';

/**
 * SYSTÈME D'AIDE — modèle de données.
 *
 * Tout est déclaratif (pages, actions, visites, flux) : ajouter une aide = ajouter
 * des données, pas du code. Le même modèle pourra être alimenté plus tard par
 * une IA (elle choisirait une action / une visite existante à proposer).
 *
 * RÈGLE : l'aide explique, met en évidence, navigue, ouvre une page ou un
 * formulaire vide. Elle ne modifie JAMAIS de données (stock, caisse, commandes,
 * achats, paiements) : aucune action d'aide n'appelle l'API en écriture.
 */

export type FlowId =
  | 'purchase'
  | 'sale'
  | 'missing'
  | 'payment'
  | 'cancel'
  | 'order-check'
  | 'cash'
  | 'stock'
  | 'stats'
  | 'recipe'
  | 'shopping';

export interface FlowNode {
  emoji: string;
  label: string;
  caption?: string;
  tone?: 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'violet';
  conditional?: boolean; // étape qui n'a lieu que dans certains cas (bordure pointillée)
}

export interface Flow {
  id: FlowId;
  title: string;
  summary: string;
  nodes: FlowNode[];
  note?: string;
}

export interface TourStep {
  /** valeur de l'attribut data-tour de l'élément à mettre en évidence ; absent = bulle centrée */
  target?: string;
  title: string;
  body: ReactNode;
  /** schéma animé affiché dans la bulle */
  flow?: FlowId;
  /** page à ouvrir avant l'étape (navigation seulement) */
  route?: string;
}

export interface Tour {
  id: string;
  title: string;
  /** page où la visite se déroule ; ouverte automatiquement au démarrage */
  route?: string;
  steps: TourStep[];
  /** proposé à la fin : ouvrir la fonctionnalité (navigation / formulaire vide, jamais d'enregistrement) */
  finish?: { label: string; to: string };
}

export type HelpActionKind = 'tour' | 'flow' | 'navigate';

export interface HelpAction {
  id: string;
  label: string;
  description?: string;
  icon: string; // emoji : lisible, léger, pas de dépendance
  kind: HelpActionKind;
  tourId?: string;
  flowId?: FlowId;
  to?: string;
}

export interface PageHelp {
  id: string;
  title: string;
  match: (pathname: string) => boolean;
  intro: string;
  actions: HelpAction[];
}
