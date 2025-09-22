import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGpsDataSchema } from "@shared/schema";
import { z } from "zod";
import { dimoService } from "./dimo-service";

export async function registerRoutes(app: Express): Promise<Server> {
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

  const httpServer = createServer(app);
  return httpServer;
}
