import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const gpsData = pgTable("gps_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  hdop: real("hdop").notNull(),
  timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  vehicleId: text("vehicle_id").notNull(), // DIMO vehicle token ID
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  startLatitude: real("start_latitude").notNull(),
  startLongitude: real("start_longitude").notNull(),
  endLatitude: real("end_latitude").notNull(),
  endLongitude: real("end_longitude").notNull(),
  distance: real("distance").notNull(), // distance in miles
  classification: text("classification").notNull().default("personal"), // business, personal, other
  notes: text("notes"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mileageReports = pgTable("mileage_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  month: text("month").notNull(), // YYYY-MM format
  year: integer("year").notNull(),
  totalMiles: real("total_miles").notNull(),
  businessMiles: real("business_miles").notNull(),
  personalMiles: real("personal_miles").notNull(),
  reportData: text("report_data"), // JSON blob with detailed breakdown
  generatedAt: text("generated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertGpsDataSchema = createInsertSchema(gpsData).pick({
  lat: true,
  lng: true,
  hdop: true,
});

export const insertTripSchema = createInsertSchema(trips).pick({
  userId: true,
  vehicleId: true,
  startTime: true,
  endTime: true,
  startLatitude: true,
  startLongitude: true,
  endLatitude: true,
  endLongitude: true,
  distance: true,
  classification: true,
  notes: true,
}).extend({
  classification: z.enum(["business", "personal", "other"]).default("personal"),
});

export const insertMileageReportSchema = createInsertSchema(mileageReports).pick({
  userId: true,
  month: true,
  year: true,
  totalMiles: true,
  businessMiles: true,
  personalMiles: true,
  reportData: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertGpsData = z.infer<typeof insertGpsDataSchema>;
export type GpsData = typeof gpsData.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertMileageReport = z.infer<typeof insertMileageReportSchema>;
export type MileageReport = typeof mileageReports.$inferSelect;
