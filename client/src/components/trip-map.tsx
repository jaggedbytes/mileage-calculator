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
  const [isMapActive, setIsMapActive] = useState(false);

  // Initialize map only when expanded
  useEffect(() => {
    if (!mapRef.current || !isExpanded) return;

    // Initialize map with all interactions disabled by default
    mapInstanceRef.current = L.map(mapRef.current, {
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      dragging: false
    }).setView(
      [trip.startLatitude, trip.startLongitude],
      13,
    );

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(mapInstanceRef.current);

    // Enable all interactions when map is clicked/focused
    const enableInteractions = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.scrollWheelZoom.enable();
        mapInstanceRef.current.doubleClickZoom.enable();
        mapInstanceRef.current.touchZoom.enable();
        mapInstanceRef.current.boxZoom.enable();
        mapInstanceRef.current.keyboard.enable();
        mapInstanceRef.current.dragging.enable();
      }
    };

    // Disable all interactions when map loses focus
    const disableInteractions = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.scrollWheelZoom.disable();
        mapInstanceRef.current.doubleClickZoom.disable();
        mapInstanceRef.current.touchZoom.disable();
        mapInstanceRef.current.boxZoom.disable();
        mapInstanceRef.current.keyboard.disable();
        mapInstanceRef.current.dragging.disable();
      }
    };

    // Add event listeners for focus/blur (mouse and touch)
    mapInstanceRef.current.on('click', () => {
      enableInteractions();
      setIsMapActive(true);
    });
    mapInstanceRef.current.on('mouseenter', () => {
      enableInteractions();
      setIsMapActive(true);
    });
    mapInstanceRef.current.on('mouseleave', () => {
      disableInteractions();
      setIsMapActive(false);
    });
    
    // Touch events for mobile devices
    mapInstanceRef.current.on('touchstart', () => {
      enableInteractions();
      setIsMapActive(true);
    });
    mapInstanceRef.current.on('touchend', () => {
      // Keep interactions enabled after touch ends (mobile users expect this)
      // Only disable if they touch outside the map
    });
    
    // Disable interactions when clicking/touching outside the map
    const handleClickOutside = (event: MouseEvent) => {
      if (mapRef.current && !mapRef.current.contains(event.target as Node)) {
        disableInteractions();
        setIsMapActive(false);
      }
    };
    
    const handleTouchOutside = (event: TouchEvent) => {
      if (mapRef.current && !mapRef.current.contains(event.target as Node)) {
        disableInteractions();
        setIsMapActive(false);
      }
    };
    
    // Disable interactions when vertical scroll is detected (user scrolling the page)
    const handleVerticalScroll = (event: WheelEvent) => {
      if (isMapActive && event.deltaY !== 0) {
        // Vertical scroll detected while map is active - lock the map
        disableInteractions();
        setIsMapActive(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('touchstart', handleTouchOutside, { passive: true });
    document.addEventListener('wheel', handleVerticalScroll, { passive: true });

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
      // Clean up event listeners
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleTouchOutside);
      document.removeEventListener('wheel', handleVerticalScroll);
      
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
          <div className="relative">
            <div
              ref={mapRef}
              className="w-full h-64 rounded-lg border z-40"
              style={{ minHeight: '256px' }}
            />
            {!isMapActive && (
              <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center z-50 pointer-events-none">
                <div className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-md shadow-lg">
                  <p className="text-sm font-medium text-gray-700">Tap to interact with map</p>
                </div>
              </div>
            )}
          </div>
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
