import { useState, useEffect } from "react";
import { Info } from "lucide-react";
import GpsMap from "@/components/gps-map";
import UserVehicles from "@/components/user-vehicles";

interface GpsData {
  lat: number;
  lng: number;
  hdop: number;
  timestamp: string;
}

export default function SharedVehicles() {
  const [gpsData, setGpsData] = useState<GpsData>({
    lat: 40.7128,
    lng: -74.006,
    hdop: 1.2,
    timestamp: new Date().toISOString()
  });
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [lastKnownLocation, setLastKnownLocation] = useState<{
    lat: number;
    lng: number;
  }>({
    lat: 40.7128,
    lng: -74.006,
  });
  const [focusLocation, setFocusLocation] = useState<GpsData | null>(null);

  const handleVehicleSelect = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
  };

  const handleLocationUpdate = (data: GpsData) => {
    setGpsData(data);
    setLastKnownLocation({ lat: data.lat, lng: data.lng });
    setFocusLocation(data);
    
    // Clear focus location after a short delay to allow map to center
    setTimeout(() => setFocusLocation(null), 100);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="shared-vehicles">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 min-h-[calc(100vh-9rem)]">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-3 order-2 lg:order-1">
            <UserVehicles 
              onVehicleSelect={handleVehicleSelect}
              onLocationUpdate={handleLocationUpdate}
            />
          </div>

          {/* Map Container */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="h-[600px] lg:h-full border rounded-lg overflow-hidden">
              <GpsMap 
                gpsData={gpsData}
                gpsStatus={{
                  status: "good-gps",
                  message: "Ready",
                  showOnMap: true,
                }}
                lastKnownLocation={lastKnownLocation}
                focusLocation={focusLocation}
              />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">About This Page</p>
              <p>
                This page shows your shared DIMO vehicles and their real-time location data. 
                Use the vehicle selector to view different vehicles and their GPS coordinates on the map.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

