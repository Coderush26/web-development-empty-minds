'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import fleetData from '@/lib/fleet.json';

interface CrisisMapProps {
  ships: any[];
  zones?: any[];
  onShipClick: (ship: any) => void;
  selectedShip: any;
  onZoneCreated?: (polygon: any[]) => void;
  showBoundaryPolygon: boolean;
  showGeofences: boolean;
  showShipPaths: boolean;
}

function getShipPosition(ship: any) {
  if (Array.isArray(ship?.position)) {
    return ship.position;
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

function ShipMarker({ ship, onShipClick, isSelected }: { ship: any; onShipClick: (ship: any) => void; isSelected: boolean }) {
  const getColor = (status: string) => {
    if (status === 'normal') return '#10b981';
    if (status === 'warning') return '#f59e0b';
    return '#ef4444';
  };

  const markerSize = isSelected ? 12 : 8;
  const iconHtml = `<div style="
    width: 100%;
    height: 100%;
    background-color: ${getColor(ship.status)};
    border: ${isSelected ? 3 : 2}px solid #ffffff;
    border-radius: 50%;
    opacity: 0.9;
  "></div>`;

  const icon = L.divIcon({
    html: iconHtml,
    className: 'transition-transform duration-1000 ease-linear',
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
          <div><span className="font-semibold text-gray-500">Fuel:</span> {ship.fuel} tons</div>
          <div><span className="font-semibold text-gray-500">Cargo:</span> {ship.cargo}</div>
        </div>
      </Popup>
    </Marker>
  );
}

export function CrisisMap({ ships, zones = [], onShipClick, selectedShip, onZoneCreated, showBoundaryPolygon, showGeofences, showShipPaths }: CrisisMapProps) {
  const { north, south, east, west } = fleetData.boundingBox;
  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;
  const navigablePolygon = (fleetData.navigableWater ?? []).map((point: any) =>
    Array.isArray(point) ? [Number(point[0]), Number(point[1])] : [Number(point.lat), Number(point.lng)],
  ) as [number, number][];

  return (
    <div className="relative w-full h-full">
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

        {showBoundaryPolygon && (
          <Polygon
            positions={navigablePolygon}
            pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.2, color: '#3b82f6', weight: 1 }}
          />
        )}

        {showGeofences && zones.map((zone) => (
          <Polygon
            key={zone.id}
            positions={zone.polygon.map((p: any) => [p.lat, p.lng])}
            pathOptions={{ fillColor: '#ef4444', fillOpacity: 0.3, color: '#ef4444', weight: 2, dashArray: '5, 5' }}
          >
            <Popup className="dark-popup">
              <div className="text-sm font-bold text-red-600 mb-1">Restricted Zone</div>
              <div className="text-xs text-gray-800">{zone.name}</div>
            </Popup>
          </Polygon>
        ))}

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
              pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '6,4', opacity: 0.85 }}
            />
          );
        })}

        {fleetData.ports.map((port) => (
          <CircleMarker
            key={port.id}
            center={port.position as [number, number]}
            radius={5}
            pathOptions={{ fillColor: '#9ca3af', fillOpacity: 0.8, color: '#4b5563', weight: 2 }}
          >
            <Popup className="dark-popup">
              <div className="text-sm font-semibold text-slate-800">{port.name}</div>
              <div className="text-xs text-gray-500">ID: {port.id}</div>
              <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Port Facility</div>
            </Popup>
          </CircleMarker>
        ))}

        {ships.map((ship) => (
          <ShipMarker
            key={ship.shipId}
            ship={ship}
            onShipClick={onShipClick}
            isSelected={!!selectedShip && selectedShip.shipId === ship.shipId}
          />
        ))}
      </MapContainer>
    </div>
  );
}

