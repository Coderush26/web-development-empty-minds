'use client';

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, Polygon, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import fleetData from '@/lib/fleet.json';

interface CrisisMapProps {
  ships: any[];
  alerts?: any[];
  zones?: any[];
  onShipClick: (ship: any) => void;
  selectedShip: any;
  onZoneCreated?: (polygon: any[]) => void;
  showBoundaryPolygon: boolean;
  showGeofences: boolean;
  showShipPaths: boolean;
}

function getShipPosition(ship: any): [number, number] {
  if (Array.isArray(ship?.position)) {
    return ship.position as [number, number];
  }
  if (ship?.position?.lat !== undefined && ship?.position?.lng !== undefined) {
    return [ship.position.lat, ship.position.lng] as [number, number];
  }
  return [0, 0] as [number, number];
}

function normalizePoint(point: any): [number, number] | null {
  if (Array.isArray(point) && point.length >= 2) {
    return [Number(point[0]), Number(point[1])];
  }
  if (point?.lat !== undefined && point?.lng !== undefined) {
    return [Number(point.lat), Number(point.lng)];
  }
  return null;
}

function getStatusColor(status: string): string {
  if (status === 'distressed' || status === 'out_of_fuel' || status === 'critical')
    return '#ef4444';
  if (status === 'rerouting' || status === 'insufficient_fuel' || status === 'warning')
    return '#f59e0b';
  if (status === 'arrived') return '#60a5fa';
  if (status === 'stopped' || status === 'stranded') return '#94a3b8';
  return '#10b981';
}

function DrawControl({ onZoneCreated }: { onZoneCreated?: (polygon: any[]) => void }) {
  const map = useMap();

  useEffect(() => {
    const loadDraw = async () => {
      try {
        require('leaflet-draw/dist/leaflet.draw.css');
        await import('leaflet-draw');
        const FeatureGroup = L.FeatureGroup as any;
        const drawnItems = new FeatureGroup();
        map.addLayer(drawnItems);

        const DrawControl = (L as any).Control.Draw;
        const drawControl = new DrawControl({
          draw: {
            polygon: true,
            polyline: true,
            circle: false,
            rectangle: true,
            marker: false,
            circlemarker: false,
          },
          edit: {
            featureGroup: drawnItems,
            remove: true,
          },
        });

        map.addControl(drawControl);

        if (onZoneCreated) {
          map.on((L as any).Draw.Event.CREATED, (e: any) => {
            const layer = e.layer;
            if (layer instanceof (L as any).Polygon || layer instanceof (L as any).Rectangle) {
              const latlngs = layer.getLatLngs()[0];
              const polygon = latlngs.map((ll: any) => ({ lat: ll.lat, lng: ll.lng }));
              onZoneCreated(polygon);
            }
          });
        }
      } catch (err) {
        console.warn('Leaflet Draw not available, continuing without it');
      }
    };

    loadDraw();

    return () => {
      if ((L as any).Draw && (L as any).Draw.Event) {
        map.off((L as any).Draw.Event.CREATED);
      }
    };
  }, [map, onZoneCreated]);

  return null;
}

