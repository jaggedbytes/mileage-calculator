import { 
  type User, 
  type InsertUser, 
  type GpsData, 
  type InsertGpsData,
  type Trip,
  type InsertTrip,
  type MileageReport,
  type InsertMileageReport
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // GPS data operations
  saveGpsData(data: InsertGpsData): Promise<GpsData>;
  getLatestGpsData(): Promise<GpsData | undefined>;
  getAllGpsData(): Promise<GpsData[]>;
  
  // Trip operations
  createTrip(trip: InsertTrip): Promise<Trip>;
  getTrip(id: string): Promise<Trip | undefined>;
  getTripsByUser(userId: string): Promise<Trip[]>;
  getTripsByUserAndVehicle(userId: string, vehicleId: string): Promise<Trip[]>;
  getTripsByDateRange(userId: string, startDate: string, endDate: string): Promise<Trip[]>;
  updateTrip(id: string, updates: Partial<InsertTrip>): Promise<Trip | undefined>;
  deleteTrip(id: string): Promise<boolean>;
  
  // Mileage report operations
  createMileageReport(report: InsertMileageReport): Promise<MileageReport>;
  getMileageReport(id: string): Promise<MileageReport | undefined>;
  getMileageReportsByUser(userId: string): Promise<MileageReport[]>;
  getMileageReportByUserAndMonth(userId: string, month: string, year: number): Promise<MileageReport | undefined>;
  updateMileageReport(id: string, updates: Partial<InsertMileageReport>): Promise<MileageReport | undefined>;
  deleteMileageReport(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private gpsDataStore: Map<string, GpsData>;
  private trips: Map<string, Trip>;
  private mileageReports: Map<string, MileageReport>;

  constructor() {
    this.users = new Map();
    this.gpsDataStore = new Map();
    this.trips = new Map();
    this.mileageReports = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async saveGpsData(data: InsertGpsData): Promise<GpsData> {
    const id = randomUUID();
    const gpsData: GpsData = { 
      ...data, 
      id, 
      timestamp: new Date().toISOString() 
    };
    this.gpsDataStore.set(id, gpsData);
    return gpsData;
  }

  async getLatestGpsData(): Promise<GpsData | undefined> {
    const allData = Array.from(this.gpsDataStore.values());
    return allData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  async getAllGpsData(): Promise<GpsData[]> {
    return Array.from(this.gpsDataStore.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Trip operations
  async createTrip(insertTrip: InsertTrip): Promise<Trip> {
    const id = randomUUID();
    const trip: Trip = { 
      ...insertTrip,
      notes: insertTrip.notes ?? null,
      id, 
      createdAt: new Date().toISOString() 
    };
    this.trips.set(id, trip);
    return trip;
  }

  async getTrip(id: string): Promise<Trip | undefined> {
    return this.trips.get(id);
  }

  async getTripsByUser(userId: string): Promise<Trip[]> {
    return Array.from(this.trips.values())
      .filter(trip => trip.userId === userId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  async getTripsByUserAndVehicle(userId: string, vehicleId: string): Promise<Trip[]> {
    return Array.from(this.trips.values())
      .filter(trip => trip.userId === userId && trip.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  async getTripsByDateRange(userId: string, startDate: string, endDate: string): Promise<Trip[]> {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    
    return Array.from(this.trips.values())
      .filter(trip => {
        const tripStart = new Date(trip.startTime).getTime();
        return trip.userId === userId && tripStart >= start && tripStart <= end;
      })
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  async updateTrip(id: string, updates: Partial<InsertTrip>): Promise<Trip | undefined> {
    const existingTrip = this.trips.get(id);
    if (!existingTrip) {
      return undefined;
    }
    
    const updatedTrip: Trip = { ...existingTrip, ...updates };
    this.trips.set(id, updatedTrip);
    return updatedTrip;
  }

  async deleteTrip(id: string): Promise<boolean> {
    return this.trips.delete(id);
  }

  // Mileage report operations
  async createMileageReport(insertReport: InsertMileageReport): Promise<MileageReport> {
    const id = randomUUID();
    const report: MileageReport = { 
      ...insertReport,
      reportData: insertReport.reportData ?? null,
      id, 
      generatedAt: new Date().toISOString() 
    };
    this.mileageReports.set(id, report);
    return report;
  }

  async getMileageReport(id: string): Promise<MileageReport | undefined> {
    return this.mileageReports.get(id);
  }

  async getMileageReportsByUser(userId: string): Promise<MileageReport[]> {
    return Array.from(this.mileageReports.values())
      .filter(report => report.userId === userId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }

  async getMileageReportByUserAndMonth(userId: string, month: string, year: number): Promise<MileageReport | undefined> {
    return Array.from(this.mileageReports.values())
      .find(report => report.userId === userId && report.month === month && report.year === year);
  }

  async updateMileageReport(id: string, updates: Partial<InsertMileageReport>): Promise<MileageReport | undefined> {
    const existingReport = this.mileageReports.get(id);
    if (!existingReport) {
      return undefined;
    }
    
    const updatedReport: MileageReport = { ...existingReport, ...updates };
    this.mileageReports.set(id, updatedReport);
    return updatedReport;
  }

  async deleteMileageReport(id: string): Promise<boolean> {
    return this.mileageReports.delete(id);
  }
}

export const storage = new MemStorage();
