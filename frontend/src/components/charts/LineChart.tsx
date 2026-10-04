import { KeyboardEvent, PointerEvent, useLayoutEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { CHART, niceTicks, reducedMotion } from './chartTheme';

/**
 * Courbe (avec aire douce) : évolution d'une valeur dans le temps.
 * Info-bulle au survol / au clavier, tracé progressif une seule fois.
 */
export default function LineChart({
  labels,
  longLabels,
  values,
  color = CHART.sales,
  format,
  height = 220,
  ariaLabel,
  tooltipExtra,
  dots = false,
}: {
  dots?: boolean;
  labels: string[];
  longLabels: string[];
  values: number[];
  color?: string;
  format: (n: number) => string;
  height?: number;
  ariaLabel: string;
  tooltipExtra?: (i: number) => string | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 14, right: 12, bottom: 26, left: 54 };

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(220, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = values.length;
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 0);
  const ticks = niceTicks(max - min || 1);
  const top = min + (ticks[ticks.length - 1] || 1);
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.top + ih - ((v - min) / (top - min || 1)) * ih;
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = n ? `${line}L${x(n - 1).toFixed(1)},${y(min)}L${x(0).toFixed(1)},${y(min)}Z` : '';
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 56))));
  const gradId = `lc-${color.replace('#', '')}`;

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = Math.round(((px - pad.left) / (iw || 1)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
    if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? n) - 1));
  };

  return (
    <Box ref={boxRef} sx={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerMove={pick}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        style={{ display: 'block', outline: 'none', touchAction: 'pan-y' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(min + t)} y2={y(min + t)} stroke={CHART.grid} strokeDasharray={t ? '3 4' : undefined} />
            <text x={pad.left - 8} y={y(min + t) + 4} textAnchor="end" fontSize={11} fill={CHART.muted}>
              {format(min + t).replace(' DT', '')}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % every === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill={CHART.muted}>
              {l}
            </text>
          ) : null
        )}
        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          style={
            reducedMotion()
              ? undefined
              : { strokeDasharray: 1, strokeDashoffset: 0, animation: 'lc-draw 900ms cubic-bezier(0.16,1,0.3,1) both' }
          }
        />
        <style>{'@keyframes lc-draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }'}</style>
        {dots &&
          values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color} style={reducedMotion() ? undefined : { animation: `lc-dot 400ms ease-out ${300 + i * 25}ms both` }} />
          ))}
        <style>{'@keyframes lc-dot { from { opacity: 0; } to { opacity: 1; } }'}</style>
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke={CHART.axis} />
            <circle cx={x(hover)} cy={y(values[hover])} r={5} fill="#fff" stroke={color} strokeWidth={2.5} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <Box
          role="status"
          sx={{
            position: 'absolute',
            top: 0,
            left: Math.min(Math.max(x(hover) - 80, 0), width - 160),
            width: 160,
            pointerEvents: 'none',
            bgcolor: '#2A1F17',
            color: '#fff',
            borderRadius: '10px',
            px: 1.25,
            py: 0.75,
            boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
          }}
        >
          <Typography sx={{ fontSize: '0.72rem', opacity: 0.8 }}>{longLabels[hover]}</Typography>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700 }}>{format(values[hover])}</Typography>
          {tooltipExtra?.(hover) && <Typography sx={{ fontSize: '0.72rem', opacity: 0.8 }}>{tooltipExtra(hover)}</Typography>}
        </Box>
      )}
    </Box>
  );
}
