import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ScanResult } from '../types';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapCenter {
  id: string;
  name: string;
  city: string;
  state?: string;
  lat: number;
  lng: number;
  scanCount: number;
  lastActivity: number;
  status: 'active' | 'busy' | 'idle';
  traffic: number;
}

interface GeographicMapProps {
  centers: MapCenter[];
}

// Custom marker icons based on status
const createCustomIcon = (status: 'active' | 'busy' | 'idle', traffic: number) => {
  const getColor = () => {
    switch (status) {
      case 'busy': return '#ef4444'; // Red
      case 'active': return '#22c55e'; // Green  
      case 'idle': return '#64748b'; // Gray
      default: return '#64748b';
    }
  };
  
  const size = Math.max(20, Math.min(40, 20 + traffic / 5)); // Size based on traffic
  
  return new L.DivIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${getColor()};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: white;
        font-weight: bold;
      ">
        ${status === 'busy' ? '!' : status === 'active' ? '✓' : '●'}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

// Component to fit map bounds to markers
const FitBounds: React.FC<{ centers: MapCenter[] }> = ({ centers }) => {
  const map = useMap();
  
  useEffect(() => {
    if (centers.length > 0) {
      const bounds = L.latLngBounds(centers.map(center => [center.lat, center.lng]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, centers]);
  
  return null;
};

const GeographicMap: React.FC<GeographicMapProps> = ({ centers }) => {
  console.log('🗺️ GeographicMap rendering with', centers.length, 'centers:', centers);
  
  // Fallback sample centers if no real data
  const fallbackCenters: MapCenter[] = [
    {
      id: 'fallback-1',
      name: 'NYC Hub',
      city: 'New York', 
      state: 'NY',
      lat: 40.7128,
      lng: -74.0060,
      scanCount: 25,
      lastActivity: Date.now(),
      status: 'active',
      traffic: 75
    },
    {
      id: 'fallback-2',
      name: 'LA Hub',
      city: 'Los Angeles',
      state: 'CA', 
      lat: 34.0522,
      lng: -118.2437,
      scanCount: 18,
      lastActivity: Date.now() - 3600000,
      status: 'busy',
      traffic: 90
    },
    {
      id: 'fallback-3',
      name: 'Chicago Hub',
      city: 'Chicago',
      state: 'IL',
      lat: 41.8781,
      lng: -87.6298,
      scanCount: 12,
      lastActivity: Date.now() - 7200000,
      status: 'idle',
      traffic: 30
    }
  ];
  
  const displayCenters = centers.length > 0 ? centers : fallbackCenters;
  console.log('🗺️ Using centers for map:', displayCenters);
  
  // Center of US for initial view
  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;

  return (
    <div className="h-full w-full rounded-lg overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
      >
        {/* OpenStreetMap tiles - completely free */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          className="map-tiles"
        />
        
        {/* Alternative dark theme tiles 
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          className="map-tiles"
        />
        */}
        
        {/* Fit bounds to show all markers */}
        <FitBounds centers={displayCenters} />
        
        {/* Sorting center markers */}
        {displayCenters.map((center) => (
          <Marker
            key={center.id}
            position={[center.lat, center.lng]}
            icon={createCustomIcon(center.status, center.traffic)}
          >
            <Popup className="custom-popup">
              <div className="p-2">
                <h3 className="font-bold text-lg text-gray-800 mb-2">{center.name}</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div><strong>Location:</strong> {center.city}{center.state ? `, ${center.state}` : ''}</div>
                  <div><strong>Status:</strong> 
                    <span className={`ml-1 font-medium ${
                      center.status === 'busy' ? 'text-red-600' :
                      center.status === 'active' ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {center.status.toUpperCase()}
                    </span>
                  </div>
                  <div><strong>Traffic Load:</strong> <span className="font-mono text-blue-600">{center.traffic}%</span></div>
                  <div><strong>Total Scans:</strong> <span className="font-mono text-purple-600">{center.scanCount}</span></div>
                  <div><strong>Last Activity:</strong> {new Date(center.lastActivity).toLocaleString()}</div>
                </div>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -20]} permanent={false}>
              <div className="text-xs">
                <strong>{center.name}</strong><br/>
                {center.scanCount} scans | {center.traffic}% load
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default GeographicMap;