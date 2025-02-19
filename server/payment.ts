import Razorpay from 'razorpay';
import crypto from 'crypto';

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required');
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export async function createPaymentSession(bookingId: number, amount: number, equipmentName: string) {
  try {
    console.log('Creating payment session for booking:', bookingId, 'amount:', amount);

    // Validate amount
    if (amount <= 0) {
      throw new Error('Invalid amount. Amount must be greater than 0');
    }

    // Convert amount to paise (1 INR = 100 paise)
    const amountInPaise = Math.floor(amount * 100);
    console.log('Amount in paise:', amountInPaise);

    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `booking_${bookingId}`,
      notes: {
        bookingId: bookingId.toString(),
        equipmentName,
      },
    };
    console.log('Creating Razorpay order with options:', orderOptions);

    const order = await razorpay.orders.create(orderOptions);
    console.log('Razorpay order created:', order);

    if (!order?.id) {
      throw new Error('Failed to create Razorpay order');
    }

    // Return configuration for frontend
    const config = {
      id: order.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: amountInPaise,
      currency: 'INR',
      name: "AgriRent Equipment",
      description: `Booking for ${equipmentName}`,
      prefill: {
        name: '',  // Will be filled by frontend
        email: '', // Will be filled by frontend
        contact: ''// Will be filled by frontend
      }
    };
    console.log('Returning payment configuration:', { ...config, keyId: '***' });
    return config;
  } catch (error) {
    console.error('Error creating payment session:', error);
    throw error;
  }
}

export async function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): Promise<boolean> {
  try {
    const text = orderId + "|" + paymentId;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(text)
      .digest("hex");

    return expectedSignature === signature;
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return false;
  }
}

interface RazorpayPayment {
  status: string;
  amount: number;
  currency: string;
  created_at: number;
  method: string;
}

export async function generateReceipt(bookingId: number, paymentId: string) {
  try {
    // Get payment details from Razorpay
    const payment = await razorpay.payments.fetch(paymentId) as RazorpayPayment;

    return {
      bookingId,
      paymentId,
      status: payment.status,
      amount: Number(payment.amount) / 100, // Convert paise to rupees
      currency: payment.currency,
      timestamp: new Date(payment.created_at * 1000).toISOString(),
      method: payment.method,
      receipt_url: null // Razorpay doesn't provide a receipt URL by default
    };
  } catch (error) {
    console.error('Error generating receipt:', error);
    throw new Error('Failed to generate receipt');
  }
}

interface WebhookSuccessResult {
  status: 'success';
  bookingId: number;
  orderId: string;
  paymentId: string;
}

interface WebhookFailureResult {
  status: 'failed';
  bookingId: number;
  error: string;
}

type WebhookResult = WebhookSuccessResult | WebhookFailureResult | null;

export async function handleWebhookEvent(event: any): Promise<WebhookResult> {
  try {
    switch (event.event) {
      case 'payment.captured':
        // Payment successful
        const { order_id, id: payment_id } = event.payload.payment.entity;
        const bookingId = parseInt(event.payload.payment.entity.notes.bookingId);

        if (!bookingId) {
          throw new Error('Booking ID not found in payment notes');
        }

        return {
          status: 'success',
          bookingId,
          orderId: order_id,
          paymentId: payment_id
        };

      case 'payment.failed':
        // Payment failed
        return {
          status: 'failed',
          bookingId: parseInt(event.payload.payment.entity.notes.bookingId),
          error: event.payload.payment.entity.error_description
        };

      default:
        // Unhandled event
        console.log('Unhandled webhook event:', event.event);
        return null;
    }
  } catch (error) {
    console.error('Error handling webhook event:', error);
    throw error;
  }
}