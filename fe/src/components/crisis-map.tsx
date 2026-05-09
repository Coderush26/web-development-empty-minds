'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap, Polygon } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Ship } from '@/lib/mock-data';
import fleetData from '@/lib/fleet.json';

interface CrisisMapProps {
  ships: Ship[];
  onShipClick: (ship: any) => void;
  selectedShip: any;
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

function ShipMarker({ ship, onShipClick, isSelected }: { ship: any; onShipClick: (ship: any) => void; isSelected: boolean }) {
  const getColor = (status: string) => {
    if (status === 'normal') return '#10b981';
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
      position={ship.position}
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

export function CrisisMap({ ships, onShipClick, selectedShip }: CrisisMapProps) {
  const { north, south, east, west } = fleetData.boundingBox;
  const centerLat = (north + south) / 2;
  const centerLng = (east + west) / 2;

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
        <DrawControl />
        
        {/* Play Area */}
        <Polygon 
          positions={fleetData.navigableWater as [number, number][]} 
          pathOptions={{ fillColor: '#3b82f6', fillOpacity: 0.2, color: '#3b82f6', weight: 1 }} 
        />

        {/* Ports */}
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

        {/* Ships from props (live state) */}
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

