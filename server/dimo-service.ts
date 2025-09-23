import { DIMO } from "@dimo-network/data-sdk";
import { detectTrips } from "./utils";
import { type InsertTrip } from "@shared/schema";

// DIMO data service using official SDK
export class DimoService {
  private dimo: DIMO;

  constructor() {
    // Initialize DIMO SDK for Production environment
    this.dimo = new DIMO("Production");
  }

  // Get Developer JWT for authentication
  async getDeveloperJwt() {
    try {
      return await this.dimo.auth.getDeveloperJwt({
        client_id: process.env.DIMO_CLIENT_ID!,
        domain: process.env.DIMO_REDIRECT_URI || "http://localhost:5000",
        private_key: process.env.DIMO_API_KEY!,
      });
    } catch (error) {
      console.error("Error getting Developer JWT:", error);
      throw error;
    }
  }

  // Get Vehicle JWT for specific vehicle access (using new preferred method)
  async getVehicleJwt(developerJwt: any, tokenId: number) {
    try {
      return await this.dimo.tokenexchange.getVehicleJwt({
        ...developerJwt,
        tokenId: tokenId,
      });
    } catch (error) {
      console.error("Error getting Vehicle JWT:", error);
      throw error;
    }
  }

  async getUserVehicles(userWalletAddress: string, clientId: string) {
    try {
      // Get Developer JWT first
      const developerJwt = await this.getDeveloperJwt();

      // Query vehicles that the user owns and are privileged to the client ID
      const query = `{
        vehicles(
          filterBy: { privileged: "${clientId}", owner: "${userWalletAddress}" }
          first: 100
        ) {
          nodes {
            owner
            tokenId
            definition {
              make
              model
              year
            }
          }
        }
      }`;

      const response = await this.dimo.identity.query({
        query: query,
      });

      return response?.data?.vehicles || { nodes: [] };
    } catch (error) {
      console.error("Error fetching DIMO vehicles:", error);
      throw error;
    }
  }

