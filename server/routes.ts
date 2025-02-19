import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertEquipmentSchema, insertBookingSchema, updateProfileSchema, reviewSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import { nanoid } from "nanoid";
import express from 'express';
import fs from 'fs';
import { format } from 'date-fns';
import { createPaymentSession, verifyPaymentSignature, generateReceipt } from "./payment";
import crypto from 'crypto';

// Configure multer for image uploads with better error handling
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueId = nanoid();
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueId}${ext}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('Invalid file type. Only JPEG, PNG and WebP images are allowed.');
      return cb(error as any, false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  setupAuth(app);

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // User profile routes
  app.post("/api/user/profile/image", upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!req.file) return res.status(400).send("No image uploaded");

    const imageUrl = `/uploads/${req.file.filename}`;
    await storage.updateUser(req.user.id, { imageUrl });
    res.json({ imageUrl });
  });

  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const updatedUser = await storage.updateUser(req.user.id, parsed.data);
    res.json(updatedUser);
  });

  // Equipment routes with enhanced error handling and logging
  app.get("/api/equipment", async (req, res) => {
    try {
      const owned = req.query.owned === 'true';
      console.log('Fetching equipment, owned filter:', owned);

      // If owned=true, require authentication and only return user's equipment
      if (owned) {
        if (!req.isAuthenticated()) {
          console.log('Unauthorized attempt to view owned equipment');
          return res.status(401).json({ error: 'Authentication required to view owned equipment' });
        }
        const equipment = await storage.listEquipmentByOwner(req.user.id);
        console.log(`Found ${equipment.length} items owned by user ${req.user.id}`);
        return res.json(equipment);
      }

      // Otherwise return all equipment (for the marketplace view)
      const equipment = await storage.listEquipment();
      console.log(`Found ${equipment.length} total equipment items`);

      // Instead of filtering, return all equipment with their availability status
      equipment.forEach(item => {
        console.log(`Equipment ${item.id}: availability = ${item.availability}`);
      });

      res.json(equipment);
    } catch (error) {
      console.error('Error listing equipment:', error);
      res.status(500).json({ error: 'Failed to list equipment' });
    }
  });

  app.get("/api/equipment/:id", async (req, res) => {
    try {
      const equipment = await storage.getEquipment(parseInt(req.params.id));
      if (!equipment) return res.status(404).json({ error: "Equipment not found" });
      res.json(equipment);
    } catch (error) {
      console.error('Error getting equipment:', error);
      res.status(500).json({ error: 'Failed to get equipment details' });
    }
  });

  // Enhanced equipment creation endpoint
  app.post("/api/equipment", upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Validate file upload
      if (!req.file) {
        return res.status(400).json({
          error: 'Image is required',
          details: 'Please upload an equipment image'
        });
      }

      // Parse and validate JSON fields
      let specs = {};
      let features = [];

      try {
        if (req.body.specs) {
          specs = JSON.parse(req.body.specs);
          if (typeof specs !== 'object' || Array.isArray(specs)) {
            throw new Error('Specs must be an object');
          }
        }

        if (req.body.features) {
          features = JSON.parse(req.body.features);
          if (!Array.isArray(features)) {
            throw new Error('Features must be an array');
          }
        }
      } catch (error) {
        return res.status(400).json({
          error: 'Invalid JSON format',
          details: error instanceof Error ? error.message : 'Invalid specs or features format'
        });
      }

      const equipmentData = {
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        dailyRate: parseInt(req.body.dailyRate),
        location: req.body.location,
        specs,
        features,
        ownerId: req.user.id,
        imageUrl: `/uploads/${req.file.filename}`,
      };

      const parsed = insertEquipmentSchema.safeParse(equipmentData);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.errors
        });
      }

      const equipment = await storage.createEquipment(parsed.data);
      res.status(201).json({
        message: 'Equipment created successfully',
        equipment
      });
    } catch (error) {
      console.error('Error creating equipment:', error);
      res.status(500).json({
        error: 'Failed to create equipment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add equipment update endpoint
  app.patch("/api/equipment/:id", upload.single('image'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const equipmentId = parseInt(req.params.id);
      const equipment = await storage.getEquipment(equipmentId);

      if (!equipment) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      // Only allow equipment owner or admin to update
      if (equipment.ownerId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: 'Not authorized to update this equipment' });
      }

      let updateData: any = {
        ...req.body,
      };

      if (req.file) {
        updateData.imageUrl = `/uploads/${req.file.filename}`;
      }

      // Handle specs and features parsing
      if (req.body.specs) {
        try {
          updateData.specs = JSON.parse(req.body.specs);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid specs format' });
        }
      }

      if (req.body.features) {
        try {
          updateData.features = JSON.parse(req.body.features);
        } catch (e) {
          return res.status(400).json({ error: 'Invalid features format' });
        }
      }

      if (req.body.dailyRate) {
        updateData.dailyRate = parseInt(req.body.dailyRate);
      }

      const updated = await storage.updateEquipment(equipmentId, updateData);
      res.json(updated);
    } catch (error) {
      console.error('Error updating equipment:', error);
      res.status(500).json({
        error: 'Failed to update equipment',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update the availability endpoint to be more robust
  app.get("/api/equipment/:id/availability", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.id);
      if (isNaN(equipmentId)) {
        console.error('Invalid equipment ID:', req.params.id);
        return res.status(400).json({ error: 'Invalid equipment ID' });
      }

      // Parse dates with validation
      const now = new Date();
      let startDate = now;
      let endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30); // Default to 30 days from now

      if (req.query.startDate) {
        const parsedStart = new Date(req.query.startDate as string);
        if (!isNaN(parsedStart.getTime())) {
          startDate = parsedStart;
        } else {
          console.error('Invalid start date:', req.query.startDate);
          return res.status(400).json({ error: 'Invalid start date format' });
        }
      }

      if (req.query.endDate) {
        const parsedEnd = new Date(req.query.endDate as string);
        if (!isNaN(parsedEnd.getTime())) {
          endDate = parsedEnd;
        } else {
          console.error('Invalid end date:', req.query.endDate);
          return res.status(400).json({ error: 'Invalid end date format' });
        }
      }

      // Ensure startDate is not in the past
      if (startDate < now) {
        startDate = now;
      }

      // Ensure endDate is after startDate
      if (endDate <= startDate) {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 30);
      }

      // First check if equipment exists
      const equipment = await storage.getEquipment(equipmentId);
      if (!equipment) {
        return res.status(404).json({ error: 'Equipment not found' });
      }

      // Check if equipment is generally available
      if (!equipment.availability) {
        return res.json({
          available: false,
          message: 'Equipment is not available for booking'
        });
      }

      // Check specific date range availability
      const isAvailable = await storage.checkEquipmentAvailability(
        equipmentId,
        startDate,
        endDate
      );

      res.json({
        available: isAvailable,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        message: isAvailable ? 'Equipment is available for the selected dates' : 'Equipment is not available for the selected dates'
      });
    } catch (error) {
      console.error('Error checking equipment availability:', error);
      res.status(500).json({
        error: 'Failed to check equipment availability',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add equipment availability update endpoint for owners
  app.patch("/api/equipment/:id/availability", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const equipmentId = parseInt(req.params.id);
      const equipment = await storage.getEquipment(equipmentId);

      if (!equipment) {
        return res.status(404).json({ error: "Equipment not found" });
      }

      // Verify ownership
      if (equipment.ownerId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to update this equipment" });
      }

      const { available } = req.body;

      // Update equipment availability
      const updated = await storage.updateEquipment(equipmentId, {
        availability: available
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating availability:', error);
      res.status(500).json({ error: "Failed to update availability" });
    }
  });

  // Add equipment delete endpoint
  app.delete("/api/equipment/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const equipmentId = parseInt(req.params.id);
      const equipment = await storage.getEquipment(equipmentId);

      if (!equipment) {
        return res.status(404).json({ error: "Equipment not found" });
      }

      // Only allow equipment owner to delete
      if (equipment.ownerId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: "Not authorized to delete this equipment" });
      }

      // Delete equipment from storage
      await storage.deleteEquipment(equipmentId);

      // Also delete any related bookings
      await storage.deleteEquipmentBookings(equipmentId);

      res.json({ success: true, message: "Equipment deleted successfully" });
    } catch (error) {
      console.error('Error deleting equipment:', error);
      res.status(500).json({
        error: "Failed to delete equipment",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Update the booking creation endpoint to use Razorpay
  app.post("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const bookingData = {
        ...req.body,
        userId: req.user.id,
        status: 'pending'
      };

      const parsed = insertBookingSchema.safeParse(bookingData);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid booking data",
          details: parsed.error.errors
        });
      }

      const equipment = await storage.getEquipment(parsed.data.equipmentId);
      if (!equipment) {
        return res.status(404).json({ error: "Equipment not found" });
      }

      // Check if equipment is available
      if (!equipment.availability) {
        return res.status(400).json({ error: "Equipment is not available for booking" });
      }

      // Calculate rental duration in days including both start and end dates
      const startDate = new Date(parsed.data.startDate);
      const endDate = new Date(parsed.data.endDate);
      const totalDays = Math.max(1, Math.ceil(
        (endDate.getTime() - startDate.getTime()) /
        (1000 * 3600 * 24)
      ) + 1); // Add 1 to include both start and end dates

      // Calculate total amount based on daily rate and duration
      const totalAmount = equipment.dailyRate * totalDays;

      // First check if equipment is still available
      const isAvailable = await storage.checkEquipmentAvailability(
        parsed.data.equipmentId,
        startDate,
        endDate
      );

      if (!isAvailable) {
        return res.status(400).json({ error: "Equipment is no longer available for these dates" });
      }

      // Create booking record with calculated total price
      const booking = await storage.createBooking({
        ...parsed.data,
        totalPrice: totalAmount,
        startDate,
        endDate,
        status: 'pending'
      });

      try {
        // Lock equipment by marking it unavailable
        await storage.updateEquipment(parsed.data.equipmentId, {
          availability: false
        });

        // Create Razorpay order
        const razorpayOrder = await createPaymentSession(booking.id, totalAmount, equipment.name);

        // Update booking with Razorpay order info
        const updatedBooking = await storage.updateBooking(booking.id, {
          status: 'awaiting_payment',
          razorpayOrderId: razorpayOrder.id
        });

        console.log(`Created booking ${booking.id} for equipment ${equipment.id}, awaiting payment`);

        // Return booking info with complete Razorpay configuration
        res.status(201).json({
          booking: updatedBooking,
          razorpayConfig: {
            key: razorpayOrder.keyId,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            name: razorpayOrder.name,
            description: razorpayOrder.description,
            order_id: razorpayOrder.id,
            prefill: razorpayOrder.prefill
          }
        });
      } catch (paymentError) {
        console.error('Error in payment order creation:', paymentError);

        // Revert equipment availability if payment setup fails
        await storage.updateEquipment(parsed.data.equipmentId, {
          availability: true
        });

        // Update booking status to payment_failed
        await storage.updateBooking(booking.id, { status: 'payment_failed' });

        res.status(400).json({
          error: "Payment order creation failed",
          details: paymentError instanceof Error ? paymentError.message : "Unknown payment error"
        });
      }
    } catch (error) {
      console.error('Error in booking creation:', error);
      res.status(500).json({
        error: "Failed to process booking",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Update verification endpoint to properly handle equipment availability
  app.post("/api/bookings/verify-payment", express.json(), async (req, res) => {
    try {
      const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        console.error('Missing required payment verification fields:', req.body);
        return res.status(400).json({
          error: 'Missing required payment details',
          details: 'All payment verification fields are required'
        });
      }

      // Get the booking details first to ensure it exists
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        console.error(`Booking not found for verification: ${bookingId}`);
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Verify if this payment was already processed
      if (booking.status === 'paid') {
        console.log(`Payment already verified for booking ${bookingId}`);
        return res.status(200).json({ success: true, booking });
      }

      const isValid = await verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

      if (!isValid) {
        console.error('Invalid payment signature for booking:', bookingId);
        // If payment verification fails, make equipment available again
        await storage.updateEquipment(booking.equipmentId, {
          availability: true
        });
        return res.status(400).json({ error: 'Invalid payment signature' });
      }

      console.log(`Processing payment verification for booking ${bookingId}, equipment ${booking.equipmentId}`);

      // First update the booking status
      const updatedBooking = await storage.updateBooking(bookingId, {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id
      });

      if (!updatedBooking) {
        throw new Error('Failed to update booking status');
      }

      console.log(`Successfully updated booking ${bookingId} status to paid`);

      // Then explicitly set equipment availability to false
      await storage.updateEquipment(booking.equipmentId, {
        availability: false
      });

      console.log(`Equipment ${booking.equipmentId} marked as unavailable after payment verification`);

      res.json({
        success: true,
        booking: updatedBooking,
        message: 'Payment verified successfully and equipment marked as unavailable'
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        error: 'Payment verification failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update the webhook handler
  app.post("/api/webhooks/razorpay", express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      // If webhook secret is configured, verify the signature
      if (webhookSecret) {
        const signature = req.headers['x-razorpay-signature'];
        if (!signature) {
          return res.status(400).json({ error: 'Missing signature' });
        }

        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(req.body)
          .digest('hex');

        if (signature !== expectedSignature) {
          return res.status(400).json({ error: 'Invalid signature' });
        }
      }

      const event = JSON.parse(req.body.toString());
      const result = await handleWebhookEvent(event);

      if (result) {
        if (result.status === 'success' && result.paymentId) {
          // Update booking status
          const booking = await storage.updateBooking(result.bookingId, {
            status: 'paid',
            razorpayPaymentId: result.paymentId
          });

          // Also update equipment availability
          if (booking) {
            await storage.updateEquipment(booking.equipmentId, {
              availability: false
            });

            // Generate receipt with the payment ID
            await generateReceipt(result.bookingId, result.paymentId);
          }
        } else if (result.status === 'failed') {
          // Update booking status to failed and ensure equipment remains available
          const booking = await storage.updateBooking(result.bookingId, {
            status: 'payment_failed'
          });

          if (booking) {
            await storage.updateEquipment(booking.equipmentId, {
              availability: true
            });
          }
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error('Webhook Error:', err);
      if (err instanceof Error) {
        res.status(400).send(`Webhook Error: ${err.message}`);
      } else {
        res.status(400).send('Webhook Error: Unknown error');
      }
    }
  });

  // Update receipt generation endpoint
  app.post("/api/bookings/:id/receipt", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (!booking.razorpayPaymentId) {
        return res.status(400).json({ error: "No payment found for this booking" });
      }

      const receipt = await generateReceipt(bookingId, booking.razorpayPaymentId);
      res.json(receipt);
    } catch (error) {
      console.error('Error generating receipt:', error);
      res.status(500).json({ error: "Failed to generate receipt" });
    }
  });

  // Review routes
  app.get("/api/equipment/:id/reviews", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.id);
      if (isNaN(equipmentId)) {
        return res.status(400).json({ error: "Invalid equipment ID" });
      }

      const reviews = await storage.getReviewsByEquipment(equipmentId);
      console.log(`Fetched ${reviews.length} reviews for equipment ${equipmentId}`);
      res.json(reviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({
        error: "Failed to fetch reviews",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const reviewData = {
        ...req.body,
        userId: req.user.id,
        createdAt: new Date()
      };

      // Validate review data
      const validationResult = reviewSchema.safeParse(reviewData);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Invalid review data",
          details: validationResult.error.errors
        });
      }

      // Find the booking for this equipment and user
      const bookings = await storage.listBookings(req.user.id);
      const validBooking = bookings.find(b =>
        b.equipmentId === reviewData.equipmentId &&
        b.status === 'paid' &&
        !b.isRated
      );

      if (!validBooking) {
        return res.status(400).json({
          error: "Invalid review submission",
          details: "You can only review equipment from paid, unrated bookings"
        });
      }

      // Create the review
      const newReview = await storage.createReview(validationResult.data);
      console.log(`Created new review for equipment ${reviewData.equipmentId} by user ${req.user.id}`);

      // Update the booking to mark it as rated
      await storage.updateBooking(validBooking.id, { isRated: true });
      console.log(`Updated booking ${validBooking.id} as rated`);

      res.json(newReview);
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(500).json({
        error: "Failed to create review",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      // If user is admin, they can see all bookings
      // Otherwise, users can only see their own bookings
      const bookings = req.user.isAdmin
        ? await storage.listBookings()
        : await storage.listBookings(req.user.id);

      // Map the bookings to include user information
      const bookingsWithUserInfo = await Promise.all(
        bookings.map(async (booking) => {
          // Only include user info if the viewer is an admin
          if (req.user.isAdmin && booking.userId !== req.user.id) {
            const bookingUser = await storage.getUser(booking.userId);
            return {
              ...booking,
              userInfo: bookingUser ? {
                username: bookingUser.username,
                name: bookingUser.name
              } : null
            };
          }
          return booking;
        })
      );

      res.json(bookingsWithUserInfo);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({
        error: 'Failed to fetch bookings',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/bookings/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const bookingId = parseInt(req.params.id);
      if (isNaN(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
      }

      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ error: "Not authorized" });
      }

      res.json({
        id: booking.id,
        status: booking.status,
        razorpayOrderId: booking.razorpayOrderId,
        totalPrice: booking.totalPrice,
        equipmentId: booking.equipmentId,
        startDate: booking.startDate,
        endDate: booking.endDate
      });
    } catch (error) {
      console.error('Error checking booking status:', error);
      res.status(500).json({ error: "Failed to check booking status" });
    }
  });


  // Booking status and receipt endpoints
  app.patch("/api/bookings/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || !req.user.isAdmin) return res.sendStatus(401);

    try {
      const bookingId = parseInt(req.params.id);
      if (isNaN(bookingId)) {
        return res.status(400).json({ error: "Invalid booking ID" });
      }

      const { status } = req.body;
      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updatedBooking = await storage.updateBookingStatus(bookingId, status);
      res.json(updatedBooking);
    } catch (error) {
      console.error('Error updating booking status:', error);
      res.status(500).json({ error: "Failed to update booking status" });
    }
  });

  // Add this new route after the existing booking routes
  app.get("/api/bookings/:id/payment-config", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getBooking(bookingId);

      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      if (booking.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to access this booking" });
      }

      const equipment = await storage.getEquipment(booking.equipmentId);
      if (!equipment) {
        return res.status(404).json({ error: "Equipment not found" });
      }

      const config = await createPaymentSession(bookingId, booking.totalPrice, equipment.name);
      res.json(config);
    } catch (error) {
      console.error('Error getting payment configuration:', error);
      res.status(500).json({
        error: "Failed to get payment configuration",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });


  // Booking details endpoint with authentication and authorization
  app.get("/api/bookings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.log('Unauthorized attempt to access booking:', req.params.id);
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const bookingId = parseInt(req.params.id);
      if (isNaN(bookingId)) {
        console.error('Invalid booking ID:', req.params.id);
        return res.status(400).json({ error: "Invalid booking ID" });
      }

      console.log(`Looking up booking ${bookingId} for user ${req.user.id}`);
      const booking = await storage.getBooking(bookingId);

      if (!booking) {
        console.log(`Booking ${bookingId} not found`);
        return res.status(404).json({ error: "Booking not found" });
      }

      // Check if the user has permission to view this booking
      if (booking.userId !== req.user.id && !req.user.isAdmin) {
        console.log(`User ${req.user.id} not authorized to view booking ${bookingId}`);
        return res.status(403).json({ error: "Not authorized to view this booking" });
      }

      console.log(`Successfully retrieved booking ${bookingId}`);
      res.json(booking);
    } catch (error) {
      console.error('Error getting booking:', error);
      res.status(500).json({ error: "Failed to get bookingdetails" });
    }
  });

  // Equipment comparison routes
  app.post("/api/comparisons/comparisons/add/:equipmentId", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {      return res.sendStatus(401);
    }

    try {
      const equipmentId = parseInt(req.params.equipmentId);
      await storage.addToComparison(req.user.id, equipmentId);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error adding to comparison:', error);
      res.status(500).json({ error: "Failed to add to comparison" });
    }
  });

  app.delete("/api/comparisons/remove/:equipmentId", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }

    try {
      const equipmentId = parseInt(req.params.equipmentId);
      await storage.removeFromComparison(req.user.id, equipmentId);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error removing from comparison:', error);
      res.status(500).json({ error: "Failed to remove from comparison" });
    }
  });

  app.get("/api/comparisons", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }

    try {
      const equipment = await storage.getComparison(req.user.id);
      res.json(equipment);
    } catch (error) {
      console.error('Error fetching comparison:', error);
      res.status(500).json({ error: "Failed to fetch comparison" });
    }
  });

  // Add recommendation routes
  app.get("/api/recommendations", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.sendStatus(401);
    }

    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get user's booking history
      const userBookings = await storage.listBookings(user.id);

      // Get all equipment
      const allEquipment = await storage.listEquipment();

      // Calculate recommendations based on user preferences and history
      const recommendations = allEquipment.map(equipment => {
        let score = 0;
        let reasons = [];

        // Category preference matching
        if (user.preferences.preferredCategories.includes(equipment.category)) {
          score += 30;
          reasons.push(`Matches your preferred category: ${equipment.category}`);
        }

        // Location preference matching
        if (user.preferences.preferredLocations.includes(equipment.location)) {
          score += 20;
          reasons.push(`Available in your preferred location: ${equipment.location}`);
        }

        // Price range matching
        if (equipment.dailyRate >= user.preferences.priceRange.min &&
            equipment.dailyRate <= user.preferences.priceRange.max) {
          score += 15;
          reasons.push('Within your preferred price range');
        }

        // Feature matching
        const matchingFeatures = equipment.features.filter(feature =>
          user.preferences.features.includes(feature)
        );
        if (matchingFeatures.length > 0) {
          score += 5 * matchingFeatures.length;
          reasons.push(`Has ${matchingFeatures.length} features you prefer`);
        }

        // Popularity bonus
        if (equipment.popularity > 0) {
          score += Math.min(10, equipment.popularity);
        }

        // Previous rental bonus
        if (userBookings.some(booking => booking.equipmentId === equipment.id)) {
          score += 10;
          reasons.push('You have rented this before');
        }

        return {
          equipment,
          score: Math.min(100, score), // Cap at 100%
          reason: reasons[0] || 'Recommended based on your preferences'
        };
      });

      // Sort by score and take top recommendations
      const topRecommendations = recommendations
        .filter(rec => rec.score > 30) // Only include items with decent match
        .sort((a, b) => b.score - a.score)
        .slice(0, 5); // Limit to top 5

      // Store recommendations
      await Promise.all(topRecommendations.map(async (rec) => {
        await storage.createRecommendation({
          userId: user.id,
          equipmentId: rec.equipment.id,
          score: rec.score,
          reason: rec.reason
        });
      }));

      res.json(topRecommendations);
    } catch (error) {
      console.error('Error generating recommendations:', error);
      res.status(500).json({
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return httpServer;
}

async function handleWebhookEvent(event: any): Promise<{ status: 'success' | 'failed'; bookingId: number; paymentId?: string } | null> {
  // This is a placeholder.  Replace with actual webhook event handling logic
  console.log("Webhook event received:", event);
  if (event.payload.payment.status === 'captured') {
    return { status: 'success', bookingId: event.payload.payment.order_id, paymentId: event.payload.payment.id };
  } else if (event.payload.payment.status === 'failed') {
    return { status: 'failed', bookingId: event.payload.payment.order_id };
  }
  return null;
}