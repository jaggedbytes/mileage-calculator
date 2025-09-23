import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Car, Download, Play, MapPin, Loader2, X, Check, Edit3, Save, X as XIcon, Clock } from "lucide-react";
import { useCachedDimoAuth } from "@/hooks/use-cached-auth";
import TripMap from "./trip-map";

interface Trip {
  id: string;
  startTime: string;
  endTime: string;
  distance: number;
  classification: string;
  notes: string;
  userNotes?: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  coordinates?: Array<{lat: number, lng: number, timestamp: string}>;
  excludedFromExport?: boolean;
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
  const [expandedMaps, setExpandedMaps] = useState<Set<string>>(new Set());
  const [excludedTrips, setExcludedTrips] = useState<Set<string>>(new Set());
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tripNotes, setTripNotes] = useState<Record<string, string>>({});
  const [showStickyExport, setShowStickyExport] = useState(false);
  const [odometerData, setOdometerData] = useState<{start: number | null, end: number | null} | null>(null);
  const [useKilometers, setUseKilometers] = useState(false);
  const [dataInterval, setDataInterval] = useState("1s");

  // Fetch user vehicles
  const { data: vehiclesData, isLoading: vehiclesLoading, error: vehiclesError } = useQuery({
    queryKey: ["/api/dimo/vehicles", walletAddress],
    queryFn: () => fetchUserVehicles(walletAddress!),
    enabled: isAuthenticated && !!walletAddress,
  });

  // Auto-expand all maps when trips are detected
  useEffect(() => {
    if (detectedTrips.length > 0) {
      const allTripIds = new Set(detectedTrips.map(trip => trip.id));
      setExpandedMaps(allTripIds);
    }
  }, [detectedTrips]);

  // Handle sticky export button visibility
  useEffect(() => {
    const handleScroll = () => {
      const exportButton = document.getElementById('export-button');
      if (exportButton) {
        const rect = exportButton.getBoundingClientRect();
        setShowStickyExport(rect.bottom < 0);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [detectedTrips]);

  // Extract odometer data from trip detection response
  const extractOdometerData = (trips: Trip[]) => {
    if (trips.length === 0) {
      setOdometerData(null);
      return;
    }
    
    // Get the first and last trip to determine odometer range
    const sortedTrips = trips.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    const firstTrip = sortedTrips[0];
    const lastTrip = sortedTrips[sortedTrips.length - 1];
    
    // Try to extract odometer from trip notes (where we store the raw data)
    let startOdometer = null;
    let endOdometer = null;
    
    try {
      if (firstTrip.notes) {
        const firstData = JSON.parse(firstTrip.notes);
        
        if (firstData.coordinates && firstData.coordinates.length > 0) {
          const firstTripStartTime = new Date(firstTrip.startTime).getTime();
          
          // Find coordinate closest to trip start time that has odometer data
          const coordsWithOdometer = firstData.coordinates
            .filter((c: any) => c.odometer !== null && c.odometer !== undefined)
            .map((c: any) => ({
              ...c,
              timeDiff: Math.abs(new Date(c.timestamp).getTime() - firstTripStartTime)
            }))
            .sort((a: any, b: any) => a.timeDiff - b.timeDiff);
            
          if (coordsWithOdometer.length > 0) {
            const closestCoord = coordsWithOdometer[0];
            startOdometer = closestCoord.odometer;
          }
        }
      }
      
      if (lastTrip.notes) {
        const lastData = JSON.parse(lastTrip.notes);
        
        if (lastData.coordinates && lastData.coordinates.length > 0) {
          const lastTripEndTime = new Date(lastTrip.endTime).getTime();
          
          // Find coordinate closest to trip end time that has odometer data
          const coordsWithOdometer = lastData.coordinates
            .filter((c: any) => c.odometer !== null && c.odometer !== undefined)
            .map((c: any) => ({
              ...c,
              timeDiff: Math.abs(new Date(c.timestamp).getTime() - lastTripEndTime)
            }))
            .sort((a: any, b: any) => a.timeDiff - b.timeDiff);
            
          if (coordsWithOdometer.length > 0) {
            const closestCoord = coordsWithOdometer[0];
            endOdometer = closestCoord.odometer;
          }
        }
      }
    } catch (error) {
      console.error('Error parsing odometer data from trips:', error);
    }
    
    setOdometerData({ start: startOdometer, end: endOdometer });
  };

  const handleDetectTrips = async () => {
    if (!selectedVehicle || !walletAddress) return;

    setIsDetecting(true);
    try {
      const response = await fetch(`/api/trips/detect/${selectedVehicle}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: walletAddress,
          from: new Date(dateRange.from).toISOString(), // Start of day (00:00:00)
          to: new Date(dateRange.to + 'T23:59:59.999Z').toISOString(), // End of day (23:59:59.999)
          interval: dataInterval
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error response:", errorText);
        throw new Error(`Failed to detect trips: ${response.status} ${response.statusText} - ${errorText}`);
      }

          const result: TripDetectionResponse = await response.json();
          setDetectedTrips(result.trips);
          setDetectionResult(result);
          
          // Extract odometer data from the detected trips
          extractOdometerData(result.trips);
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

  const toggleMap = (tripId: string) => {
    setExpandedMaps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  const toggleTripExclusion = (tripId: string) => {
    setExcludedTrips(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tripId)) {
        newSet.delete(tripId);
      } else {
        newSet.add(tripId);
      }
      return newSet;
    });
  };

  const handleEditNotes = (tripId: string) => {
    setEditingNotes(tripId);
  };

  const handleSaveNotes = async (tripId: string) => {
    const notes = tripNotes[tripId] || '';
    
    try {
      const response = await fetch(`/api/trips/${tripId}/notes`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userNotes: notes })
      });

      if (!response.ok) {
        throw new Error(`Failed to update notes: ${response.statusText}`);
      }

      // Update the local state
      setDetectedTrips(prev => 
        prev.map(trip => 
          trip.id === tripId 
            ? { ...trip, userNotes: notes }
            : trip
        )
      );
      
      setEditingNotes(null);
    } catch (error) {
      console.error("Error updating notes:", error);
      alert(`Failed to update notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancelNotes = (tripId: string) => {
    setEditingNotes(null);
    // Reset to original notes
    setTripNotes(prev => {
      const updated = { ...prev };
      delete updated[tripId];
      return updated;
    });
  };

  const handleExportCSV = async () => {
    if (!walletAddress || detectedTrips.length === 0 || !selectedVehicle) return;

    // Filter out excluded trips
    const includedTrips = detectedTrips.filter(trip => !excludedTrips.has(trip.id));
    
    if (includedTrips.length === 0) {
      alert('No trips to export. All trips have been excluded from export.');
      return;
    }

    // Get vehicle info for filename
    const selectedVehicleData = vehiclesData?.vehicles?.find(v => v.tokenId.toString() === selectedVehicle);
    const vehicleInfo = selectedVehicleData ? 
      `${selectedVehicleData.definition.year}-${selectedVehicleData.definition.make}-${selectedVehicleData.definition.model}`.replace(/\s+/g, '-') :
      `vehicle-${selectedVehicle}`;

    // Use the selected date range for filename
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    const dateRangeStr = `${fromDate.toISOString().slice(0, 10)}_to_${toDate.toISOString().slice(0, 10)}`;
    const tripMonth = fromDate.toISOString().slice(0, 7); // YYYY-MM format for backend filtering
    
    // Pass vehicle info as URL parameter to avoid server-side API call
    const vehicleInfoParam = selectedVehicleData ? 
      encodeURIComponent(`${selectedVehicleData.definition.year}-${selectedVehicleData.definition.make}-${selectedVehicleData.definition.model}`) :
      selectedVehicle;
    
    // Pass excluded trip IDs, odometer data, and units as parameters
    const excludedTripIds = Array.from(excludedTrips).join(',');
    const odometerDataParam = odometerData ? 
      encodeURIComponent(JSON.stringify({
        start: odometerData.start,
        end: odometerData.end
      })) : '';
    const url = `/api/mileage/export?userId=${encodeURIComponent(walletAddress)}&month=${tripMonth}&vehicleId=${selectedVehicle}&vehicleInfo=${vehicleInfoParam}&dateRange=${encodeURIComponent(dateRangeStr)}&excludedTrips=${encodeURIComponent(excludedTripIds)}&odometerData=${odometerDataParam}&useKilometers=${useKilometers}`;
    
    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `mileage-${vehicleInfo}-${dateRangeStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDistance = (miles: number) => {
    if (useKilometers) {
      return `${(miles * 1.60934).toFixed(2)} km`;
    } else {
      return `${miles.toFixed(2)} mi`;
    }
  };

  const formatDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    if (durationMinutes < 60) {
      return `${durationMinutes}m`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };


  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const formatTimeOnly = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
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
              <div className="flex flex-wrap gap-2 mt-1">
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

          <div className="flex flex-wrap items-center gap-4">
            {/* Distance Unit Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Distance Units:</span>
              <div className="flex bg-muted rounded-md p-1">
                <button
                  onClick={() => setUseKilometers(false)}
                  className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                    !useKilometers 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Miles
                </button>
                <button
                  onClick={() => setUseKilometers(true)}
                  className={`px-3 py-1 text-xs rounded-sm transition-colors ${
                    useKilometers 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Kilometers
                </button>
              </div>
            </div>

            {/* Data Interval Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Data Interval:</span>
              <select
                value={dataInterval}
                onChange={(e) => setDataInterval(e.target.value)}
                className="px-3 py-1 text-xs bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="300ms">300ms</option>
                <option value="1s">1s</option>
                <option value="5s">5s</option>
                <option value="30s">30s</option>
                <option value="1m">1m</option>
              </select>
            </div>     
          </div>

          <div className="flex flex-wrap items-center gap-4">
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
                id="export-button"
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
                Detection method: {detectionResult.detectionMethod.charAt(0).toUpperCase() + detectionResult.detectionMethod.slice(1)} | 
                Date range: {new Date(detectionResult.from).toLocaleDateString()} - {new Date(detectionResult.to).toLocaleDateString()}
              </p>
              <div className="mt-2 text-xs text-gray-600">
                <p><strong>Ignition:</strong> Uses vehicle ignition on/off signals for precise trip detection</p>
                <p><strong>Location:</strong> Uses GPS coordinates and movement patterns when ignition data is unavailable</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {detectedTrips.length > 0 && (
        <>
          {/* Odometer Reading Section */}
          {odometerData && (odometerData.start !== null || odometerData.end !== null) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Odometer Reading
                </CardTitle>
                <CardDescription>
                  Vehicle odometer readings for the selected date range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {odometerData.start !== null ? 
                        `${useKilometers ? odometerData.start.toLocaleString() : (odometerData.start * 0.621371).toFixed(1)} ${useKilometers ? 'km' : 'mi'}` : 
                        'N/A'
                      }
                    </div>
                    <div className="text-sm text-blue-500 mt-1">Starting Reading</div>
                    <div className="text-xs text-gray-500">
                      {new Date(dateRange.from).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {odometerData.end !== null ? 
                        `${useKilometers ? odometerData.end.toLocaleString() : (odometerData.end * 0.621371).toFixed(1)} ${useKilometers ? 'km' : 'mi'}` : 
                        'N/A'
                      }
                    </div>
                    <div className="text-sm text-green-500 mt-1">Ending Reading</div>
                    <div className="text-xs text-gray-500">
                      {new Date(dateRange.to).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              {odometerData.start !== null && odometerData.end !== null && (
                <div className="mt-4 space-y-2">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-700">
                      Total Distance: {useKilometers ? 
                        `${(odometerData.end - odometerData.start).toLocaleString()} km` : 
                        `${((odometerData.end - odometerData.start) * 0.621371).toFixed(1)} mi`
                      }
                    </div>
                    <div className="text-sm text-green-600">
                      Vehicle Odometer
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-500">
                      GPS Distance: {useKilometers ? 
                        `${(detectedTrips.reduce((sum, trip) => sum + trip.distance, 0) * 1.60934).toFixed(2)} km` : 
                        `${detectedTrips.reduce((sum, trip) => sum + trip.distance, 0).toFixed(2)} mi`
                      }
                    </div>
                    <div className="text-sm text-gray-400">
                      (Sum of GPS-calculated trips)
                    </div>
                  </div>
                  <div className="text-center text-xs text-gray-500">
                    <p>Vehicle odometer readings are more accurate than GPS calculations</p>
                    <p>GPS accuracy can vary due to HDOP and coordinate density</p>
                  </div>
                </div>
              )}
              </CardContent>
            </Card>
          )}

          {/* Detected Trips Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Detected Trips ({detectedTrips.length})
                {excludedTrips.size > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {excludedTrips.size} excluded
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Trips automatically detected using ignition signals and GPS data
              </CardDescription>
            </CardHeader>
          <CardContent>
                <div className="space-y-3">
                  {detectedTrips.map((trip) => (
                    <div 
                      key={trip.id} 
                      className={`p-4 border rounded-lg ${
                        excludedTrips.has(trip.id) 
                          ? 'bg-red-50 border-red-200 opacity-75' 
                          : 'bg-white'
                      }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex flex-col items-start gap-2">
                            <Badge 
                              variant={trip.classification === 'business' ? 'default' : trip.classification === 'personal' ? 'secondary' : 'outline'}
                            >
                              {trip.classification.charAt(0).toUpperCase() + trip.classification.slice(1)}
                            </Badge>
                            <div className="text-sm text-muted-foreground">
                              <div>{formatDate(trip.startTime)}</div>
                              <div className="text-xs">
                                {formatTimeOnly(trip.startTime)} - {formatTimeOnly(trip.endTime)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatDistance(trip.distance)}</div>
                            <div className="text-xs text-muted-foreground flex justify-end gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(trip.startTime, trip.endTime)}
                            </div>
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

                      {/* Exclude from Export Button */}
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant={excludedTrips.has(trip.id) ? "destructive" : "outline"}
                          onClick={() => toggleTripExclusion(trip.id)}
                          className="text-xs"
                        >
                          {excludedTrips.has(trip.id) ? (
                            <>
                              <X className="mr-1 h-3 w-3" />
                              Excluded from Export
                            </>
                          ) : (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Included in Export
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Category Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <div className="mt-2 text-xs text-gray-600 w-full">
                          <p><strong>Category</strong></p>
                        </div>
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

                      {/* Trip Notes */}
                      <div className="mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <label className="text-sm font-medium">Notes</label>
                          {editingNotes !== trip.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditNotes(trip.id)}
                              className="text-xs h-6 px-2"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                        
                        {editingNotes === trip.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={tripNotes[trip.id] || trip.userNotes || ''}
                              onChange={(e) => setTripNotes(prev => ({ ...prev, [trip.id]: e.target.value }))}
                              placeholder="Add notes about this trip..."
                              className="w-full p-4 text-sm border rounded-sm resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveNotes(trip.id)}
                                className="text-xs h-6 px-2"
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelNotes(trip.id)}
                                className="text-xs h-6 px-2"
                              >
                                <XIcon className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground min-h-[2rem] p-4 border rounded-sm bg-muted/50">
                            {trip.userNotes || 'No notes added'}
                          </div>
                        )}
                      </div>

                      {/* Trip Map */}
                      <TripMap
                        trip={{
                          ...trip,
                          coordinates: trip.notes ? (() => {
                            try {
                              const parsed = JSON.parse(trip.notes);
                              return parsed.coordinates || [];
                            } catch {
                              return [];
                            }
                          })() : []
                        }}
                        isExpanded={expandedMaps.has(trip.id)}
                        onToggle={() => toggleMap(trip.id)}
                      />
                    </div>
                  ))}
                </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Sticky Export Button */}
      {showStickyExport && detectedTrips.length > 0 && (
        <div className="fixed bottom-3 right-3 z-50">
          <Button
            onClick={handleExportCSV}
            className="flex items-center gap-2 shadow-lg"
            size="lg"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      )}
    </div>
  );
}
