import { DIMO } from "@dimo-network/data-sdk";

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

      console.log("DIMO Identity API response:", response);
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

      console.log("DIMO Telemetry API response:", locationData);

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

      console.log(query);

      const historyData = await this.dimo.telemetry.query({
        ...vehicleJwt,
        query: query,
      });

      console.log("DIMO Telemetry API response:", historyData);

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
}

export const dimoService = new DimoService();
