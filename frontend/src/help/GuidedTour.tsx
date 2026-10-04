import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import { ArrowBack, ArrowForward, Close } from '@mui/icons-material';
import { color, radius, shadow } from '../theme/tokens';
import { useHelp } from './HelpContext';
import { TOURS } from './tours';
import { FLOWS } from './flows';
import AnimatedFlow from './AnimatedFlow';

/**
 * MOTEUR DE VISITE GUIDÉE (réutilisable : il suffit de déclarer une visite dans tours.ts).
 *
 *  - assombrit l'écran et met en lumière l'élément [data-tour="…"] (projecteur animé) ;
 *  - bulle placée à côté, jamais sur l'élément (en haut ou en bas sur téléphone) ;
 *  - Précédent / Suivant / Fermer / Terminer, Échap et flèches du clavier ;
 *  - élément absent ou caché → bulle centrée, la visite continue ;
 *  - les clics sur la page sont bloqués pendant la visite : l'aide ne peut rien
 *    déclencher (aucune donnée modifiée). Seule la navigation est faite par l'aide.
 */
const PAD = 8;
const Z = 1450;

type Rect = { top: number; left: number; width: number; height: number };

const findTarget = (id: string): HTMLElement | null => {
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`));
  return all.find((el) => el.getClientRects().length > 0) || null;
};

const pathOf = (route: string) => route.split('?')[0];

export default function GuidedTour() {
  const { activeTourId, endTour, reducedMotion } = useHelp();
  const tour = activeTourId ? TOURS[activeTourId] : null;
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [missing, setMissing] = useState(false);
  const [size, setSize] = useState({ w: 360, h: 220 });
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const bubbleRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  const step = tour?.steps[index];

  // Démarrage : ouvrir la page de la visite si besoin (navigation seulement)
  useEffect(() => {
    setIndex(0);
    if (tour?.route) {
      const current = location.pathname + location.search;
      if (pathOf(tour.route) !== location.pathname || (tour.route.includes('?') && current !== tour.route)) {
        navigate(tour.route);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTourId]);

  const measure = useCallback(() => {
    const el = targetRef.current;
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    if (!el || el.getClientRects().length === 0) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, []);

  // Trouver l'élément de l'étape (il peut apparaître après un chargement)
  useEffect(() => {
    if (!tour || !step) return;
    if (step.route && pathOf(step.route) !== location.pathname) navigate(step.route);
    targetRef.current = null;
    setRect(null);
    setMissing(false);
    if (!step.target) return;
    let tries = 0;
    let timer = 0;
    const look = () => {
      const el = findTarget(step.target!);
      if (el) {
        targetRef.current = el;
        // élément très haut : on le cale en haut de l'écran pour laisser la place à la bulle
        const tall = el.getBoundingClientRect().height > window.innerHeight * 0.45;
        el.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
        timer = window.setTimeout(measure, reducedMotion ? 0 : 350);
        return;
      }
      if (++tries < 20) timer = window.setTimeout(look, 100);
      else setMissing(true);
    };
    look();
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, index, location.pathname]);

  // Suivre l'élément (défilement, redimensionnement)
  useEffect(() => {
    if (!tour) return;
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [tour, measure]);

  useLayoutEffect(() => {
    if (!bubbleRef.current) return;
    const r = bubbleRef.current.getBoundingClientRect();
    if (Math.abs(r.width - size.w) > 1 || Math.abs(r.height - size.h) > 1) setSize({ w: r.width, h: r.height });
  }, [index, rect, missing, viewport, size.w, size.h, activeTourId]);

  // Focus sur la bulle à chaque étape (lecteurs d'écran, clavier)
  useEffect(() => {
    bubbleRef.current?.focus({ preventScroll: true });
  }, [index, activeTourId]);

  const close = useCallback(() => endTour(false), [endTour]);
  const next = useCallback(() => {
    if (!tour) return;
    if (index < tour.steps.length - 1) setIndex(index + 1);
    else endTour(false);
  }, [tour, index, endTour]);
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tour, close, next, prev]);

  if (!tour || !step) return null;

  // Placement de la bulle : à côté du projecteur, jamais dessus
  const vw = viewport.w;
  const vh = viewport.h;
  const mobile = vw < 600;
  const m = 12;
  let maxHeight = vh - 2 * m;
  const style: { top?: number; left?: number; right?: number; bottom?: number; width: number | string } = {
    width: mobile ? `calc(100vw - ${2 * 16}px)` : Math.min(380, vw - 2 * m),
  };
  if (!rect) {
    style.top = Math.max(m, (vh - size.h) / 2);
    style.left = Math.max(m, (vw - (mobile ? vw - 32 : size.w)) / 2);
  } else if (mobile) {
    // téléphone : bulle en haut si l'élément est en bas, et inversement
    style.left = 16;
    const lower = rect.top + rect.height / 2 > vh / 2;
    maxHeight = Math.max(200, lower ? rect.top - 2 * m : vh - (rect.top + rect.height) - 2 * m);
    style.top = lower ? m : Math.max(m, vh - Math.min(size.h, maxHeight) - m);
  } else {
    const w = size.w;
    const h = size.h;
    const centerX = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, m), vw - w - m);
    if (rect.top + rect.height + m + h <= vh - m) {
      style.top = rect.top + rect.height + m;
      style.left = centerX;
    } else if (rect.top - m - h >= m) {
      style.top = rect.top - m - h;
      style.left = centerX;
    } else if (rect.left + rect.width + m + w <= vw - m) {
      style.left = rect.left + rect.width + m;
      style.top = Math.min(Math.max(rect.top, m), vh - h - m);
    } else if (rect.left - m - w >= m) {
      style.left = rect.left - m - w;
      style.top = Math.min(Math.max(rect.top, m), vh - h - m);
    } else {
      style.left = centerX;
      style.top = Math.max(m, vh - h - m);
    }
  }

  // Jamais de bulle sur le projecteur : si la place manque, seul le haut (ou le bas)
  // de l'élément est mis en lumière
  let shown = rect;
  if (rect && typeof style.top === 'number') {
    const bTop = style.top;
    const bBottom = bTop + Math.min(size.h, maxHeight);
    const rBottom = rect.top + rect.height;
    const horizontal = typeof style.left === 'number' && (style.left >= rect.left + rect.width || style.left + (typeof style.width === 'number' ? style.width : vw) <= rect.left);
    if (!horizontal && bTop < rBottom && bBottom > rect.top) {
      if (bTop >= rect.top + 40) shown = { ...rect, height: Math.max(40, bTop - m - rect.top) };
      else shown = { ...rect, top: bBottom + m, height: Math.max(40, rBottom - (bBottom + m)) };
    }
  }

  const last = index === tour.steps.length - 1;
  const trans = reducedMotion ? 'none' : 'top 320ms cubic-bezier(0.2,0,0,1), left 320ms cubic-bezier(0.2,0,0,1), width 320ms cubic-bezier(0.2,0,0,1), height 320ms cubic-bezier(0.2,0,0,1)';

  return (
    <>
      {/* Bloque les clics sur la page pendant la visite */}
      <Box
        aria-hidden
        onClick={(e) => e.stopPropagation()}
        sx={{ position: 'fixed', inset: 0, zIndex: Z, cursor: 'default', bgcolor: rect ? 'transparent' : 'rgba(28,18,10,0.55)' }}
      />
      {shown && (
        <Box
          aria-hidden
          data-testid="tour-spotlight"
          sx={{
            position: 'fixed',
            zIndex: Z + 1,
            pointerEvents: 'none',
            top: shown.top,
            left: shown.left,
            width: shown.width,
            height: shown.height,
            borderRadius: `${radius.md}px`,
            boxShadow: `0 0 0 9999px rgba(28,18,10,0.55)`,
            outline: `2px solid ${color.primary}`,
            outlineOffset: 2,
            transition: trans,
            ...(reducedMotion
              ? {}
              : {
                  animation: 'tour-ring 1.4s ease-out 2',
                  '@keyframes tour-ring': {
                    '0%': { outlineColor: 'rgba(241,119,10,1)', outlineOffset: '2px' },
                    '70%': { outlineColor: 'rgba(241,119,10,0.15)', outlineOffset: '8px' },
                    '100%': { outlineColor: 'rgba(241,119,10,1)', outlineOffset: '2px' },
                  },
                }),
          }}
        />
      )}
      <Paper
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        data-testid="tour-bubble"
        sx={{
          position: 'fixed',
          zIndex: Z + 2,
          ...style,
          maxHeight,
          overflowY: 'auto',
          p: 2.25,
          borderRadius: `${radius.lg}px`,
          boxShadow: shadow.floating,
          border: `1px solid ${color.border}`,
          outline: 'none',
          transition: reducedMotion ? 'none' : 'top 320ms cubic-bezier(0.2,0,0,1), left 320ms cubic-bezier(0.2,0,0,1)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: color.primaryDark, flex: 1 }}>
            ✨ {tour.title} · {index + 1}/{tour.steps.length}
          </Typography>
          <IconButton size="small" onClick={close} aria-label="Fermer la visite">
            <Close fontSize="small" />
          </IconButton>
        </Box>
        <Typography id="tour-title" variant="h6" sx={{ fontSize: '1.05rem', mb: 0.75 }}>
          {step.title}
        </Typography>
        <Typography id="tour-body" variant="body2" sx={{ color: color.inkSoft, lineHeight: 1.55 }} component="div">
          {step.body}
        </Typography>
        {missing && (
          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: color.inkMuted }}>
            (Cet élément n’est pas visible pour le moment sur cette page.)
          </Typography>
        )}
        {step.flow && (
          <Box sx={{ mt: 1.5 }}>
            <AnimatedFlow flow={FLOWS[step.flow]} reduced={reducedMotion} compact />
          </Box>
        )}
        {/* progression */}
        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 2 }} aria-hidden>
          {tour.steps.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: i === index ? 18 : 6,
                height: 6,
                borderRadius: 3,
                bgcolor: i === index ? color.primary : color.borderStrong,
                transition: reducedMotion ? 'none' : 'width 200ms',
              }}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" onClick={() => endTour(true)} sx={{ color: color.inkSoft, mr: 'auto' }}>
            Retour à l’aide
          </Button>
          <Button size="small" variant="outlined" startIcon={<ArrowBack />} onClick={prev} disabled={index === 0}>
            Précédent
          </Button>
          {last && tour.finish ? (
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                endTour(false);
                navigate(tour.finish!.to);
              }}
            >
              {tour.finish.label}
            </Button>
          ) : (
            <Button size="small" variant="contained" endIcon={!last ? <ArrowForward /> : undefined} onClick={next} autoFocus>
              {last ? 'Terminer' : 'Suivant'}
            </Button>
          )}
        </Box>
        {last && tour.finish && (
          <Button size="small" onClick={next} fullWidth sx={{ mt: 0.5, color: color.inkSoft }}>
            Terminer sans ouvrir
          </Button>
        )}
      </Paper>
    </>
  );
}
