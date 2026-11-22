import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, IconButton } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Diaporama « vitrine » : défile tout seul comme une publicité, s'arrête au
 * survol / au toucher, se pilote au doigt (glisser), aux flèches et aux points.
 * Pas de défilement automatique si l'appareil demande moins d'animations.
 */
export default function Slideshow({
  slides,
  interval = 4500,
  height,
  label,
  showArrows = true,
}: {
  slides: ReactNode[];
  interval?: number;
  height: number | Record<string, number | string>;
  label: string;
  showArrows?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2 || paused || prefersReducedMotion()) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearInterval(t);
  }, [count, paused, interval]);

  if (count === 0) return null;

  return (
    <Box
      role="region"
      aria-roledescription="carrousel"
      aria-label={label}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(index - 1);
        if (e.key === 'ArrowRight') go(index + 1);
      }}
      onPointerDown={(e) => {
        startX.current = e.clientX;
        setPaused(true);
      }}
      onPointerUp={(e) => {
        if (startX.current !== null) {
          const dx = e.clientX - startX.current;
          if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        }
        startX.current = null;
      }}
      sx={{ position: 'relative', overflow: 'hidden', height, touchAction: 'pan-y' }}
    >
      {slides.map((s, i) => (
        <Box
          key={i}
          aria-hidden={i !== index}
          aria-roledescription="diapositive"
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: i === index ? 1 : 0,
            transform: i === index ? 'scale(1)' : 'scale(1.03)',
            transition: 'opacity 700ms ease, transform 1200ms ease',
            pointerEvents: i === index ? 'auto' : 'none',
          }}
        >
          {s}
        </Box>
      ))}

      {count > 1 && showArrows && (
        <>
          <IconButton aria-label="Précédent" onClick={() => go(index - 1)} sx={arrowSx('left')}>
            <ChevronLeft />
          </IconButton>
          <IconButton aria-label="Suivant" onClick={() => go(index + 1)} sx={arrowSx('right')}>
            <ChevronRight />
          </IconButton>
        </>
      )}

      {count > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 14,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            gap: 0.75,
            zIndex: 2,
          }}
        >
          {slides.map((_, i) => (
            <ButtonBase
              key={i}
              aria-label={`Diapositive ${i + 1} sur ${count}`}
              aria-current={i === index}
              onClick={() => go(i)}
              sx={{
                width: i === index ? 22 : 8,
                height: 8,
                borderRadius: 8,
                bgcolor: i === index ? '#fff' : 'rgba(255,255,255,0.55)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                transition: 'width 250ms ease, background-color 250ms ease',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

const arrowSx = (side: 'left' | 'right') => ({
  position: 'absolute',
  top: '50%',
  [side]: 12,
  transform: 'translateY(-50%)',
  zIndex: 2,
  bgcolor: 'rgba(255,255,255,0.85)',
  color: '#2A1F17',
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  '&:hover': { bgcolor: '#fff' },
  display: { xs: 'none', sm: 'inline-flex' },
});
