import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  location: string;
  zoom?: number;
}

export function MapView({ location, zoom = 13 }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current).setView([18.5204, 73.8567], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // For demo, using a default marker location
    // In production, you'd want to use a geocoding service
    L.marker([18.5204, 73.8567]).addTo(map);

    return () => {
      map.remove();
    };
  }, [location, zoom]);

  return <div ref={mapRef} className="w-full h-[300px] rounded-lg" />;
}