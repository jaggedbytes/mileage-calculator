// Utility functions for mileage calculation and trip processing

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula
 * @param lat1 Latitude of first point in degrees
 * @param lng1 Longitude of first point in degrees  
 * @param lat2 Latitude of second point in degrees
 * @param lng2 Longitude of second point in degrees
 * @returns Distance in miles
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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
 * Calculate total distance for an array of GPS coordinates
 * @param coordinates Array of {lat, lng} coordinates
 * @returns Total distance in miles
 */
export function calculateTotalDistance(coordinates: Array<{lat: number, lng: number}>): number {
  if (coordinates.length < 2) {
    return 0;
  }
  
  let totalDistance = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];
    totalDistance += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
  }
  
  return totalDistance;
}

/**
 * Detect trips from GPS coordinate data based on movement patterns
 * @param coordinates Array of {lat, lng, timestamp} coordinates
 * @param minTripDistance Minimum distance in miles to consider a trip (default: 0.5)
 * @param maxStopDuration Maximum time in minutes to consider a stop (default: 10)
 * @returns Array of detected trips with start/end coordinates and times
 */
export function detectTrips(
  coordinates: Array<{lat: number, lng: number, timestamp: string}>,
  minTripDistance: number = 0.5,
  maxStopDuration: number = 10
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
    const distanceFromLast = calculateDistance(
      lastMovement.lat, lastMovement.lng,
      current.lat, current.lng
    );
    
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
          const tripDistance = calculateTotalDistance(currentTripCoords);
          
          if (tripDistance >= minTripDistance) {
            // Calculate actual trip duration based on movement time
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
    const tripDistance = calculateTotalDistance(currentTripCoords);
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
 * Generate monthly mileage summary from trips
 * @param trips Array of trips
 * @param month Month in YYYY-MM format
 * @returns Mileage summary object
 */
export function generateMileageSummary(
  trips: Array<{
    startTime: string;
    distance: number;
    classification: string;
  }>,
  month: string
) {
  // Parse month as YYYY-MM and create proper date range
  const [year, monthNum] = month.split('-').map(Number);
  const monthStart = new Date(year, monthNum - 1, 1); // monthNum - 1 because Date months are 0-indexed
  const monthEnd = new Date(year, monthNum, 0); // Last day of the month
  
  const monthTrips = trips.filter(trip => {
    const tripDate = new Date(trip.startTime);
    return tripDate >= monthStart && tripDate <= monthEnd;
  });
  
  const summary = {
    totalMiles: 0,
    businessMiles: 0,
    personalMiles: 0,
    otherMiles: 0,
    tripCount: monthTrips.length,
    dailyBreakdown: {} as Record<string, { business: number, personal: number, other: number, total: number }>
  };
  
  monthTrips.forEach(trip => {
    const tripDate = new Date(trip.startTime).toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!summary.dailyBreakdown[tripDate]) {
      summary.dailyBreakdown[tripDate] = { business: 0, personal: 0, other: 0, total: 0 };
    }
    
    summary.totalMiles += trip.distance;
    summary.dailyBreakdown[tripDate].total += trip.distance;
    
    switch (trip.classification) {
      case 'business':
        summary.businessMiles += trip.distance;
        summary.dailyBreakdown[tripDate].business += trip.distance;
        break;
      case 'personal':
        summary.personalMiles += trip.distance;
        summary.dailyBreakdown[tripDate].personal += trip.distance;
        break;
      default:
        summary.otherMiles += trip.distance;
        summary.dailyBreakdown[tripDate].other += trip.distance;
        break;
    }
  });
  
  return summary;
}