// ─── Animated Ship Marker with Heading & Radar Rings ──────────────────────
function ShipMarker({ ship, onShipClick, isSelected, hasProximityAlert }: {
  ship: any;
  onShipClick: (ship: any) => void;
  isSelected: boolean;
  hasProximityAlert: boolean;
}) {
  const color = getStatusColor(ship.status);
  const heading = typeof ship.heading === 'number' ? ship.heading : 0;
  const markerSize = isSelected ? 14 : 10;
  const ringColor = hasProximityAlert ? '#ef4444' : color;

  const iconHtml = `
    <div style="
      width: ${markerSize * 2}px;
      height: ${markerSize * 2}px;
      position: relative;
    ">
      <!-- Radar pulse ring 1 -->
      <div style="
        position: absolute;
        inset: -6px;
        border: 1.5px solid ${ringColor};
        border-radius: 50%;
        opacity: 0.5;
        animation: radarPulse 2s ease-out infinite;
      "></div>
      <!-- Radar pulse ring 2 -->
      <div style="
        position: absolute;
        inset: -6px;
        border: 1.5px solid ${ringColor};
        border-radius: 50%;
        opacity: 0.3;
        animation: radarPulse 2s ease-out infinite 0.7s;
      "></div>
      ${hasProximityAlert ? `
      <!-- Danger pulse ring -->
      <div style="
        position: absolute;
        inset: -10px;
        border: 2px solid #ef4444;
        border-radius: 50%;
        opacity: 0.6;
        animation: radarPulse 1.2s ease-out infinite;
      "></div>` : ''}
      <!-- Ship body -->
      <div style="
        width: 100%;
        height: 100%;
        background: ${color};
        border: ${isSelected ? 3 : 2}px solid #ffffff;
        border-radius: 50%;
        position: relative;
        box-shadow: 0 0 ${isSelected ? 12 : 6}px ${color}80;
        transition: all 0.3s ease;
      ">
        <!-- Heading indicator arrow -->
        <div style="
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%) rotate(${heading}deg);
          transform-origin: bottom center;
          width: 0;
          height: 0;
          border-left: 3px solid transparent;
          border-right: 3px solid transparent;
          border-bottom: 7px solid ${color};
          filter: brightness(1.4);
        "></div>
      </div>
    </div>
  `;

  const icon = L.divIcon({
    html: iconHtml,
    className: '',
    iconSize: [markerSize * 2, markerSize * 2],
    iconAnchor: [markerSize, markerSize],
  });

  return (
    <Marker
      position={getShipPosition(ship)}
      icon={icon}
      eventHandlers={{
        click: () => onShipClick(ship),
      }}
    >
      <Popup className="dark-popup">
        <div className="flex flex-col gap-1 text-sm text-slate-800">
          <div className="font-bold text-base mb-1">{ship.name}</div>
          <div><span className="font-semibold text-gray-500">ID:</span> {ship.shipId}</div>
          <div><span className="font-semibold text-gray-500">Status:</span> {ship.status}</div>
          <div><span className="font-semibold text-gray-500">Destination:</span> {ship.destination}</div>
          <div><span className="font-semibold text-gray-500">Speed:</span> {ship.speed} knots</div>
          <div><span className="font-semibold text-gray-500">Fuel:</span> {typeof ship.fuel === 'number' ? ship.fuel.toFixed(0) : ship.fuel} tons</div>
          <div><span className="font-semibold text-gray-500">Cargo:</span> {ship.cargo}</div>
        </div>
      </Popup>
    </Marker>
  );
}

export function CrisisMap({
  ships,
  alerts = [],
  zones = [],
  onShipClick,
  selectedShip,
  onZoneCreated,
  showBoundaryPolygon,
  showGeofences,
  showShipPaths,
}: CrisisMapProps) {
  const { north, south, east, west } = fleetData.boundingBox;
  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;
  const navigablePolygon = (fleetData.navigableWater ?? []).map((point: any) =>
    Array.isArray(point) ? [Number(point[0]), Number(point[1])] : [Number(point.lat), Number(point.lng)],
  ) as [number, number][];

  // Identify ships in active proximity alerts
  const proximityAlertShipIds = new Set<string>();
  const activeProximityAlerts = alerts.filter(
    (a: any) => !a.read && !a.acknowledged && a.type === 'PROXIMITY_WARNING'
  );
  for (const alert of activeProximityAlerts) {
    if (alert.shipId) proximityAlertShipIds.add(alert.shipId);
    if (alert.shipIdB) proximityAlertShipIds.add(alert.shipIdB);
  }

  return (
    <div className="relative w-full h-full">
      {/* CSS Animations */}
      <style>{`
        @keyframes radarPulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes dangerLineDash {
          to { stroke-dashoffset: -20; }
        }
      `}</style>

      <MapContainer
        center={[centerLat, centerLng]}
        zoom={6}
        className="w-full h-full dark"
        style={{ filter: 'invert(0.93) hue-rotate(200deg)' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {onZoneCreated && <DrawControl onZoneCreated={onZoneCreated} />}

        {/* Navigable water boundary */}
        {showBoundaryPolygon && (
          <Polygon
            positions={navigablePolygon}
            pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.12, color: '#3b82f6', weight: 1, dashArray: '4 4' }}
          />
        )}

        {/* Restricted zones */}
        {showGeofences && zones.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.polygon.map((p: any) => [p.lat, p.lng])}
            pathOptions={{ fillColor: '#ef4444', fillOpacity: 0.25, color: '#ef4444', weight: 2, dashArray: '5, 5' }}
          >
            <Popup className="dark-popup">
              <div className="text-sm font-bold text-red-600 mb-1">⚠ Restricted Zone</div>
              <div className="text-xs text-gray-800">{zone.name}</div>
            </Popup>
          </Polygon>
        ))}

        {/* Ship route paths */}
        {showShipPaths && ships.map((ship) => {
          const currentPos = normalizePoint(ship?.position);
          const pathPoints = Array.isArray(ship?.path)
            ? ship.path.map((point: any) => normalizePoint(point)).filter(Boolean)
            : [];
          const polylinePoints = [currentPos, ...pathPoints].filter(Boolean) as [number, number][];
          if (polylinePoints.length < 2) return null;
          return (
            <Polyline
              key={`path-${ship.shipId}`}
              positions={polylinePoints}
              pathOptions={{
                color: getStatusColor(ship.status),
                weight: 2,
                dashArray: '6,4',
                opacity: 0.7,
              }}
            />
          );
        })}

        {/* Port markers */}
        {fleetData.ports.map((port) => (
          <CircleMarker
            key={port.id}
            center={port.position as [number, number]}
            radius={6}
            pathOptions={{ fillColor: '#94a3b8', fillOpacity: 0.9, color: '#64748b', weight: 2 }}
          >
            <Popup className="dark-popup">
              <div className="text-sm font-semibold text-slate-800">{port.name}</div>
              <div className="text-xs text-gray-500">ID: {port.id}</div>
              <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Port Facility</div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Ship markers with radar rings */}
        {ships.map((ship) => (
          <ShipMarker
            key={ship.shipId}
            ship={ship}
            onShipClick={onShipClick}
            isSelected={!!selectedShip && selectedShip.shipId === ship.shipId}
            hasProximityAlert={proximityAlertShipIds.has(ship.shipId)}
          />
        ))}

        {/* Proximity warning circles */}
        {activeProximityAlerts
          .flatMap((alert: any) => {
            const radiusM = Math.max(300, Number(alert?.metadata?.thresholdKm ?? 2) * 1000);
            const shipsInPair = ships.filter((s) => s.shipId === alert.shipId || s.shipId === alert.shipIdB);
            return shipsInPair.map((ship) => (
              <Circle
                key={`proximity-limit-${alert.id}-${ship.shipId}`}
                center={getShipPosition(ship)}
                radius={radiusM}
                pathOptions={{
                  color: '#ef4444',
                  fillColor: '#ef4444',
                  fillOpacity: 0.06,
                  weight: 2,
                  dashArray: '6 6',
                }}
              />
            ));
          })}

        {/* Danger lines between proximity pairs */}
        {activeProximityAlerts.map((alert: any) => {
          const shipA = ships.find((s) => s.shipId === alert.shipId);
          const shipB = ships.find((s) => s.shipId === alert.shipIdB);
          if (!shipA || !shipB) return null;
          const posA = getShipPosition(shipA);
          const posB = getShipPosition(shipB);
          return (
            <Polyline
              key={`danger-line-${alert.id}`}
              positions={[posA, posB]}
              pathOptions={{
                color: '#ef4444',
                weight: 3,
                dashArray: '8 8',
                opacity: 0.8,
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
