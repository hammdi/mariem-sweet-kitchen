import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { FlowId } from './types';

/**
 * État de l'aide interactive (panneau, visite guidée, schéma, assistant IA).
 * Purement visuel : rien ici n'appelle l'API en écriture.
 */
interface HelpState {
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  activeTourId: string | null;
  startTour: (id: string) => void;
  endTour: (reopenPanel?: boolean) => void;
  flowId: FlowId | null;
  showFlow: (id: FlowId | null) => void;
  aiOpen: boolean;
  openAi: () => void;
  closeAi: () => void;
  /** préférence « réduire les animations » (système OU choix dans l'aide) */
  reducedMotion: boolean;
  userReducedMotion: boolean;
  setUserReducedMotion: (v: boolean) => void;
}

const KEY = 'mariem.help.reducedMotion';
const readPref = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const systemReduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const Ctx = createContext<HelpState | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [flowId, setFlowId] = useState<FlowId | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [userReducedMotion, setUserPref] = useState(readPref);
  const [sysReduced, setSysReduced] = useState(systemReduced);

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setSysReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const setUserReducedMotion = useCallback((v: boolean) => {
    setUserPref(v);
    try {
      localStorage.setItem(KEY, v ? '1' : '0');
    } catch {
      /* préférence non mémorisée : sans conséquence */
    }
  }, []);

  const startTour = useCallback((id: string) => {
    setPanelOpen(false);
    setAiOpen(false);
    setFlowId(null);
    setActiveTourId(id);
  }, []);

  const endTour = useCallback((reopenPanel = false) => {
    setActiveTourId(null);
    if (reopenPanel) setPanelOpen(true);
  }, []);

  const value = useMemo<HelpState>(
    () => ({
      panelOpen,
      openPanel: () => {
        setAiOpen(false);
        setPanelOpen(true);
      },
      closePanel: () => {
        setPanelOpen(false);
        setFlowId(null);
      },
      togglePanel: () => {
        setAiOpen(false);
        setPanelOpen((o) => !o);
        setFlowId(null);
      },
      activeTourId,
      startTour,
      endTour,
      flowId,
      showFlow: setFlowId,
      aiOpen,
      openAi: () => {
        setPanelOpen(false);
        setAiOpen(true);
      },
      closeAi: () => setAiOpen(false),
      reducedMotion: userReducedMotion || sysReduced,
      userReducedMotion,
      setUserReducedMotion,
    }),
    [panelOpen, activeTourId, startTour, endTour, flowId, aiOpen, userReducedMotion, sysReduced, setUserReducedMotion]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHelp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHelp doit être utilisé dans <HelpProvider>');
  return ctx;
}
