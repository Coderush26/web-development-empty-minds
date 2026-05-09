'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Ship } from '@/lib/mock-data';

interface CrisisMapProps {
  ships: Ship[];
  onShipClick: (ship: Ship) => void;
  selectedShip: Ship | null;
}

// Custom component to initialize Leaflet-Draw
function DrawControl() {
  const map = useMap();

  useEffect(() => {
    // Dynamically load leaflet-draw
    const loadDraw = async () => {
      try {
        // Import leaflet-draw styles
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
      } catch (err) {
        console.warn('Leaflet Draw not available, continuing without it');
      }
    };

    loadDraw();
  }, [map]);

  return null;
}

function ShipMarker({ ship, onShipClick, isSelected }: { ship: Ship; onShipClick: (ship: Ship) => void; isSelected: boolean }) {
  const getColor = (status: string) => {
    if (status === 'critical') return '#ef4444';
    if (status === 'warning') return '#f97316';
    return '#22c55e';
  };

  const markerSize = isSelected ? 12 : 8;

  return (
    <CircleMarker
      center={[ship.lat, ship.lng]}
      radius={markerSize}
      fill={true}
      fillColor={getColor(ship.status)}
      fillOpacity={0.9}
      color="#ffffff"
      weight={isSelected ? 3 : 2}
      eventHandlers={{
        click: () => onShipClick(ship),
      }}
    >
      <Popup className="dark-popup">
        <div className="text-sm font-semibold">{ship.name}</div>
        <div className="text-xs text-gray-600">Type: {ship.type}</div>
        <div className="text-xs text-gray-600">Speed: {ship.speed} knots</div>
      </Popup>
    </CircleMarker>
  );
}

export function CrisisMap({ ships, onShipClick, selectedShip }: CrisisMapProps) {
  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[40.0, 15.0]}
        zoom={6}
        className="w-full h-full dark"
        style={{ filter: 'invert(0.93) hue-rotate(200deg)' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DrawControl />
        {ships.map((ship) => (
          <ShipMarker
            key={ship.id}
            ship={ship}
            onShipClick={onShipClick}
            isSelected={selectedShip?.id === ship.id}
          />
        ))}
      </MapContainer>
    </div>
  );
}

