import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGpsDataSchema, insertTripSchema } from "@shared/schema";
import { z } from "zod";
import { dimoService } from "./dimo-service";
import { generateMileageSummary, generateMileageSummaryFromTrips } from "./utils";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication callback routes
  app.get("/auth/callback", (req, res) => {
    // This route handles the OAuth callback from DIMO
    // The actual authentication is handled by the DIMO SDK on the client side
    // This route just redirects back to the main app
    const { logout } = req.query;
    
    if (logout === "true") {
      // Handle logout - redirect to home page
      res.redirect("/");
    } else {
      // Handle successful authentication - redirect to home page
      res.redirect("/");
    }
  });

  // GPS data routes
  app.post("/api/gps", async (req, res) => {
    try {
      const validatedData = insertGpsDataSchema.parse(req.body);
      const savedData = await storage.saveGpsData(validatedData);
      res.json(savedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: "Invalid GPS data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to save GPS data" });
      }
    }
  });

  app.get("/api/gps/latest", async (req, res) => {
    try {
      const latestData = await storage.getLatestGpsData();
      if (!latestData) {
        res.status(404).json({ message: "No GPS data found" });
        return;
      }
      res.json(latestData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch GPS data" });
    }
  });

  app.get("/api/gps", async (req, res) => {
    try {
      const allData = await storage.getAllGpsData();
      res.json(allData);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch GPS data" });
    }
  });

  // DIMO API routes - require user authentication token
  app.get("/api/dimo/vehicles", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res
          .status(401)
          .json({ message: "Missing or invalid authorization token" });
        return;
      }

      const userToken = authHeader.substring(7); // Remove 'Bearer ' prefix
      const userWalletAddress = req.query.walletAddress as string;

      if (!userWalletAddress) {
        res.status(400).json({ message: "Missing walletAddress parameter" });
        return;
      }

      const clientId = process.env.DIMO_CLIENT_ID || "";

      const vehicles = await dimoService.getUserVehicles(
        userWalletAddress,
        clientId,
      );

      res.json({
        walletAddress: userWalletAddress,
        vehicles: vehicles.nodes || [],
        count: vehicles.nodes?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching DIMO vehicles:", error);
      res.status(500).json({ message: "Failed to fetch vehicles from DIMO" });
    }
  });

  // Get real-time location data for a specific vehicle using DIMO data-sdk
  app.get("/api/dimo/vehicles/:vehicleId/location", async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res
          .status(401)
          .json({ message: "Missing or invalid authorization token" });
        return;
      }


      // Use the real DIMO service to get vehicle location
      const locationData = await dimoService.getVehicleLocation(vehicleId);

      // Automatically save to GPS storage for visualization
      const savedData = await storage.saveGpsData(locationData);

      res.json(savedData);
    } catch (error) {
      console.error("Error fetching vehicle location:", error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch vehicle location from DIMO",
      });
    }
  });

  // Get real-time location data for a specific vehicle using DIMO data-sdk
  app.get("/api/dimo/vehicles/:vehicleId/history", async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res
          .status(401)
          .json({ message: "Missing or invalid authorization token" });
        return;
      }


      // Use the real DIMO service to get vehicle location
      const locationData = await dimoService.getVehicleWeeklyHistory(vehicleId);
      // Automatically save to GPS storage for visualization
      const savedData = await storage.saveGpsData(locationData);

      res.json(savedData);
    } catch (error) {
      console.error("Error fetching vehicle location:", error);
      res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch vehicle location from DIMO",
      });
    }
  });
  
  // Import trips from DIMO data for a vehicle
  app.post("/api/trips/import/:vehicleId", async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const { userId, days = 7 } = req.body;
      
      if (!userId) {
        res.status(400).json({ message: "userId is required" });
        return;
      }

      console.log(`Importing trips for vehicle ${vehicleId}, user ${userId}, ${days} days back`);
      
      // Import trips using DIMO service
      const detectedTrips = await dimoService.importVehicleTrips(vehicleId, userId, parseInt(days));
      
      // Save trips to storage
      const savedTrips = await Promise.all(
        detectedTrips.map(trip => storage.createTrip(trip))
      );
      
      res.json({
        message: `Successfully imported ${savedTrips.length} trips`,
        trips: savedTrips,
        vehicleId,
        days: parseInt(days)
      });
    } catch (error) {
      console.error("Error importing trips:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to import trips"
      });
    }
  });

  // Get trips for a user
  app.get("/api/trips", async (req, res) => {
    try {
      const { userId, vehicleId, from, to } = req.query;
      
      if (!userId) {
        res.status(400).json({ message: "userId parameter is required" });
        return;
      }
      
      let trips;
      if (vehicleId) {
        trips = await storage.getTripsByUserAndVehicle(userId as string, vehicleId as string);
      } else if (from && to) {
        trips = await storage.getTripsByDateRange(userId as string, from as string, to as string);
      } else {
        trips = await storage.getTripsByUser(userId as string);
      }
      
      res.json({
        trips,
        count: trips.length,
        filters: { userId, vehicleId, from, to }
      });
    } catch (error) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  // Generate mileage summary for a month
  app.get("/api/mileage/summary", async (req, res) => {
    try {
      const { userId, month } = req.query; // month in YYYY-MM format
      
      if (!userId || !month) {
        res.status(400).json({ message: "userId and month parameters are required" });
        return;
      }
      
      // Get all trips for the user
      const allTrips = await storage.getTripsByUser(userId as string);
      
      // Generate monthly summary
      const summary = generateMileageSummary(allTrips, month as string);
      
      res.json({
        month,
        userId,
        summary,
        totalTrips: allTrips.length
      });
    } catch (error) {
      console.error("Error generating mileage summary:", error);
      res.status(500).json({ message: "Failed to generate mileage summary" });
    }
  });

  // Detect trips using ignition signals for maximum accuracy
  app.post("/api/trips/detect/:vehicleId", async (req, res) => {
    try {
      const { vehicleId } = req.params;
      const { userId, from, to } = req.body;
      
      if (!userId) {
        res.status(400).json({ message: "userId is required" });
        return;
      }

      // Default to last 7 days if no date range provided
      const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const toDate = to || new Date().toISOString();

      // Detect trips using ignition signals
      const detectedTrips = await dimoService.detectVehicleTripsFromIgnition(vehicleId, userId, fromDate, toDate);
      
      // Save trips to storage
      const savedTrips = await Promise.all(
        detectedTrips.map(trip => storage.createTrip(trip))
      );
      
      res.json({
        message: `Successfully detected ${savedTrips.length} trips using ignition signals`,
        trips: savedTrips,
        vehicleId,
        from: fromDate,
        to: toDate,
        detectionMethod: "ignition"
      });
    } catch (error) {
      console.error("Error detecting trips:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to detect trips"
      });
    }
  });

    // Update trip classification
    app.patch("/api/trips/:tripId/classification", async (req, res) => {
      try {
        const { tripId } = req.params;
        const { classification } = req.body;
        
        
        if (!classification || !['business', 'personal', 'other'].includes(classification)) {
          res.status(400).json({ message: "Invalid classification. Must be 'business', 'personal', or 'other'" });
          return;
        }
        
        const updatedTrip = await storage.updateTrip(tripId, { classification });
        
        if (!updatedTrip) {
          res.status(404).json({ message: "Trip not found" });
          return;
        }
        
        res.json({ message: "Classification updated successfully", trip: updatedTrip });
      } catch (error) {
        console.error("Error updating trip classification:", error);
        res.status(500).json({ message: "Failed to update classification" });
      }
    });

    // Update trip notes
    app.patch("/api/trips/:tripId/notes", async (req, res) => {
      try {
        const { tripId } = req.params;
        const { userNotes } = req.body;
        
        if (userNotes === undefined) {
          res.status(400).json({ message: "userNotes is required" });
          return;
        }
        
        const updatedTrip = await storage.updateTrip(tripId, { userNotes: userNotes || '' });
        
        if (!updatedTrip) {
          res.status(404).json({ message: "Trip not found" });
          return;
        }
        
        res.json({ message: "Notes updated successfully", trip: updatedTrip });
      } catch (error) {
        console.error("Error updating trip notes:", error);
        res.status(500).json({ message: "Failed to update notes" });
      }
    });

    // Export mileage data as CSV
    app.get("/api/mileage/export", async (req, res) => {
    try {
      const { userId, month, vehicleId, vehicleInfo, dateRange, excludedTrips } = req.query; // month in YYYY-MM format
      
      if (!userId || !month) {
        res.status(400).json({ message: "userId and month parameters are required" });
        return;
      }
      
        // Get all trips for the user
        let allTrips = await storage.getTripsByUser(userId as string);
        
        // Filter out excluded trips if provided
        if (excludedTrips && typeof excludedTrips === 'string') {
          const excludedTripIds = excludedTrips.split(',').filter(id => id.trim() !== '');
          allTrips = allTrips.filter(trip => !excludedTripIds.includes(trip.id));
        }

        // If dateRange is provided, filter trips by the actual date range instead of just month
        if (dateRange && typeof dateRange === 'string') {
          const [fromDateStr, toDateStr] = dateRange.split('_to_');
          if (fromDateStr && toDateStr) {
            const fromDate = new Date(fromDateStr + 'T00:00:00.000Z');
            const toDate = new Date(toDateStr + 'T23:59:59.999Z');
            
            allTrips = allTrips.filter(trip => {
              const tripDate = new Date(trip.startTime);
              return tripDate >= fromDate && tripDate <= toDate;
            });
          }
        }
        
      
        // Get vehicle info from URL parameter or fallback to vehicleId
        let vehicleInfoForFilename = "";
        if (vehicleInfo) {
          // Use the vehicle info passed from frontend
          vehicleInfoForFilename = `-${(vehicleInfo as string).replace(/\s+/g, '-')}`;
        } else if (vehicleId) {
          // Fallback to vehicle ID if no vehicle info provided
          vehicleInfoForFilename = `-vehicle-${vehicleId}`;
        }

        // Use date range for filename if provided, otherwise fallback to month
        const dateRangeForFilename = dateRange ? `-${dateRange}` : `-${month}`;

        // Check if there are any trips
        if (allTrips.length === 0) {
          // Return a CSV with just headers and a message
          const csvContent = "Date,Business Miles,Personal Miles,Other Miles,Total Miles\nNo trips found for this period. Please detect trips first.\n";
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="mileage${vehicleInfoForFilename}${dateRangeForFilename}-no-data.csv"`);
          res.send(csvContent);
          return;
        }
      
      // Generate summary - use date range filtering if available, otherwise use month
      let summary;
      if (dateRange && typeof dateRange === 'string') {
        // Use the already filtered trips for date range
        summary = generateMileageSummaryFromTrips(allTrips);
      } else {
        // Fall back to month-based filtering
        summary = generateMileageSummary(allTrips, month as string);
      }
      
        // Check if there are any trips for the period
        if (Object.keys(summary.dailyBreakdown).length === 0) {
          // Return a CSV with just headers and a message
          const csvContent = "Date,Business Miles,Personal Miles,Other Miles,Total Miles\nNo trips found for this period. Please detect trips first.\n";
          
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="mileage${vehicleInfoForFilename}${dateRangeForFilename}-no-data.csv"`);
          res.send(csvContent);
          return;
        }
        
        // Create CSV content - show individual trips instead of daily aggregations
        const csvHeader = "Date,Time,Classification,Distance (Miles),Start Location,End Location,Notes\n";
        const csvRows = allTrips
          .map(trip => {
            const tripDate = new Date(trip.startTime).toISOString().split('T')[0]; // YYYY-MM-DD
            const tripTime = new Date(trip.startTime).toLocaleTimeString('en-US', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            const startLoc = `${trip.startLatitude.toFixed(4)}, ${trip.startLongitude.toFixed(4)}`;
            const endLoc = `${trip.endLatitude.toFixed(4)}, ${trip.endLongitude.toFixed(4)}`;
            const notes = (trip.userNotes || '').replace(/"/g, '""'); // Escape quotes for CSV
            
            const classification = trip.classification.charAt(0).toUpperCase() + trip.classification.slice(1);
            return `${tripDate},${tripTime},${classification},${trip.distance.toFixed(2)},"${startLoc}","${endLoc}","${notes}"`;
          })
          .join('\n');
        
        const csvContent = csvHeader + csvRows;
        
        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="mileage${vehicleInfoForFilename}${dateRangeForFilename}.csv"`);
        
        res.send(csvContent);
    } catch (error) {
      console.error("Error exporting mileage data:", error);
      res.status(500).json({ message: "Failed to export mileage data" });
    }
  });

  // Update trip classification
  app.patch("/api/trips/:tripId", async (req, res) => {
    try {
      const { tripId } = req.params;
      const updates = req.body;
      
      // Validate classification if provided
      if (updates.classification && !["business", "personal", "other"].includes(updates.classification)) {
        res.status(400).json({ message: "Invalid classification. Must be: business, personal, or other" });
        return;
      }
      
      const updatedTrip = await storage.updateTrip(tripId, updates);
      
      if (!updatedTrip) {
        res.status(404).json({ message: "Trip not found" });
        return;
      }
      
      res.json({
        message: "Trip updated successfully",
        trip: updatedTrip
      });
    } catch (error) {
      console.error("Error updating trip:", error);
      res.status(500).json({ message: "Failed to update trip" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
