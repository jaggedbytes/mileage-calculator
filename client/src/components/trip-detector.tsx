import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Car, Download, Play, MapPin, Loader2 } from "lucide-react";
import { useCachedDimoAuth } from "@/hooks/use-cached-auth";

interface Trip {
  id: string;
  startTime: string;
  endTime: string;
  distance: number;
  classification: string;
  notes: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
}

interface Vehicle {
  tokenId: number;
  owner: string;
  definition: {
    make: string;
    model: string;
    year: number;
  };
}

interface SharedVehiclesResponse {
  walletAddress: string;
  vehicles: Vehicle[];
  count: number;
}

interface TripDetectionResponse {
  message: string;
  trips: Trip[];
  vehicleId: string;
  from: string;
  to: string;
  detectionMethod: string;
}

function getCachedToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem("dimo_cached_token");
  }
  return null;
}

const fetchUserVehicles = async (
  walletAddress: string,
): Promise<SharedVehiclesResponse> => {
  const cachedToken = getCachedToken();

  if (!cachedToken) {
    throw new Error("No cached DIMO token found. Please authenticate first.");
  }

  const response = await fetch(
    `/api/dimo/vehicles?walletAddress=${encodeURIComponent(walletAddress)}`,
    {
      headers: {
        Authorization: `Bearer ${cachedToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch vehicles: ${response.statusText}`);
  }

  return response.json();
};

export default function TripDetector() {
  const { isAuthenticated, walletAddress } = useCachedDimoAuth();
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedTrips, setDetectedTrips] = useState<Trip[]>([]);
  const [detectionResult, setDetectionResult] = useState<TripDetectionResponse | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [isUpdatingClassification, setIsUpdatingClassification] = useState<string | null>(null);

  // Fetch user vehicles
  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery({
    queryKey: ["/api/dimo/vehicles", walletAddress],
    queryFn: () => fetchUserVehicles(walletAddress!),
    enabled: isAuthenticated && !!walletAddress,
  });

  const handleDetectTrips = async () => {
    if (!selectedVehicle || !walletAddress) return;

    setIsDetecting(true);
    try {
      console.log("Detecting trips for vehicle:", selectedVehicle, "user:", walletAddress);
      
      const response = await fetch(`/api/trips/detect/${selectedVehicle}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: walletAddress,
          from: new Date(dateRange.from).toISOString(),
          to: new Date(dateRange.to).toISOString()
        })
      });

      console.log("Trip detection response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error response:", errorText);
        throw new Error(`Failed to detect trips: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result: TripDetectionResponse = await response.json();
      console.log("Trip detection result:", result);
      setDetectedTrips(result.trips);
      setDetectionResult(result);
    } catch (error) {
      console.error("Error detecting trips:", error);
      alert(`Failed to detect trips: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleUpdateClassification = async (tripId: string, classification: string) => {
    setIsUpdatingClassification(tripId);
    try {
      const response = await fetch(`/api/trips/${tripId}/classification`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classification })
      });

      if (!response.ok) {
        throw new Error(`Failed to update classification: ${response.statusText}`);
      }

      // Update the local state
      setDetectedTrips(prev => 
        prev.map(trip => 
          trip.id === tripId 
            ? { ...trip, classification }
            : trip
        )
      );
    } catch (error) {
      console.error("Error updating classification:", error);
      alert(`Failed to update classification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdatingClassification(null);
    }
  };

  const handleExportCSV = async () => {
    if (!walletAddress || detectedTrips.length === 0) return;

    // Use the month from the first detected trip instead of current month
    const firstTripDate = new Date(detectedTrips[0].startTime);
    const tripMonth = firstTripDate.toISOString().slice(0, 7); // YYYY-MM format
    const url = `/api/mileage/export?userId=${encodeURIComponent(walletAddress)}&month=${tripMonth}`;
    
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `mileage-${tripMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDistance = (miles: number) => {
    return `${miles.toFixed(2)} mi`;
  };


  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Automatic Trip Detection</CardTitle>
          <CardDescription>
            Sign in with DIMO to automatically detect trips using your vehicle's ignition data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Please authenticate with DIMO to access trip detection features.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Automatic Trip Detection
          </CardTitle>
          <CardDescription>
            Detect trips automatically using your vehicle's ignition signals and GPS data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Vehicle</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full mt-1 p-2 border rounded-md"
                disabled={isDetecting || vehiclesLoading}
              >
                <option value="">Select a vehicle...</option>
                {vehiclesData?.vehicles?.map((vehicle) => (
                  <option key={vehicle.tokenId} value={vehicle.tokenId.toString()}>
                    {vehicle.definition.year} {vehicle.definition.make} {vehicle.definition.model} (Token ID: {vehicle.tokenId})
                  </option>
                ))}
              </select>
              {vehiclesLoading && (
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading vehicles...
                </div>
              )}
              {vehiclesError && (
                <div className="text-sm text-red-600 mt-1">
                  Failed to load vehicles: {vehiclesError.message}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Date Range</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="flex-1 p-2 border rounded-md"
                  disabled={isDetecting}
                />
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="flex-1 p-2 border rounded-md"
                  disabled={isDetecting}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleDetectTrips}
              disabled={!selectedVehicle || isDetecting}
              className="flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              {isDetecting ? "Detecting..." : "Detect Trips"}
            </Button>
            
            {detectedTrips.length > 0 && (
              <Button
                onClick={handleExportCSV}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            )}
          </div>

          {detectionResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                {detectionResult.message}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Detection method: {detectionResult.detectionMethod} | 
                Date range: {new Date(detectionResult.from).toLocaleDateString()} - {new Date(detectionResult.to).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {detectedTrips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Detected Trips ({detectedTrips.length})
            </CardTitle>
            <CardDescription>
              Trips automatically detected using ignition signals and GPS data
            </CardDescription>
          </CardHeader>
          <CardContent>
                <div className="space-y-3">
                  {detectedTrips.map((trip) => (
                    <div key={trip.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={trip.classification === 'business' ? 'default' : trip.classification === 'personal' ? 'secondary' : 'outline'}
                          >
                            {trip.classification}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatTime(trip.startTime)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatDistance(trip.distance)}</div>
                        </div>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-3">
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin className="h-3 w-3" />
                          Start: {trip.startLatitude.toFixed(4)}, {trip.startLongitude.toFixed(4)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          End: {trip.endLatitude.toFixed(4)}, {trip.endLongitude.toFixed(4)}
                        </div>
                      </div>

                      {/* Classification Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={trip.classification === 'business' ? 'default' : 'outline'}
                          onClick={() => handleUpdateClassification(trip.id, 'business')}
                          disabled={isUpdatingClassification === trip.id}
                          className="text-xs"
                        >
                          {isUpdatingClassification === trip.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : null}
                          Business
                        </Button>
                        <Button
                          size="sm"
                          variant={trip.classification === 'personal' ? 'default' : 'outline'}
                          onClick={() => handleUpdateClassification(trip.id, 'personal')}
                          disabled={isUpdatingClassification === trip.id}
                          className="text-xs"
                        >
                          Personal
                        </Button>
                        <Button
                          size="sm"
                          variant={trip.classification === 'other' ? 'default' : 'outline'}
                          onClick={() => handleUpdateClassification(trip.id, 'other')}
                          disabled={isUpdatingClassification === trip.id}
                          className="text-xs"
                        >
                          Other
                        </Button>
                      </div>
                      
                      {trip.notes && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {trip.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
