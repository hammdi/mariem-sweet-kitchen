import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';
import type { LatLng } from '../../utils/geo';

/** Centre par défaut : Tunis (si aucun lieu n'est encore placé). */
export const DEFAULT_CENTER: LatLng = { lat: 36.8065, lng: 10.1815 };

export interface MapMarker {
  id: string;
  position: LatLng;
  kind: 'home' | 'source' | 'selected' | 'muted';
  label: string;
  tooltip?: string;
  permanent?: boolean; // étiquette toujours visible
  onClick?: () => void;
}

const COLORS: Record<MapMarker['kind'], string> = {
  home: '#2F9E62',
  source: '#F1770A',
  selected: '#DC3D43',
  muted: '#9A8C80',
};

// Icônes en HTML (pas d'image à charger) : pastille colorée + emoji
const iconFor = (m: MapMarker) =>
  L.divIcon({
    className: 'mk-map-pin',
    html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${COLORS[m.kind]};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.3);display:grid;place-items:center"><span style="transform:rotate(45deg);font-size:15px;line-height:1">${m.kind === 'home' ? '🏠' : m.kind === 'selected' ? '📍' : '🏪'}</span></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    tooltipAnchor: [0, -32],
  });

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Recentre quand la cible change (recherche, « Ma position », lien collé). */
function Recenter({ focus, zoom }: { focus?: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], zoom ?? Math.max(map.getZoom(), 15));
  }, [focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Cadre la carte pour montrer tous les lieux. */
function FitAll({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 14);
    if (points.length > 1)
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [40, 40],
        maxZoom: 15,
      });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Carte OpenStreetMap (gratuite, sans clé). Les tuiles viennent des serveurs
 * OpenStreetMap ; aucune donnée de l'atelier ne leur est envoyée.
 */
export default function MapView({
  markers,
  height = 320,
  center,
  focus,
  fit = false,
  onMapClick,
  draggableId,
  onDragEnd,
}: {
  markers: MapMarker[];
  height?: number | Record<string, number>;
  center?: LatLng;
  focus?: LatLng | null;
  fit?: boolean;
  onMapClick?: (p: LatLng) => void;
  draggableId?: string;
  onDragEnd?: (p: LatLng) => void;
}) {
  const start = center || markers[0]?.position || DEFAULT_CENTER;
  return (
    <Box
      sx={{
        height,
        borderRadius: 3,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 0, // la carte reste sous les menus et fenêtres
        '& .leaflet-container': { height: '100%', width: '100%', fontFamily: 'inherit' },
        '& .mk-map-pin': { background: 'none', border: 0 },
        cursor: onMapClick ? 'crosshair' : undefined,
      }}
      data-testid="map"
    >
      <MapContainer center={[start.lat, start.lng]} zoom={13} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={[m.position.lat, m.position.lng]}
            icon={iconFor(m)}
            draggable={m.id === draggableId}
            eventHandlers={{
              click: () => m.onClick?.(),
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng();
                onDragEnd?.({ lat: p.lat, lng: p.lng });
              },
            }}
          >
            <Tooltip direction="top" permanent={m.permanent}>
              <strong>{m.label}</strong>
              {m.tooltip ? <div>{m.tooltip}</div> : null}
            </Tooltip>
          </Marker>
        ))}
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        <Recenter focus={focus} />
        {fit && <FitAll points={markers.map((m) => m.position)} />}
      </MapContainer>
    </Box>
  );
}
