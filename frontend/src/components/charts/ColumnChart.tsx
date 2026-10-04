import { useEffect, useLayoutEffect, useRef, useState, KeyboardEvent, PointerEvent } from 'react';
import { Box, Typography } from '@mui/material';
import { CHART, niceTicks, reducedMotion } from './chartTheme';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface Props {
  labels: string[]; // axe X (court)
  longLabels: string[]; // en-tete de l'info-bulle
  series: Series[];
  mode?: 'single' | 'grouped' | 'stacked';
  format: (n: number) => string;
  tooltipExtra?: (i: number) => string | null;
  onSelect?: (i: number) => void; // clic sur un creneau
  height?: number;
}

const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

// Colonne : arrondi 4 px a l'extremite, carre a la base
function columnPath(x: number, y: number, w: number, h: number, rounded: boolean) {
  if (h <= 0) return '';
  const r = rounded ? Math.min(4, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Colonnes (simple / groupees / empilees) avec ligne de base unique, info-bulle
 * au survol (et au clavier), et apparition progressive une seule fois.
 */
export default function ColumnChart({
  labels,
  longLabels,
  series,
  mode = 'single',
  format,
  tooltipExtra,
  onSelect,
  height = 230,
}: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(reducedMotion());

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(220, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (drawn) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [drawn]);

  const n = labels.length;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const totals = labels.map((_, i) =>
    mode === 'stacked'
      ? series.reduce((s, se) => s + Math.max(0, se.values[i] || 0), 0)
      : Math.max(...series.map((se) => se.values[i] || 0))
  );
  const ticks = niceTicks(Math.max(...totals, 0));
  const max = ticks[ticks.length - 1] || 1;
  const band = plotW / Math.max(1, n);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const groupW = Math.min(mode === 'grouped' ? 2 * 14 + 2 : 24, band * 0.7);
  const barW = mode === 'grouped' ? (groupW - 2) / series.length : groupW;
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(plotW / 46))));

  const indexAt = (clientX: number) => {
    const rect = boxRef.current!.getBoundingClientRect();
    const i = Math.floor((clientX - rect.left - PAD.left) / band);
    return i >= 0 && i < n ? i : null;
  };
  const onMove = (e: PointerEvent) => setHover(indexAt(e.clientX));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
    else if (e.key === 'Enter' && hover !== null && onSelect) onSelect(hover);
    else return;
    e.preventDefault();
  };

  const tipLeft = hover === null ? 0 : PAD.left + band * hover + band / 2;
  const clickable = !!onSelect && hover !== null && totals[hover] > 0;

  return (
    <Box ref={boxRef} sx={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={series.map((s) => s.label).join(', ')}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        onClick={() => clickable && onSelect!(hover!)}
        style={{ display: 'block', cursor: clickable ? 'pointer' : 'default', outline: 'none' }}
      >
        {/* grille horizontale (fine, discrete) + graduations */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? CHART.axis : CHART.grid}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              fontSize={11}
              fill={CHART.muted}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {Number.isInteger(t) ? t : format(t).replace(' DT', '')}
            </text>
          </g>
        ))}
        {hover !== null && (
          <rect
            x={PAD.left + band * hover}
            y={PAD.top}
            width={band}
            height={plotH}
            fill={CHART.hover}
          />
        )}

        <g
          style={{
            transformOrigin: `0px ${PAD.top + plotH}px`,
            transform: drawn ? 'scaleY(1)' : 'scaleY(0)',
            transition: reducedMotion() ? 'none' : 'transform 650ms cubic-bezier(.2,.7,.2,1)',
          }}
        >
          {labels.map((_, i) => {
            const cx = PAD.left + band * i + band / 2;
            if (mode === 'stacked') {
              let acc = 0;
              const visible = series.filter((s) => (s.values[i] || 0) > 0);
              return visible.map((s, si) => {
                const v = s.values[i];
                const top = y(acc + v);
                const h = y(acc) - top - (si > 0 ? 2 : 0); // 2 px d'espace entre segments
                acc += v;
                return (
                  <path
                    key={s.key}
                    d={columnPath(cx - barW / 2, top, barW, h, si === visible.length - 1)}
                    fill={s.color}
                  />
                );
              });
            }
            return series.map((s, si) => {
              const v = Math.max(0, s.values[i] || 0);
              const x = mode === 'grouped' ? cx - groupW / 2 + si * (barW + 2) : cx - barW / 2;
              return (
                <path key={s.key} d={columnPath(x, y(v), barW, y(0) - y(v), true)} fill={s.color} />
              );
            });
          })}
        </g>

        {labels.map((l, i) =>
          i % labelEvery === 0 ? (
            <text
              key={i}
              x={PAD.left + band * i + band / 2}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill={CHART.muted}
            >
              {l}
            </text>
          ) : null
        )}
      </svg>

      {hover !== null && (
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            // a cote du creneau survole, du cote ou il reste de la place (jamais coupe par la carte)
            left: tipLeft > width / 2 ? tipLeft - band / 2 - 6 : tipLeft + band / 2 + 6,
            transform: tipLeft > width / 2 ? 'translateX(-100%)' : 'none',
            bgcolor: 'white',
            border: '1px solid rgba(11,11,11,0.10)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
            borderRadius: 2,
            px: 1.25,
            py: 0.75,
            pointerEvents: 'none',
            minWidth: 150,
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {longLabels[hover]}
          </Typography>
          {series.map((s) => (
            <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box
                sx={{ width: 12, height: 2, bgcolor: s.color, borderRadius: 1, flexShrink: 0 }}
              />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {format(s.values[hover] || 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {s.label}
              </Typography>
            </Box>
          ))}
          {tooltipExtra?.(hover) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              {tooltipExtra(hover)}
            </Typography>
          )}
          {clickable && (
            <Typography variant="caption" color="primary.main" sx={{ display: 'block' }}>
              Cliquer pour voir ces commandes
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
