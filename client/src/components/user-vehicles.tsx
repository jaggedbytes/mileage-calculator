import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCachedDimoAuth } from "@/hooks/use-cached-auth";
import { useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Car,
  Calendar,
  Shield,
  AlertTriangle,
  MapPin,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  tokenId: number;
  owner: string;
  definition: {
    make: string;
    model: string;
    year: number;
  };
  sacds?: {
    nodes: Array<{
      permissions: string;
      grantee: string;
      createdAt: string;
      expiresAt: string;
    }>;
  };
}

interface SharedVehiclesResponse {
  walletAddress: string;
  vehicles: Vehicle[];
  count: number;
}

interface UserVehiclesProps {
  onVehicleSelect?: (vehicleId: string) => void;
  onLocationUpdate?: (data: { lat: number; lng: number; hdop: number; timestamp: string }) => void;
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

const fetchCurrentVehicleLocation = async (tokenId: number) => {
  // Get cached token from localStorage
  const cachedToken = getCachedToken();

  if (!cachedToken) {
    throw new Error("No cached DIMO token found. Please authenticate first.");
  }

  const response = await fetch(`/api/dimo/vehicles/${tokenId}/location`, {
    headers: {
      Authorization: `Bearer ${cachedToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch vehicle location: ${response.statusText}`);
  }

  return response.json();
};

const fetchCurrentVehicleHistory = async (tokenId: number) => {
  // Get cached token from localStorage
  const cachedToken = getCachedToken();

  if (!cachedToken) {
    throw new Error("No cached DIMO token found. Please authenticate first.");
  }

  const response = await fetch(`/api/dimo/vehicles/${tokenId}/history`, {
    headers: {
      Authorization: `Bearer ${cachedToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch vehicle location: ${response.statusText}`);
  }

  return response.json();
};

export default function UserVehicles({ onVehicleSelect, onLocationUpdate }: UserVehiclesProps = {}) {
  const { isAuthenticated, walletAddress, email, isFromCache } =
    useCachedDimoAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/dimo/vehicles", walletAddress],
    queryFn: () => {
      console.log(
        "Frontend: Making API call to fetch vehicles for wallet:",
        walletAddress,
      );
      return fetchUserVehicles(walletAddress!);
    },
    enabled: isAuthenticated && !!walletAddress,
  });

  // Log query state changes
  useEffect(() => {
    console.log("UserVehicles query state update:", {
      isAuthenticated,
      walletAddress,
      isLoading,
      error: error?.message,
      data,
      queryEnabled: isAuthenticated && !!walletAddress,
    });
  }, [isAuthenticated, walletAddress, isLoading, error, data]);

  // Also log the final authentication status for the user
  console.log("UserVehicles render - Final auth state:", {
    isAuthenticated,
    walletAddress,
    isFromCache,
    vehicleCount: data?.vehicles?.length || 0,
  });

  const locationMutation = useMutation({
    mutationFn: fetchCurrentVehicleLocation,
    onSuccess: (locationData) => {
      if (locationData.lat && locationData.lng) {
        toast({
          title: "Location Updated",
          description: `Vehicle location: ${locationData.lat.toFixed(4)}, ${locationData.lng.toFixed(4)} (HDOP: ${locationData.hdop})`,
        });
        // Invalidate GPS data to trigger a refresh of the map
        queryClient.invalidateQueries({ queryKey: ["/api/gps"] });

        // Notify parent component to focus on the new location and update GPS data
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("focusMapLocation", {
              detail: {
                lat: locationData.lat,
                lng: locationData.lng,
                hdop: locationData.hdop || 1.0,
              },
            }),
          );

          // Also dispatch event to clear user pins and restore GPS signals
          window.dispatchEvent(new CustomEvent("clearUserPin"));
        }

        // Call the onLocationUpdate callback if provided
        if (onLocationUpdate) {
          onLocationUpdate({
            lat: locationData.lat,
            lng: locationData.lng,
            hdop: locationData.hdop || 1.0,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        toast({
          title: "No Location Data",
          description:
            "Vehicle location data is not available or GPS signal is poor",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Location Fetch Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch vehicle location",
        variant: "destructive",
      });
    },
  });

  const historyMutation = useMutation({
    mutationFn: fetchCurrentVehicleHistory,
    onSuccess: (historyData) => {
      console.log("Vehicle history data received:", historyData);
      toast({
        title: "Weekly History Loaded",
        description: `Found ${historyData?.datapoints} historical data points`,
      });

      // Invalidate GPS data to trigger a refresh of the map
      queryClient.invalidateQueries({ queryKey: ["/api/gps"] });

      // Notify parent component to focus on the new location and update GPS data
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("focusMapLocation", {
            detail: {
              lat: historyData.lat,
              lng: historyData.lng,
              hdop: historyData.hdop || 1.0,
            },
          }),
        );

        // Also dispatch event to clear user pins and restore GPS signals
        window.dispatchEvent(new CustomEvent("clearUserPin"));
      }
    },
    onError: (error) => {
      toast({
        title: "History Fetch Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to fetch vehicle history",
        variant: "destructive",
      });
    },
  });

  if (!isAuthenticated || !walletAddress) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5" />
            My Shared Vehicles
          </CardTitle>
          <CardDescription>Sign in with DIMO to view vehicles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Authenticate to view your vehicles
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5" />
            My Shared Vehicles
          </CardTitle>
          <CardDescription>
            Vehicles shared with this app from your DIMO account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Loading your shared vehicles...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Error Loading Vehicles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-600">
            {error instanceof Error
              ? error.message
              : "Failed to load shared vehicles"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const vehicles = data?.vehicles || [];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Car className="h-5 w-5" />
          My Shared Vehicles
        </CardTitle>
        <CardDescription>
          {vehicles.length > 0
            ? `${vehicles.length} vehicle${vehicles.length > 1 ? "s" : ""} shared`
            : "No vehicles currently shared"}
          {isFromCache && (
            <span className="text-orange-500 text-xs ml-2">
              (using cached auth)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {vehicles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Car className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">No vehicles shared yet</p>
            <p className="text-xs mt-1">
              Use the "Share Vehicles" button above to grant this app access to
              your vehicle data
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.tokenId}
                className="border rounded-lg p-3 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                data-testid={`vehicle-card-${vehicle.tokenId}`}
                onClick={() => onVehicleSelect?.(vehicle.tokenId.toString())}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3
                      className="font-semibold text-lg"
                      data-testid={`vehicle-name-${vehicle.tokenId}`}
                    >
                      {vehicle.definition.year} {vehicle.definition.make}{" "}
                      {vehicle.definition.model}
                    </h3>
                    <p
                      className="text-sm text-muted-foreground"
                      data-testid={`vehicle-token-${vehicle.tokenId}`}
                    >
                      Token ID: {vehicle.tokenId}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    data-testid={`vehicle-status-${vehicle.tokenId}`}
                  >
                    Shared
                  </Badge>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => locationMutation.mutate(vehicle.tokenId)}
                      disabled={locationMutation.isPending}
                      data-testid={`current-button-${vehicle.tokenId}`}
                      className="text-xs"
                    >
                      {locationMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <MapPin className="mr-1 h-3 w-3" />
                          Current
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => historyMutation.mutate(vehicle.tokenId)}
                      disabled={historyMutation.isPending}
                      data-testid={`lastweek-button-${vehicle.tokenId}`}
                      className="text-xs"
                    >
                      {historyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <Calendar className="mr-1 h-3 w-3" />
                          Last Week Approximated
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {vehicle.sacds?.nodes && vehicle.sacds.nodes.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      Permissions
                    </h4>
                    {vehicle.sacds?.nodes?.map((sacd, index) => (
                      <div
                        key={index}
                        className="bg-muted/50 rounded p-2 text-sm"
                      >
                        <div className="flex flex-wrap gap-1 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {sacd.permissions}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created:{" "}
                            {new Date(sacd.createdAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expires:{" "}
                            {new Date(sacd.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
