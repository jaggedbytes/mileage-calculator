import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface TripMapProps {
  trip: {
    id: string;
    startLatitude: number;
    startLongitude: number;
    endLatitude: number;
    endLongitude: number;
    coordinates: Array<{lat: number, lng: number, timestamp: string}>;
    distance: number;
    startTime: string;
    endTime: string;
  };
  isExpanded: boolean;
  onToggle: () => void;
}

export default function TripMap({ trip, isExpanded, onToggle }: TripMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map only when expanded
  useEffect(() => {
    if (!mapRef.current || !isExpanded) return;

    // Initialize map
    mapInstanceRef.current = L.map(mapRef.current).setView(
      [trip.startLatitude, trip.startLongitude],
      13,
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapInstanceRef.current);

    // Create custom markers
    const startIcon = L.divIcon({
      className: "custom-marker",
      html: `<div style="background-color: #22c55e; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">S</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    const endIcon = L.divIcon({
      className: "custom-marker",
      html: `<div style="background-color: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px;">E</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    // Add start marker
    startMarkerRef.current = L.marker([trip.startLatitude, trip.startLongitude], {
      icon: startIcon,
    }).addTo(mapInstanceRef.current);

    startMarkerRef.current.bindPopup(`
      <div class="p-2">
        <div class="font-semibold text-green-600">START</div>
        <div class="text-sm text-gray-600">${new Date(trip.startTime).toLocaleString()}</div>
        <div class="text-xs text-gray-500 mt-1">
          Lat: ${trip.startLatitude.toFixed(6)}<br>
          Lng: ${trip.startLongitude.toFixed(6)}
        </div>
      </div>
    `);

    // Add end marker
    endMarkerRef.current = L.marker([trip.endLatitude, trip.endLongitude], {
      icon: endIcon,
    }).addTo(mapInstanceRef.current);

    endMarkerRef.current.bindPopup(`
      <div class="p-2">
        <div class="font-semibold text-red-600">END</div>
        <div class="text-sm text-gray-600">${new Date(trip.endTime).toLocaleString()}</div>
        <div class="text-xs text-gray-500 mt-1">
          Lat: ${trip.endLatitude.toFixed(6)}<br>
          Lng: ${trip.endLongitude.toFixed(6)}
        </div>
      </div>
    `);

    // Add polyline if we have coordinates
    if (trip.coordinates && Array.isArray(trip.coordinates) && trip.coordinates.length > 0) {
      const latLngs = trip.coordinates.map(coord => [coord.lat, coord.lng] as [number, number]);
      
      polylineRef.current = L.polyline(latLngs, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8,
      }).addTo(mapInstanceRef.current);

      // Fit map to show the entire route
      const group = new L.FeatureGroup([startMarkerRef.current, endMarkerRef.current, polylineRef.current]);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    } else {
      // If no coordinates, just fit to start and end markers
      const group = new L.FeatureGroup([startMarkerRef.current, endMarkerRef.current]);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isExpanded]); // Only depend on isExpanded, not the entire trip object

  return (
    <div className="mt-3">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="flex items-center gap-2 w-full"
      >
        <MapPin className="h-4 w-4" />
        {isExpanded ? "Hide Map" : "Show Map"}
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      
      {isExpanded && (
        <div className="mt-2">
          <div
            ref={mapRef}
            className="w-full h-64 rounded-lg border"
            style={{ minHeight: '256px' }}
          />
          <div className="mt-2 text-xs text-muted-foreground text-center">
            {trip.coordinates && Array.isArray(trip.coordinates) && trip.coordinates.length > 0 
              ? `Route with ${trip.coordinates.length} GPS points` 
              : 'Direct path between start and end points'
            }
          </div>
        </div>
      )}
    </div>
  );
}