  async getVehicleLocation(vehicleId: string) {
    try {
      const tokenId = parseInt(vehicleId);

      // Get Developer JWT and Vehicle JWT
      const developerJwt = await this.getDeveloperJwt();
      const vehicleJwt = await this.getVehicleJwt(developerJwt, tokenId);

      // Query telemetry API for latest location data
      const query = `
        {
          signalsLatest(tokenId: ${tokenId}) {
            currentLocationLatitude {
              timestamp
              value
            }
            currentLocationLongitude {
              timestamp
              value
            }
            dimoAftermarketHDOP {
              timestamp
              value
            }
            lastSeen
          }
        }
      `;

      const locationData = await this.dimo.telemetry.query({
        ...vehicleJwt,
        query: query,
      });


      const signalsData = locationData?.data?.signalsLatest;
      const latitude = signalsData?.currentLocationLatitude?.value;
      const longitude = signalsData?.currentLocationLongitude?.value;
      const hdop = signalsData?.dimoAftermarketHDOP?.value;

      if (!latitude || !longitude) {
        throw new Error("No location data available for this vehicle");
      }

      // Convert to GPS format for your app
      return {
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
        hdop: hdop ? parseFloat(hdop) : 1.0,
        timestamp: signalsData?.lastSeen || new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching DIMO vehicle location:", error);
      throw error;
    }
  }

  async getVehicleWeeklyHistory(vehicleId: string) {
    try {
      const tokenId = parseInt(vehicleId);

      // Get Developer JWT and Vehicle JWT
      const developerJwt = await this.getDeveloperJwt();
      const vehicleJwt = await this.getVehicleJwt(developerJwt, tokenId);
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();

      // Query telemetry API for latest location data
      const query = `
        {
          signals(
            tokenId: ${tokenId},
            from: "${from}",
            to: "${to}",
            interval: "6h"
          ) {
            currentLocationLatitude (agg: LAST)
            currentLocationLongitude (agg: LAST)
          }
        }
      `;


      const historyData = await this.dimo.telemetry.query({
        ...vehicleJwt,
        query: query,
      });


      const signalsData = historyData?.data?.signals;

      if (!Array.isArray(signalsData) || signalsData.length === 0) {
        throw new Error("No location data available for this vehicle");
      }

      // Average lat/lng
      const { totalLat, totalLng } = signalsData.reduce(
        (acc, point) => {
          acc.totalLat += point.currentLocationLatitude;
          acc.totalLng += point.currentLocationLongitude;
          return acc;
        },
        { totalLat: 0, totalLng: 0 },
      );

      const avgLat = totalLat / signalsData.length;
      const avgLng = totalLng / signalsData.length;

      // Convert to GPS format for your app
      return {
        lat: avgLat,
        lng: avgLng,
        hdop: 1000.0,
        datapoints: signalsData.length,
      };
    } catch (error) {
      console.error("Error fetching DIMO vehicle location:", error);
      throw error;
    }
  }

  /**
   * Fetch ignition and location data for accurate trip detection
   * @param vehicleId DIMO vehicle token ID
   * @param from Start date in ISO format
   * @param to End date in ISO format
   * @param interval Data interval (default: "5m" for 5-minute intervals)
   * @returns Array of ignition and location data points with timestamps
   */
  async getVehicleIgnitionAndLocationData(vehicleId: string, from: string, to: string, interval: string = "5m") {
    try {
      const tokenId = parseInt(vehicleId);

      // Get Developer JWT and Vehicle JWT
      const developerJwt = await this.getDeveloperJwt();
      const vehicleJwt = await this.getVehicleJwt(developerJwt, tokenId);

      // Query telemetry API for ignition and location data
      const query = `
        {
          signals(
            tokenId: ${tokenId},
            from: "${from}",
            to: "${to}",
            interval: "${interval}"
          ) {
            timestamp
            isIgnitionOn (agg: LAST)
            currentLocationLatitude (agg: LAST)
            currentLocationLongitude (agg: LAST)
            speed (agg: MAX)
            powertrainTransmissionTravelledDistance (agg: LAST)
            dimoAftermarketHDOP (agg: LAST)
          }
        }
      `;


      const historyData = await this.dimo.telemetry.query({
        ...vehicleJwt,
        query: query,
      });


      const signalsData = historyData?.data?.signals;
      if (!Array.isArray(signalsData) || signalsData.length === 0) {
        return [];
      }

      // Convert to standardized format with explicit parsing
      const processedData = signalsData
        .filter(point => point.timestamp) // Only require timestamp, location is optional
        .map(point => ({
          timestamp: point.timestamp,
          isIgnitionOn: point.isIgnitionOn !== null ? parseFloat(point.isIgnitionOn) === 1 : null,
          lat: point.currentLocationLatitude ? parseFloat(point.currentLocationLatitude) : null,
          lng: point.currentLocationLongitude ? parseFloat(point.currentLocationLongitude) : null,
          speed: point.speed ? parseFloat(point.speed) : 0,
          odometer: point.powertrainTransmissionTravelledDistance ? parseFloat(point.powertrainTransmissionTravelledDistance) : null,
          hdop: point.dimoAftermarketHDOP ? parseFloat(point.dimoAftermarketHDOP) : 1.0,
        }));

      return processedData;

    } catch (error) {
      console.error("Error fetching DIMO vehicle ignition and location data:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      throw error;
    }
  }

  /**
   * Fetch detailed historical location data for trip detection (legacy method)
   * @param vehicleId DIMO vehicle token ID
   * @param from Start date in ISO format
   * @param to End date in ISO format
   * @param interval Data interval (default: "30m" for 30-minute intervals)
   * @returns Array of location data points with timestamps
   */
  async getVehicleDetailedHistory(vehicleId: string, from: string, to: string, interval: string = "30m") {
    try {
      const tokenId = parseInt(vehicleId);

      // Get Developer JWT and Vehicle JWT
      const developerJwt = await this.getDeveloperJwt();
      const vehicleJwt = await this.getVehicleJwt(developerJwt, tokenId);

      // Query telemetry API for detailed location data
      const query = `
        {
          signals(
            tokenId: ${tokenId},
            from: "${from}",
            to: "${to}",
            interval: "${interval}"
          ) {
            timestamp
            currentLocationLatitude (agg: LAST)
            currentLocationLongitude (agg: LAST)
            dimoAftermarketHDOP (agg: LAST)
          }
        }
      `;

      console.log(`Fetching detailed history for vehicle: ${vehicleId} from ${from} to ${to}`);

      const historyData = await this.dimo.telemetry.query({
        ...vehicleJwt,
        query: query,
      });

      const signalsData = historyData?.data?.signals;
      console.log(`DIMO Detailed History API returned ${signalsData?.length || 0} data points`);

      if (!Array.isArray(signalsData) || signalsData.length === 0) {
        return [];
      }

      // Convert to standardized format with explicit parsing
      return signalsData
        .filter(point => point.currentLocationLatitude && point.currentLocationLongitude && point.timestamp)
        .map(point => ({
          lat: parseFloat(point.currentLocationLatitude),
          lng: parseFloat(point.currentLocationLongitude),
          hdop: point.dimoAftermarketHDOP ? parseFloat(point.dimoAftermarketHDOP) : 1.0,
          timestamp: point.timestamp
        }));

    } catch (error) {
      console.error("Error fetching DIMO vehicle detailed history:", error);
      throw error;
    }
  }

  /**
   * Detect trips using ignition signals for maximum accuracy
   * @param vehicleId DIMO vehicle token ID
   * @param userId User ID for trip ownership
   * @param from Start date in ISO format
   * @param to End date in ISO format
   * @returns Array of detected trips ready for storage
   */
  async detectVehicleTripsFromIgnition(vehicleId: string, userId: string, from: string, to: string): Promise<InsertTrip[]> {
    try {
      // Fetch ignition and location data with higher frequency for accuracy
      const ignitionData = await this.getVehicleIgnitionAndLocationData(vehicleId, from, to, "1s");

      if (ignitionData.length < 2) {
        return [];
      }

      // Check if we have any ignition data (non-null isIgnitionOn values)
      const hasIgnitionData = ignitionData.some(point => point.isIgnitionOn !== null);
      
      if (!hasIgnitionData) {
        return this.detectVehicleTripsFromLocation(vehicleId, userId, from, to, ignitionData);
      }

      // Detect trips using ignition signals
      const detectedTrips = this.detectTripsFromIgnition(ignitionData);

      // Convert to InsertTrip format
      const trips: InsertTrip[] = detectedTrips.map(trip => ({
        userId,
        vehicleId,
        startTime: trip.startTime,
        endTime: trip.endTime,
        startLatitude: trip.startLat,
        startLongitude: trip.startLng,
        endLatitude: trip.endLat,
        endLongitude: trip.endLng,
        distance: Math.round(trip.distance * 100) / 100, // Round to 2 decimal places
        classification: "personal", // Default classification
        notes: JSON.stringify({
          description: `Auto-detected trip via ignition (${trip.coordinates.length} GPS points)`,
          coordinates: trip.coordinates
        })
      }));

      return trips;

    } catch (error) {
      console.error("Error detecting vehicle trips from ignition:", error);
      console.error("Error details:", error instanceof Error ? error.message : "Unknown error");
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      throw error;
    }
  }

  /**
   * Improved location-based trip detection that considers time gaps between data points
   */
  private detectTripsWithTimeGaps(
    coordinates: Array<{lat: number, lng: number, timestamp: string}>,
    minTripDistance: number = 0.5,
    maxStopDuration: number = 15,
    maxTimeGapMinutes: number = 120
  ): Array<{
    startTime: string;
    endTime: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    distance: number;
    coordinates: Array<{lat: number, lng: number, timestamp: string}>;
  }> {
    if (coordinates.length < 2) {
      return [];
    }
    
    const trips = [];
    let currentTripStart: {lat: number, lng: number, timestamp: string} | null = null;
    let currentTripCoords: Array<{lat: number, lng: number, timestamp: string}> = [];
    let lastMovement = coordinates[0];
    
    for (let i = 1; i < coordinates.length; i++) {
      const current = coordinates[i];
      const distanceFromLast = this.calculateDistance(
        lastMovement.lat, lastMovement.lng,
        current.lat, current.lng
      );
      
      // Check time gap between data points
      const timeGap = new Date(current.timestamp).getTime() - new Date(lastMovement.timestamp).getTime();
      const timeGapMinutes = timeGap / (1000 * 60);
      
      // If there's a large time gap, end any current trip
      if (timeGapMinutes > maxTimeGapMinutes) {
        if (currentTripStart && currentTripCoords.length > 1) {
          const tripDistance = this.calculateTotalDistance(currentTripCoords);
          if (tripDistance >= minTripDistance) {
            const actualEndTime = currentTripCoords[currentTripCoords.length - 1].timestamp;
            trips.push({
              startTime: currentTripStart.timestamp,
              endTime: actualEndTime,
              startLat: currentTripStart.lat,
              startLng: currentTripStart.lng,
              endLat: lastMovement.lat,
              endLng: lastMovement.lng,
              distance: tripDistance,
              coordinates: [...currentTripCoords]
            });
          }
        }
        // Reset for next trip
        currentTripStart = null;
        currentTripCoords = [];
        lastMovement = current;
        continue;
      }
      
      // Check if vehicle is moving (distance > 0.01 miles = ~50 feet)
      const isMoving = distanceFromLast > 0.01;
      
      if (isMoving) {
        // Vehicle is moving
        if (!currentTripStart) {
          // Start a new trip
          currentTripStart = lastMovement;
          currentTripCoords = [lastMovement];
        }
        currentTripCoords.push(current);
        lastMovement = current;
      } else {
        // Vehicle appears to be stopped
        if (currentTripStart && currentTripCoords.length > 1) {
          // Check if we've been stopped long enough to end the trip
          const timeSinceLastMovement = new Date(current.timestamp).getTime() - 
                                       new Date(lastMovement.timestamp).getTime();
          const minutesSinceLastMovement = timeSinceLastMovement / (1000 * 60);
          
          if (minutesSinceLastMovement >= maxStopDuration) {
            // End the current trip
            const tripDistance = this.calculateTotalDistance(currentTripCoords);
            
            if (tripDistance >= minTripDistance) {
              const actualEndTime = currentTripCoords[currentTripCoords.length - 1].timestamp;
              trips.push({
                startTime: currentTripStart.timestamp,
                endTime: actualEndTime,
                startLat: currentTripStart.lat,
                startLng: currentTripStart.lng,
                endLat: lastMovement.lat,
                endLng: lastMovement.lng,
                distance: tripDistance,
                coordinates: [...currentTripCoords]
              });
            }
            
            // Reset for next trip
            currentTripStart = null;
            currentTripCoords = [];
          }
        }
      }
    }
    
    // Handle case where trip is still ongoing at the end of data
    if (currentTripStart && currentTripCoords.length > 1) {
      const tripDistance = this.calculateTotalDistance(currentTripCoords);
      if (tripDistance >= minTripDistance) {
        const lastCoord = currentTripCoords[currentTripCoords.length - 1];
        trips.push({
          startTime: currentTripStart.timestamp,
          endTime: lastCoord.timestamp,
          startLat: currentTripStart.lat,
          startLng: currentTripStart.lng,
          endLat: lastCoord.lat,
          endLng: lastCoord.lng,
          distance: tripDistance,
          coordinates: [...currentTripCoords]
        });
      }
    }
    
    return trips;
  }

  /**
   * Fallback trip detection using location data when ignition data is not available
   */
  private async detectVehicleTripsFromLocation(vehicleId: string, userId: string, from: string, to: string, locationData: any[]): Promise<InsertTrip[]> {
    try {
      // Filter out points without location data
      const validLocationData = locationData.filter(point => 
        point.lat !== null && point.lng !== null && point.timestamp
      );

      if (validLocationData.length < 2) {
        return [];
      }

      // Use improved location-based trip detection that considers time gaps
      const detectedTrips = this.detectTripsWithTimeGaps(validLocationData, 0.5, 15, 120); // 0.5 mile minimum, 15 minute stops, 2 hour max gap

      // Convert to InsertTrip format
      const trips: InsertTrip[] = detectedTrips.map(trip => ({
        userId,
        vehicleId,
        startTime: trip.startTime,
        endTime: trip.endTime,
        startLatitude: trip.startLat,
        startLongitude: trip.startLng,
        endLatitude: trip.endLat,
        endLongitude: trip.endLng,
        distance: Math.round(trip.distance * 100) / 100, // Round to 2 decimal places
        classification: "personal", // Default classification
        notes: JSON.stringify({
          description: `Auto-detected trip via location (${trip.coordinates.length} GPS points)`,
          coordinates: trip.coordinates
        })
      }));

      return trips;

    } catch (error) {
      console.error("Error detecting vehicle trips from location:", error);
      throw error;
    }
  }

  /**
   * Detect trips from ignition and location data
   * @param data Array of ignition and location data points
   * @returns Array of detected trips
   */
  private detectTripsFromIgnition(data: Array<{
    timestamp: string;
    isIgnitionOn: boolean | null;
    lat: number | null;
    lng: number | null;
    speed: number;
    odometer: number | null;
  }>): Array<{
    startTime: string;
    endTime: string;
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    distance: number;
    coordinates: Array<{lat: number, lng: number, timestamp: string}>;
  }> {

    const trips = [];
    let currentTripStart: {lat: number, lng: number, timestamp: string} | null = null;
    let currentTripCoords: Array<{lat: number, lng: number, timestamp: string}> = [];
    let tripStartTime: string | null = null;
    let lastOdometer: number | null = null;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const isIgnitionOn = point.isIgnitionOn === true; // Only true when explicitly true
      const hasLocation = point.lat !== null && point.lng !== null;

        if (isIgnitionOn && !currentTripStart) {
          // Trip starts - ignition turned on
          tripStartTime = point.timestamp;
          lastOdometer = point.odometer;
          
          if (hasLocation) {
            currentTripStart = {
              lat: point.lat!,
              lng: point.lng!,
              timestamp: point.timestamp
            };
            currentTripCoords = [currentTripStart];
          }
        } else if (point.isIgnitionOn === false && currentTripStart && tripStartTime) {
          // Trip ends - ignition turned off
          const tripEndTime = point.timestamp;
          let distance = 0;
          
          // Calculate distance using GPS coordinates if available
          if (currentTripCoords.length >= 2) {
            distance = this.calculateTotalDistance(currentTripCoords);
          } else if (point.odometer !== null && lastOdometer !== null) {
            // Fallback to odometer reading if GPS data is insufficient
            distance = (point.odometer - lastOdometer) * 0.621371; // Convert km to miles
          }

          // Only include trips with meaningful distance (at least 0.1 miles)
          if (distance >= 0.1) {
            const endCoord = currentTripCoords.length > 0 ? 
              currentTripCoords[currentTripCoords.length - 1] : 
              currentTripStart;

            trips.push({
              startTime: tripStartTime,
              endTime: tripEndTime,
              startLat: currentTripStart.lat,
              startLng: currentTripStart.lng,
              endLat: endCoord.lat,
              endLng: endCoord.lng,
              distance: distance,
              coordinates: [...currentTripCoords]
            });
          }

          // Reset for next trip
          currentTripStart = null;
          currentTripCoords = [];
          tripStartTime = null;
          lastOdometer = null;
        } else if (point.isIgnitionOn === true && currentTripStart && hasLocation) {
          // Trip in progress - add location point
          currentTripCoords.push({
            lat: point.lat!,
            lng: point.lng!,
            timestamp: point.timestamp
          });
        }
    }

    return trips;
  }

  /**
   * Calculate total distance for an array of GPS coordinates
   * @param coordinates Array of {lat, lng} coordinates
   * @returns Total distance in miles
   */
  private calculateTotalDistance(coordinates: Array<{lat: number, lng: number}>): number {
    if (coordinates.length < 2) {
      return 0;
    }
    
    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      totalDistance += this.calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }
    
    return totalDistance;
  }

