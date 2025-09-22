import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGpsDataSchema, insertTripSchema } from "@shared/schema";
import { z } from "zod";
import { dimoService } from "./dimo-service";
import { generateMileageSummary } from "./utils";

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

      console.log("Fetching real-time location for vehicle:", vehicleId);

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

      console.log("Fetching weekly location for vehicle:", vehicleId);

      // Use the real DIMO service to get vehicle location
      const locationData = await dimoService.getVehicleWeeklyHistory(vehicleId);
      console.log("Weekly location data:", locationData);
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

  // Trip management routes for Phase 1 testing
  
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
