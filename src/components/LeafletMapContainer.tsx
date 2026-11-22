import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Phone, Navigation } from 'lucide-react';
import { MapPinItem } from './InteractiveMap';

export interface TrafficCorridorItem {
  id: string;
  name: string;
  speed: string;
  status: string;
  color: string;
  path: [number, number][];
}

export interface LeafletMapContainerProps {
  centerLat: number;
  centerLng: number;
  centerLabel: string;
  zoom: number;
  currentTile: {
    name: string;
    url: string;
    attribution: string;
  };
  trafficVisible: boolean;
  trafficCorridors: TrafficCorridorItem[];
  filteredPins: MapPinItem[];
  onPinClick?: (pin: MapPinItem) => void;
  onMapReady?: (map: L.Map) => void;
}

const COLOR_MAP: Record<string, string> = {
  orange: '#f97316',
  blue: '#2563eb',
  green: '#10b981',
  red: '#ef4444',
  purple: '#9333ea',
  amber: '#f59e0b',
  indigo: '#4f46e5',
  pink: '#ec4899',
};

function getCategorySvg(icon?: string): string {
  switch (icon) {
    case 'food':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m16 2-2 20"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/><path d="M3 2v7c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V2"/></svg>`;
    case 'shop':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
    case 'hospital':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6v12"/><path d="M6 12h12"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`;
    case 'police':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`;
    case 'fire':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
    case 'fuel':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/></svg>`;
    case 'park':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></svg>`;
    case 'car':
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
    default:
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
  }
}

function createCustomPinIcon(color: string, icon?: string): L.DivIcon {
  const bg = COLOR_MAP[color] || '#4f46e5';
  const svg = getCategorySvg(icon);
  return L.divIcon({
    className: 'gis-custom-pin',
    html: `
      <div style="background-color: ${bg}; width: 30px; height: 30px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; color: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2.5px solid #ffffff; cursor: pointer; transition: transform 0.15s ease-in-out;">
        ${svg}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function createUserCenterIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: 'gis-user-center-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; pointer-events: none;">
        <div style="background: rgba(255,255,255,0.96); backdrop-filter: blur(4px); padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 1px solid #cbd5e1; font-size: 10px; font-weight: 800; color: #0f172a; white-space: pre; text-align: center; margin-bottom: 4px;">
          ${label}
        </div>
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 34px; height: 34px; border-radius: 9999px; background: rgba(59,130,246,0.35); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div style="width: 22px; height: 22px; border-radius: 9999px; background: rgba(59,130,246,0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(37,99,235,0.4);">
            <div style="width: 12px; height: 12px; border-radius: 9999px; background: #2563eb; border: 2.5px solid #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.25);"></div>
          </div>
        </div>
      </div>
    `,
    iconSize: [120, 60],
    iconAnchor: [60, 48],
    popupAnchor: [0, -50],
  });
}

const customPinIconCache = new Map<string, L.DivIcon>();
function getCachedCustomPinIcon(color: string, iconType?: string): L.DivIcon {
  const key = `${color}:${iconType || ''}`;
  let icon = customPinIconCache.get(key);
  if (!icon) {
    icon = createCustomPinIcon(color, iconType);
    customPinIconCache.set(key, icon);
  }
  return icon;
}

const userCenterIconCache = new Map<string, L.DivIcon>();
function getCachedUserCenterIcon(label: string): L.DivIcon {
  let icon = userCenterIconCache.get(label);
  if (!icon) {
    icon = createUserCenterIcon(label);
    userCenterIconCache.set(label, icon);
  }
  return icon;
}

function createClusterCustomIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  let dimension = 38;
  let bgColor = '#2563eb';
  let ringColor = 'rgba(59, 130, 246, 0.35)';

  if (count >= 20) {
    dimension = 46;
    bgColor = '#4338ca';
    ringColor = 'rgba(67, 56, 202, 0.35)';
  } else if (count >= 10) {
    dimension = 42;
    bgColor = '#4f46e5';
    ringColor = 'rgba(79, 70, 229, 0.35)';
  }

  return L.divIcon({
    html: `
      <div style="width: ${dimension}px; height: ${dimension}px; position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none;">
        <div style="width: ${dimension}px; height: ${dimension}px; position: absolute; inset: 0; border-radius: 9999px; background: ${ringColor}; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="width: ${dimension - 6}px; height: ${dimension - 6}px; position: relative; border-radius: 9999px; background: ${bgColor}; color: #ffffff; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
          ${count}
        </div>
      </div>
    `,
    className: 'gis-custom-cluster-marker',
    iconSize: L.point(dimension, dimension, true),
    iconAnchor: L.point(dimension / 2, dimension / 2, true),
  });
}

function MapController({
  center,
  zoom,
  onMapReady,
}: {
  center: [number, number];
  zoom: number;
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);

  useEffect(() => {
    try {
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) {
        map.setView(center, zoom, { animate: false });
        map.invalidateSize();
      }
    } catch {
      // ignore dimension calculation errors in detached or transitioning containers
    }
  }, [center[0], center[1], zoom, map]);

  return null;
}

export const LeafletMapContainer: React.FC<LeafletMapContainerProps> = ({
  centerLat,
  centerLng,
  centerLabel,
  zoom,
  currentTile,
  trafficVisible,
  trafficCorridors,
  filteredPins,
  onPinClick,
  onMapReady,
}) => {
  return (
    <MapContainer
      center={[centerLat, centerLng]}
      zoom={zoom}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom={true}
      style={{ width: '100%', height: '100%', zIndex: 0 }}
    >
      <MapController
        center={[centerLat, centerLng]}
        zoom={zoom}
        onMapReady={onMapReady}
      />

      {/* Street-Level Tiles Layer */}
      <TileLayer
        key={currentTile.name}
        url={currentTile.url}
        attribution={currentTile.attribution}
        maxZoom={19}
      />

      {/* User Current Locality Center Marker */}
      <Marker
        position={[centerLat, centerLng]}
        icon={getCachedUserCenterIcon(centerLabel)}
        title={`Current Center: ${centerLabel}`}
        alt={`Current Center: ${centerLabel}`}
      >
        <Popup>
          <div className="p-1 min-w-[160px] text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">
              Your Current Center
            </p>
            <h4 className="text-xs font-black text-slate-900 whitespace-pre-line mb-1">
              {centerLabel}
            </h4>
            <p className="text-[10px] text-slate-500 font-mono">
              Verified Center
            </p>
          </div>
        </Popup>
      </Marker>

      {/* Real GPS Traffic Arterial Polylines */}
      {trafficVisible &&
        trafficCorridors.map((c) => (
          <Polyline
            key={c.id}
            positions={c.path}
            pathOptions={{
              color: c.color,
              weight: 6,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
            <Popup>
              <div className="p-1 text-xs">
                <p className="font-extrabold text-slate-900">{c.name}</p>
                <p className="text-[11px] font-bold" style={{ color: c.color }}>
                  {c.speed} • {c.status}
                </p>
              </div>
            </Popup>
          </Polyline>
        ))}

      {/* High-Performance Clustered POI & Business Pins via react-leaflet-cluster */}
      <MarkerClusterGroup
        chunkedLoading
        iconCreateFunction={createClusterCustomIcon}
        maxClusterRadius={45}
        spiderfyOnMaxZoom={true}
        showCoverageOnHover={false}
      >
        {filteredPins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat!, pin.lng!]}
            icon={getCachedCustomPinIcon(pin.color, pin.icon)}
            title={pin.label || 'Neighborhood Location'}
            alt={pin.label || 'Neighborhood Location'}
            eventHandlers={{
              click: () => onPinClick?.(pin),
            }}
          >
            <Popup>
              <div className="p-1 min-w-[200px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-100 text-slate-700">
                    {pin.icon || 'Place'}
                  </span>
                  {pin.sublabel && (
                    <span className="text-[10px] text-slate-500 font-medium truncate">
                      {pin.sublabel}
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-black text-slate-900 leading-tight mb-1">
                  {pin.label}
                </h4>
                {pin.address && (
                  <p className="text-[10px] text-slate-600 mb-2 leading-relaxed">
                    {pin.address}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {pin.phone && (
                    <a
                      href={`tel:${pin.phone}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                    >
                      <Phone className="w-3 h-3" />
                      <span>Call</span>
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 ml-auto"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
};

export default LeafletMapContainer;