  /**
   * Calculate the distance between two GPS coordinates using the Haversine formula
   * @param lat1 Latitude of first point in degrees
   * @param lng1 Longitude of first point in degrees  
   * @param lat2 Latitude of second point in degrees
   * @param lng2 Longitude of second point in degrees
   * @returns Distance in miles
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    
    // Convert latitude and longitude from degrees to radians
    const lat1Rad = lat1 * (Math.PI / 180);
    const lng1Rad = lng1 * (Math.PI / 180);
    const lat2Rad = lat2 * (Math.PI / 180);
    const lng2Rad = lng2 * (Math.PI / 180);
    
    // Differences
    const dLat = lat2Rad - lat1Rad;
    const dLng = lng2Rad - lng1Rad;
    
    // Haversine formula
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
             Math.cos(lat1Rad) * Math.cos(lat2Rad) *
             Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    // Distance in miles
    return R * c;
  }

  /**
   * Detect and process trips from vehicle historical data (legacy method)
   * @param vehicleId DIMO vehicle token ID
   * @param userId User ID for trip ownership
   * @param from Start date in ISO format
   * @param to End date in ISO format
   * @returns Array of detected trips ready for storage
   */
  async detectVehicleTrips(vehicleId: string, userId: string, from: string, to: string): Promise<InsertTrip[]> {
    try {
      // Try ignition-based detection first, fallback to location-based
      try {
        return await this.detectVehicleTripsFromIgnition(vehicleId, userId, from, to);
      } catch (ignitionError) {
        console.log("Ignition-based trip detection failed, falling back to location-based:", ignitionError);
        
      // Fetch detailed historical data
      const locationHistory = await this.getVehicleDetailedHistory(vehicleId, from, to, "15m");

      if (locationHistory.length < 2) {
        console.log(`Insufficient location data for trip detection: ${locationHistory.length} points`);
        return [];
      }

      console.log(`Processing ${locationHistory.length} location points for trip detection`);

      // Detect trips using the utility function
      const detectedTrips = detectTrips(locationHistory, 0.5, 15); // 0.5 mile minimum, 15 minute stops

      console.log(`Detected ${detectedTrips.length} trips`);

      // Convert to InsertTrip format
      const trips: InsertTrip[] = detectedTrips.map(trip => ({
        userId,
        vehicleId,
        startTime: trip.startTime,
        endTime: trip.endTime,
        startLatitude: trip.startLat,
        startLongitude: trip.startLng,
        endLatitude: trip.endLat,
        endLongitude: trip.endLng,
        distance: Math.round(trip.distance * 100) / 100, // Round to 2 decimal places
        classification: "personal", // Default classification
        notes: JSON.stringify({
          description: `Auto-detected trip (${trip.coordinates.length} GPS points)`,
          coordinates: trip.coordinates
        })
      }));

      return trips;
      }

    } catch (error) {
      console.error("Error detecting vehicle trips:", error);
      throw error;
    }
  }

