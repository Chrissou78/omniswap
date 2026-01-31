// apps/web/src/app/api/payments/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Payment completed:', session.id);
        
        // Extract metadata
        const metadata = session.metadata || {};
        
        // TODO: Update your database based on metadata
        // For example, if metadata contains { type: 'ad_booking', bookingId: '123' }
        // you would mark that booking as paid
        
        if (metadata.type === 'ad_booking' && metadata.bookingId) {
          // await prisma.adBooking.update({ where: { id: metadata.bookingId }, data: { status: 'PAID' } });
          console.log('Ad booking paid:', metadata.bookingId);
        } else if (metadata.type === 'token_listing' && metadata.listingId) {
          // await prisma.tokenListing.update({ where: { id: metadata.listingId }, data: { status: 'PAID' } });
          console.log('Token listing paid:', metadata.listingId);
        }
        
        break;
      }
      
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Payment expired:', session.id);
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
