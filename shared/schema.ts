import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model with language preference and preferences
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  name: text("name").notNull(),
  contact: text("contact"),
  language: text("language").notNull().default('en'),
  imageUrl: text("image_url"),
  preferences: json("preferences").$type<{
    preferredCategories: string[];
    preferredLocations: string[];
    priceRange: { min: number; max: number };
    features: string[];
  }>().default({
    preferredCategories: [],
    preferredLocations: [],
    priceRange: { min: 0, max: 100000 },
    features: []
  }).notNull(),
});

// Equipment model with detailed specifications
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  dailyRate: integer("daily_rate").notNull(),
  imageUrl: text("image_url").notNull(),
  location: text("location").notNull(),
  availability: boolean("availability").notNull().default(true),
  specs: json("specs").$type<Record<string, string>>().default({}).notNull(),
  features: json("features").$type<string[]>().default([]).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  popularity: integer("popularity").notNull().default(0),
});

// Booking model with payment tracking and rating status
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  equipmentId: integer("equipment_id").notNull(),
  userId: integer("user_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalPrice: integer("total_price").notNull(),
  status: text("status").notNull().default('pending'),
  razorpayOrderId: text("razorpay_order_id"),
  razorpayPaymentId: text("razorpay_payment_id"),
  isRated: boolean("is_rated").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastStatusUpdate: timestamp("last_status_update").notNull().defaultNow(),
});

// Reviews and ratings
export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  equipmentId: integer("equipment_id").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Comparison lists
export const comparisons = pgTable("comparisons", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  equipmentIds: integer("equipment_ids").array().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Recommendations
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  equipmentId: integer("equipment_id").notNull(),
  score: integer("score").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Define insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  language: true,
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({
  id: true,
  createdAt: true,
  popularity: true,
}).extend({
  specs: z.record(z.string(), z.string()).default({}),
  features: z.array(z.string()).default([])
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  lastStatusUpdate: true,
  isRated: true,
}).extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.string().default('pending'),
  totalPrice: z.number().optional(),
});

export const insertRecommendationSchema = createInsertSchema(recommendations).omit({
  id: true,
  createdAt: true,
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().optional(),
  language: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const reviewSchema = z.object({
  id: z.number().optional(),
  userId: z.number(),
  equipmentId: z.number(),
  rating: z.number().min(1, "Please select a rating").max(5, "Rating cannot exceed 5 stars"),
  comment: z.string().min(10, "Please provide a detailed comment (minimum 10 characters)").max(500, "Comment is too long (maximum 500 characters)"),
  createdAt: z.date().optional()
});

export const paymentSessionSchema = z.object({
  id: z.string(),
  url: z.string(),
  bookingId: z.number(),
});

export const receiptSchema = z.object({
  bookingId: z.number(),
  status: z.string(),
  timestamp: z.string(),
  receipt_url: z.string().nullable(),
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type InsertReview = z.infer<typeof reviewSchema>;
export type PaymentSession = z.infer<typeof paymentSessionSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type Recommendation = typeof recommendations.$inferSelect;
export type InsertRecommendation = z.infer<typeof insertRecommendationSchema>;