import { Box, SxProps } from '@mui/material';

/**
 * ILLUSTRATIONS — identité pâtisserie de l'application (SVG originaux, aucun fichier externe).
 *
 * Toujours décoratives (aria-hidden, aucun clic) : elles ne gênent jamais une interaction.
 * Pour remplacer un dessin par une vraie image plus tard, il suffit de changer
 * l'entrée correspondante de ILLUSTRATIONS (ex : <img src="/illustrations/croissant.webp" />).
 */

function ChefHat() {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%">
      <path
        d="M18 40c-6 0-10-5-10-10.5 0-6 4.6-10.5 10.3-10.5 1.4-6.6 7.1-11 13.7-11s12.3 4.4 13.7 11C51.4 19 56 23.5 56 29.5 56 35 52 40 46 40"
        fill="#FFF6EC"
        stroke="#F1770A"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M18 40v11a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3V40" fill="#FFF6EC" stroke="#F1770A" strokeWidth="3.2" strokeLinejoin="round" />
      <path d="M18 46h28" stroke="#F1770A" strokeWidth="3.2" />
      <path d="M26 30c0-3 1.6-5.5 4-6.5M38 24.5c1.8 1.2 3 3.2 3 5.5" stroke="#F7A65A" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function WheatSprig() {
  return (
    <svg viewBox="0 0 40 60" width="100%" height="100%">
      <path d="M8 56C14 40 22 22 34 4" stroke="#E9B27A" strokeWidth="2" fill="none" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${12 + i * 5.2} ${44 - i * 11}) rotate(-38)`}>
          <ellipse cx="-5" cy="0" rx="5.5" ry="2.4" fill="#F2C48F" />
          <ellipse cx="5" cy="-1" rx="5.5" ry="2.4" fill="#EBB176" />
        </g>
      ))}
    </svg>
  );
}

function Croissant() {
  return (
    <svg viewBox="0 0 220 150" width="100%" height="100%">
      <defs>
        <linearGradient id="mk-cr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F9BE62" />
          <stop offset="0.55" stopColor="#E9913A" />
          <stop offset="1" stopColor="#C8641F" />
        </linearGradient>
      </defs>
      {/* feuilles décoratives */}
      <g opacity="0.9">
        <path d="M150 22c18-10 40-6 52 6-16 8-36 8-52-6z" fill="#B9C98A" />
        <path d="M150 22c18 0 34 2 52 6" stroke="#8FA25F" strokeWidth="1.5" fill="none" />
        <path d="M168 128c10-16 28-22 44-18-8 14-26 22-44 18z" fill="#D8C28A" />
        <path d="M30 34c-4-14 4-26 16-30 2 14-4 26-16 30z" fill="#E7C996" />
      </g>
      {/* croissant : 5 lobes */}
      <g stroke="#A9541A" strokeOpacity="0.45" strokeWidth="2">
        <ellipse cx="48" cy="102" rx="20" ry="15" transform="rotate(-50 48 102)" fill="url(#mk-cr)" />
        <ellipse cx="176" cy="100" rx="20" ry="15" transform="rotate(50 176 100)" fill="url(#mk-cr)" />
        <ellipse cx="78" cy="84" rx="28" ry="24" transform="rotate(-30 78 84)" fill="url(#mk-cr)" />
        <ellipse cx="146" cy="84" rx="28" ry="24" transform="rotate(30 146 84)" fill="url(#mk-cr)" />
        <ellipse cx="112" cy="74" rx="34" ry="32" fill="url(#mk-cr)" />
      </g>
      {/* reflets */}
      <ellipse cx="102" cy="58" rx="12" ry="6" fill="#FFF3D6" opacity="0.55" transform="rotate(-12 102 58)" />
      <ellipse cx="70" cy="72" rx="8" ry="4" fill="#FFF3D6" opacity="0.45" transform="rotate(-35 70 72)" />
      <ellipse cx="150" cy="72" rx="8" ry="4" fill="#FFF3D6" opacity="0.4" transform="rotate(30 150 72)" />
      {/* pistaches / éclats */}
      {[
        [96, 46],
        [124, 50],
        [110, 40],
      ].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="3" ry="1.6" fill="#FBE7C6" transform={`rotate(${i * 30} ${x} ${y})`} />
      ))}
    </svg>
  );
}

function LayerCake() {
  return (
    <svg viewBox="0 0 240 170" width="100%" height="100%">
      <ellipse cx="110" cy="152" rx="96" ry="13" fill="#E9D9C6" />
      <ellipse cx="110" cy="148" rx="92" ry="11" fill="#F7EEE3" />
      {/* génoise */}
      <path d="M38 76h144v62c0 6-32 11-72 11s-72-5-72-11z" fill="#F6DDB5" />
      <path d="M38 98h144" stroke="#F4B6A4" strokeWidth="7" />
      <path d="M38 120h144" stroke="#F4B6A4" strokeWidth="7" />
      <path d="M38 98h144" stroke="#FFF7EE" strokeWidth="2.5" />
      {/* crème qui coule */}
      <path
        d="M38 76c0-7 32-12 72-12s72 5 72 12v6c0 3-4 3-5 0s-6-2-6 4-6 6-6 0 -5-5-9-2-3 9-8 9-3-8-8-8-4 4-9 4-4-6-10-6-5 8-10 8-4-6-9-6-5 5-10 5-3-6-8-6-6 9-11 9-4-8-8-8-4 3-5 0z"
        fill="#FFFBF5"
      />
      <ellipse cx="110" cy="70" rx="72" ry="11" fill="#FFFFFF" />
      {/* framboises */}
      {[
        [72, 60],
        [96, 54],
        [122, 55],
        [146, 61],
        [108, 66],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="10" fill="#D9364F" />
          <circle cx={x - 3} cy={y - 3} r="2" fill="#F07A8A" />
          <circle cx={x + 3} cy={y + 1} r="1.6" fill="#B02238" />
          <circle cx={x - 1} cy={y + 4} r="1.6" fill="#B02238" />
        </g>
      ))}
      <path d="M118 44c6-10 18-12 26-8-6 8-16 10-26 8z" fill="#7FB069" />
      {/* framboises posées */}
      <circle cx="196" cy="140" r="9" fill="#D9364F" />
      <circle cx="210" cy="146" r="7" fill="#C72B44" />
      <circle cx="24" cy="142" r="7" fill="#C72B44" />
      {/* étincelles */}
      <path d="M200 30l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFFFFF" opacity="0.9" />
      <path d="M26 50l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}

function ChocolateCake() {
  return (
    <svg viewBox="0 0 160 120" width="100%" height="100%">
      <ellipse cx="80" cy="104" rx="66" ry="10" fill="#E8D3BD" />
      <ellipse cx="80" cy="100" rx="62" ry="8" fill="#FFFFFF" />
      <path d="M28 54h104v38c0 6-23 10-52 10s-52-4-52-10z" fill="#7A4326" />
      <path d="M28 70h104" stroke="#5E301A" strokeWidth="3" opacity="0.6" />
      <ellipse cx="80" cy="54" rx="52" ry="11" fill="#9B5A34" />
      <path d="M28 54c0 8 8 12 10 4s8 10 12 2 10 8 14 2 8 10 14 2 10 8 14 0 8 10 14 2 6 6 6-10" fill="#9B5A34" />
      {[50, 66, 80, 94, 110].map((x, i) => (
        <g key={i}>
          <ellipse cx={x} cy={i % 2 ? 48 : 46} rx="7" ry="5" fill="#FFF7EC" />
          <ellipse cx={x} cy={i % 2 ? 44 : 42} rx="4.5" ry="3.5" fill="#FFFFFF" />
        </g>
      ))}
      <circle cx="80" cy="34" r="6" fill="#C8203A" />
      <path d="M80 28c2-8 6-12 12-14" stroke="#5E8C3A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M134 24l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" fill="#F7B85C" opacity="0.8" />
      <path d="M22 30l2 4.5 4.5 2-4.5 2-2 4.5-2-4.5-4.5-2 4.5-2z" fill="#F7B85C" opacity="0.7" />
    </svg>
  );
}

function Cloche() {
  return (
    <svg viewBox="0 0 80 64" width="100%" height="100%">
      <ellipse cx="40" cy="54" rx="32" ry="5" fill="#E6DED4" />
      <path d="M12 50a28 26 0 0 1 56 0z" fill="#CFC5B9" />
      <path d="M20 44a20 18 0 0 1 14-16" stroke="#F1ECE6" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="20" r="4" fill="#BDB2A5" />
      <rect x="8" y="49" width="64" height="4" rx="2" fill="#B9AEA1" />
    </svg>
  );
}

export const ILLUSTRATIONS = {
  chefHat: ChefHat,
  wheat: WheatSprig,
  croissant: Croissant,
  layerCake: LayerCake,
  chocolateCake: ChocolateCake,
  cloche: Cloche,
};

export type IllustrationName = keyof typeof ILLUSTRATIONS;

/** Illustration décorative : jamais cliquable, jamais lue par les lecteurs d'écran. */
export default function Illustration({ name, sx }: { name: IllustrationName; sx?: SxProps }) {
  const Art = ILLUSTRATIONS[name];
  return (
    <Box aria-hidden sx={{ pointerEvents: 'none', userSelect: 'none', lineHeight: 0, flexShrink: 0, ...sx }}>
      <Art />
    </Box>
  );
}