  /**
   * Import trips for a vehicle for a specific date range
   * @param vehicleId DIMO vehicle token ID
   * @param userId User ID for trip ownership
   * @param days Number of days back to import (default: 7)
   * @returns Array of detected trips
   */
  async importVehicleTrips(vehicleId: string, userId: string, days: number = 7): Promise<InsertTrip[]> {
    const to = new Date().toISOString();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    return this.detectVehicleTrips(vehicleId, userId, from, to);
  }

  /**
   * Get basic vehicle information
   * @param vehicleId Vehicle token ID
   * @returns Vehicle information including make, model, year
   */
  async getVehicleInfo(vehicleId: string): Promise<{
    tokenId: number;
    definition: {
      year: number;
      make: string;
      model: string;
    };
  } | null> {
    try {
      const jwt = await this.getDeveloperJwt();
      
      // Use the same vehicles query as getUserVehicles but filter by tokenId
      const query = `
        query GetVehicleInfo($tokenId: Int!) {
          vehicles(
            filterBy: { tokenId: $tokenId }
            first: 1
          ) {
            nodes {
              tokenId
              definition {
                year
                make
                model
              }
            }
          }
        }
      `;
      
      const response = await this.dimo.identity.query({
        query: query,
        variables: { tokenId: parseInt(vehicleId) }
      });
      
      if (response.data?.vehicles?.nodes?.length > 0) {
        return response.data.vehicles.nodes[0];
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching vehicle info:", error);
      return null;
    }
  }
}

export const dimoService = new DimoService();
