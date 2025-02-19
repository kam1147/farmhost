import { users, equipment as equipmentTable, bookings, reviews, comparisons, recommendations, type User, type InsertUser, type Equipment, type InsertEquipment, type Booking, type InsertBooking, type UpdateProfile, type Review, type InsertReview, type Recommendation, type InsertRecommendation } from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, or, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { sql } from "drizzle-orm";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<UpdateProfile>): Promise<User>;

  // Equipment operations
  getEquipment(id: number): Promise<Equipment | undefined>;
  listEquipment(): Promise<Equipment[]>;
  listEquipmentByOwner(ownerId: number): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;
  updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment>;

  // Booking operations
  getBooking(id: number): Promise<Booking | undefined>;
  findBookingByRazorpayOrderId(orderId: string): Promise<Booking | undefined>;
  listBookings(userId?: number): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBookingStatus(id: number, status: string): Promise<Booking>;
  updateBooking(id: number, data: Partial<Booking>): Promise<Booking>;
  getBookingsByStatus(status: string): Promise<Booking[]>;
  getBookingsByDateRange(equipmentId: number, startDate: Date, endDate: Date): Promise<Booking[]>;
  checkEquipmentAvailability(equipmentId: number, startDate: Date, endDate: Date): Promise<boolean>;
  deleteEquipmentBookings(equipmentId: number): Promise<void>;  // Added this method

  // Review operations
  createReview(review: InsertReview): Promise<Review>;
  getReviewsByEquipment(equipmentId: number): Promise<Review[]>;
  getAverageRating(equipmentId: number): Promise<number>;

  // Comparison operations
  addToComparison(userId: number, equipmentId: number): Promise<void>;
  removeFromComparison(userId: number, equipmentId: number): Promise<void>;
  getComparison(userId: number): Promise<Equipment[]>;

  // Add recommendation operations
  createRecommendation(recommendation: InsertRecommendation): Promise<Recommendation>;
  getRecommendationsForUser(userId: number): Promise<Recommendation[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  public sessionStore!: session.Store;

  constructor() {
    // Session store will be initialized in init()
  }

  async init() {
    const maxRetries = 5;
    const retryDelay = 5000; // 5 seconds
    let retries = maxRetries;

    while (retries > 0) {
      try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('Database connection verified successfully');

        // Initialize session store
        this.sessionStore = new PostgresSessionStore({
          pool,
          tableName: 'session',
          createTableIfMissing: true,
          pruneSessionInterval: 60 // Prune expired sessions every 60 seconds
        });

        console.log('Session store initialized successfully');
        return;
      } catch (error) {
        console.error(`Database initialization attempt failed (${retries} retries left):`, error);
        retries--;

        if (retries > 0) {
          console.log(`Retrying in ${retryDelay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.error('All database initialization attempts failed');
          // Don't throw, let the application continue and retry operations as needed
        }
      }
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    } catch (error) {
        console.error('Error in getUser:', error);
        throw new Error('Failed to fetch user');
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error('Error in getUserByUsername:', error);
      throw new Error('Failed to fetch user by username');
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error('Error in createUser:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: number, data: Partial<UpdateProfile>): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set(data)
        .where(eq(users.id, id))
        .returning();
      if (!user) throw new Error('User not found');
      return user;
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw new Error('Failed to update user');
    }
  }

  async getEquipment(id: number): Promise<Equipment | undefined> {
    try {
      const [equip] = await db.select().from(equipmentTable).where(eq(equipmentTable.id, id));
      return equip;
    } catch (error) {
      console.error('Error in getEquipment:', error);
      throw new Error('Failed to fetch equipment');
    }
  }

  async listEquipment(): Promise<Equipment[]> {
    try {
      const equipment = await db.select().from(equipmentTable);
      console.log('Database query result:', equipment);

      // Transform the data to ensure proper boolean values
      const transformedEquipment = equipment.map(item => ({
        ...item,
        availability: Boolean(item.availability)
      }));

      return transformedEquipment;
    } catch (error) {
      console.error('Error in listEquipment:', error);
      throw new Error('Failed to list equipment');
    }
  }

  async listEquipmentByOwner(ownerId: number): Promise<Equipment[]> {
    try {
      const equipment = await db
        .select()
        .from(equipmentTable)
        .where(eq(equipmentTable.ownerId, ownerId));

      console.log(`Equipment for owner ${ownerId}:`, equipment);

      // Transform the data to ensure proper boolean values
      const transformedEquipment = equipment.map(item => ({
        ...item,
        availability: Boolean(item.availability)
      }));

      return transformedEquipment;
    } catch (error) {
      console.error('Error in listEquipmentByOwner:', error);
      throw new Error('Failed to list equipment by owner');
    }
  }

  async createEquipment(insertEquipment: InsertEquipment): Promise<Equipment> {
    try {
      const [equipment] = await db
        .insert(equipmentTable)
        .values({
          ownerId: insertEquipment.ownerId,
          name: insertEquipment.name,
          description: insertEquipment.description,
          category: insertEquipment.category,
          dailyRate: insertEquipment.dailyRate,
          location: insertEquipment.location,
          imageUrl: insertEquipment.imageUrl,
          specs: insertEquipment.specs ?? {},
          features: insertEquipment.features ?? [],
          availability: true
        })
        .returning();

      if (!equipment) {
        throw new Error('Failed to create equipment record');
      }

      return equipment;
    } catch (error) {
      console.error('Error in createEquipment:', error);
      throw new Error('Failed to create equipment');
    }
  }

  async updateEquipment(id: number, data: Partial<InsertEquipment>): Promise<Equipment> {
    try {
      const [equipment] = await db
        .update(equipmentTable)
        .set(data)
        .where(eq(equipmentTable.id, id))
        .returning();

      if (!equipment) {
        throw new Error('Equipment not found');
      }

      return equipment;
    } catch (error) {
      console.error('Error updating equipment:', error);
      throw new Error('Failed to update equipment');
    }
  }

  async deleteEquipment(id: number): Promise<void> {
    try {
      await db.delete(equipmentTable).where(eq(equipmentTable.id, id));
    } catch (error) {
      console.error('Error in deleteEquipment:', error);
      throw new Error('Failed to delete equipment');
    }
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    try {
      console.log(`Fetching booking with ID: ${id}`);
      const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));

      if (!booking) {
        console.log(`No booking found with ID: ${id}`);
        return undefined;
      }

      console.log(`Found booking:`, booking);
      return booking;
    } catch (error) {
      console.error('Error in getBooking:', error);
      throw new Error('Failed to fetch booking');
    }
  }

  async findBookingByRazorpayOrderId(orderId: string): Promise<Booking | undefined> {
    try {
      const [booking] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.razorpayOrderId, orderId));
      return booking;
    } catch (error) {
      console.error('Error finding booking by Razorpay order ID:', error);
      throw new Error('Failed to find booking by Razorpay order ID');
    }
  }

  async listBookings(userId?: number): Promise<Booking[]> {
    try {
      // If userId is provided, filter bookings for that user
      // Otherwise, return all bookings (for admin access)
      if (userId) {
        return await db
          .select()
          .from(bookings)
          .where(eq(bookings.userId, userId))
          .orderBy(desc(bookings.createdAt));
      }

      // Return all bookings for admin users
      return await db
        .select()
        .from(bookings)
        .orderBy(desc(bookings.createdAt));
    } catch (error) {
      console.error('Error listing bookings:', error);
      return [];
    }
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    try {
      const [booking] = await db
        .insert(bookings)
        .values({
          ...insertBooking,
          status: insertBooking.status || 'pending',
          createdAt: new Date(),
          lastStatusUpdate: new Date()
        } as any)
        .returning();
      return booking;
    } catch (error) {
      console.error('Error in createBooking:', error);
      throw new Error('Failed to create booking');
    }
  }

  async updateBookingStatus(id: number, status: string): Promise<Booking> {
    try {
      const [booking] = await db
        .update(bookings)
        .set({
          status,
          lastStatusUpdate: new Date()
        })
        .where(eq(bookings.id, id))
        .returning();
      if (!booking) throw new Error('Booking not found');
      return booking;
    } catch (error) {
      console.error('Error in updateBookingStatus:', error);
      throw new Error('Failed to update booking status');
    }
  }

  async updateBooking(id: number, data: Partial<Booking>): Promise<Booking> {
    try {
      const [booking] = await db
        .update(bookings)
        .set({
          ...data,
          lastStatusUpdate: new Date()
        })
        .where(eq(bookings.id, id))
        .returning();
      if (!booking) throw new Error('Booking not found');
      return booking;
    } catch (error) {
      console.error('Error in updateBooking:', error);
      throw new Error('Failed to update booking');
    }
  }

  async getBookingsByStatus(status: string): Promise<Booking[]> {
    try {
      return await db
        .select()
        .from(bookings)
        .where(eq(bookings.status, status));
    } catch (error) {
      console.error('Error in getBookingsByStatus:', error);
      throw new Error('Failed to get bookings by status');
    }
  }

  async getBookingsByDateRange(
    equipmentId: number,
    startDate: Date,
    endDate: Date
  ): Promise<Booking[]> {
    try {
      // Parse dates and ensure they are valid Date objects
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate dates
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.error('Invalid date input:', { startDate, endDate });
        return [];
      }

      // Set times to start and end of day in UTC
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);

      // Query bookings within the date range
      const bookingsResult = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.equipmentId, equipmentId),
            or(
              // Booking starts within the range
              and(
                gte(bookings.startDate, start),
                lte(bookings.startDate, end)
              ),
              // Booking ends within the range
              and(
                gte(bookings.endDate, start),
                lte(bookings.endDate, end)
              ),
              // Booking spans the entire range
              and(
                lte(bookings.startDate, start),
                gte(bookings.endDate, end)
              )
            )
          )
        );

      return bookingsResult.map(booking => ({
        ...booking,
        startDate: new Date(booking.startDate),
        endDate: new Date(booking.endDate)
      }));
    } catch (error) {
      console.error('Error in getBookingsByDateRange:', error);
      return [];
    }
  }

  // Add a new method to check equipment availability directly
  async checkEquipmentAvailability(
    equipmentId: number, 
    startDate: Date, 
    endDate: Date
  ): Promise<boolean> {
    try {
      // First check if equipment exists and is generally available
      const equipment = await this.getEquipment(equipmentId);
      if (!equipment || !equipment.availability) {
        return false;
      }

      // Then check for any conflicting bookings
      const existingBookings = await this.getBookingsByDateRange(equipmentId, startDate, endDate);
      const hasConflictingBooking = existingBookings.some(booking => 
        booking.status === 'paid' || booking.status === 'awaiting_payment'
      );

      return !hasConflictingBooking;
    } catch (error) {
      console.error('Error checking equipment availability:', error);
      throw new Error('Failed to check equipment availability');
    }
  }

  async deleteEquipmentBookings(equipmentId: number): Promise<void> {
    try {
      await db.delete(bookings).where(eq(bookings.equipmentId, equipmentId));
      console.log(`Successfully deleted all bookings for equipment ${equipmentId}`);
    } catch (error) {
      console.error('Error deleting equipment bookings:', error);
      throw new Error('Failed to delete equipment bookings');
    }
  }

  async createReview(review: InsertReview): Promise<Review> {
    try {
      const reviewData = {
        userId: review.userId,
        equipmentId: review.equipmentId,
        rating: review.rating,
        comment: review.comment,
        createdAt: new Date()
      };

      const [newReview] = await db
        .insert(reviews)
        .values(reviewData)
        .returning();

      return {
        ...newReview,
        createdAt: newReview.createdAt.toISOString()
      };
    } catch (error) {
      console.error('Error creating review:', error);
      throw new Error('Failed to create review');
    }
  }

  async getReviewsByEquipment(equipmentId: number): Promise<Review[]> {
    try {
      const results = await db
        .select()
        .from(reviews)
        .where(eq(reviews.equipmentId, equipmentId));

      return results.map(review => ({
        ...review,
        createdAt: review.createdAt.toISOString()
      }));
    } catch (error) {
      console.error('Error in getReviewsByEquipment:', error);
      throw new Error('Failed to get reviews by equipment');
    }
  }

  async getAverageRating(equipmentId: number): Promise<number> {
    try {
      const result = await db
        .select({
          average: sql<number>`COALESCE(AVG(${reviews.rating})::numeric(10,1), 0)`
        })
        .from(reviews)
        .where(eq(reviews.equipmentId, equipmentId));
      return result[0]?.average || 0;
    } catch (error) {
      console.error('Error in getAverageRating:', error);
      throw new Error('Failed to get average rating');
    }
  }

  async addToComparison(userId: number, equipmentId: number): Promise<void> {
    try {
      const [existingComparison] = await db
        .select()
        .from(comparisons)
        .where(eq(comparisons.userId, userId));

      if (existingComparison) {
        const equipmentIds = existingComparison.equipmentIds || [];
        if (!equipmentIds.includes(equipmentId)) {
          await db
            .update(comparisons)
            .set({
              equipmentIds: [...equipmentIds, equipmentId],
            })
            .where(eq(comparisons.userId, userId));
        }
      } else {
        await db
          .insert(comparisons)
          .values({
            userId,
            equipmentIds: [equipmentId],
            createdAt: new Date()
          });
      }
    } catch (error) {
      console.error('Error in addToComparison:', error);
      throw new Error('Failed to add to comparison');
    }
  }

  async removeFromComparison(userId: number, equipmentId: number): Promise<void> {
    try {
      const [comparison] = await db
        .select()
        .from(comparisons)
        .where(eq(comparisons.userId, userId));

      if (comparison) {
        const equipmentIds = comparison.equipmentIds.filter(id => id !== equipmentId);
        await db
          .update(comparisons)
          .set({ equipmentIds })
          .where(eq(comparisons.userId, userId));
      }
    } catch (error) {
      console.error('Error in removeFromComparison:', error);
      throw new Error('Failed to remove from comparison');
    }
  }

  async getComparison(userId: number): Promise<Equipment[]> {
    try {
      const [comparison] = await db
        .select()
        .from(comparisons)
        .where(eq(comparisons.userId, userId));

      if (!comparison) return [];

      return await db
        .select()
        .from(equipmentTable)
        .where(sql`${equipmentTable.id} = ANY(${comparison.equipmentIds})`);
    } catch (error) {
      console.error('Error in getComparison:', error);
      throw new Error('Failed to get comparison');
    }
  }

  async createRecommendation(insertRecommendation: InsertRecommendation): Promise<Recommendation> {
    try {
      const [recommendation] = await db
        .insert(recommendations)
        .values({
          ...insertRecommendation,
          createdAt: new Date()
        })
        .returning();

      return recommendation;
    } catch (error) {
      console.error('Error creating recommendation:', error);
      throw new Error('Failed to create recommendation');
    }
  }

  async getRecommendationsForUser(userId: number): Promise<Recommendation[]> {
    try {
      const userRecommendations = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.userId, userId))
        .orderBy(desc(recommendations.createdAt));

      return userRecommendations;
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      throw new Error('Failed to fetch recommendations');
    }
  }
}

export const storage = new DatabaseStorage();
storage.init().catch(err => {
  console.error('Error initializing storage:', err);
});