import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import { sendSubscriptionInvoiceEmail } from './email';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    
    const verifiedEvent = await sync.processWebhook(payload, signature);
    
    if (verifiedEvent && verifiedEvent.type) {
      try {
        await WebhookHandlers.handleStripeEvent(verifiedEvent);
      } catch (err: any) {
        console.error('Custom webhook handling error:', err.message);
      }
    }
  }

  static async handleStripeEvent(event: any): Promise<void> {
    console.log(`Processing Stripe event: ${event.type}`);
    
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          try {
            const stripe = await getUncachableStripeClient();
            if (!stripe) {
              console.error('Stripe client is null');
              break;
            }
            const subscriptionData = await stripe.subscriptions.retrieve(invoice.subscription as string) as any;
            const expiresAt = new Date(subscriptionData.current_period_end * 1000);
            
            await storage.updatePurchaseSubscription(invoice.subscription as string, expiresAt);
            console.log(`Updated subscription ${invoice.subscription} expires at ${expiresAt}`);
            
            // Send invoice email to customer
            const customerEmail = invoice.customer_email || invoice.customer_details?.email;
            const customerName = invoice.customer_name || invoice.customer_details?.name || 'Client';
            
            if (customerEmail) {
              // Get product name from line items
              let productName = 'Abonnement Infra Shield Tools';
              if (invoice.lines?.data?.length > 0) {
                const lineItem = invoice.lines.data[0];
                productName = lineItem.description || lineItem.price?.product?.name || productName;
              }
              
              const periodStart = new Date(subscriptionData.current_period_start * 1000);
              const periodEnd = new Date(subscriptionData.current_period_end * 1000);
              
              await sendSubscriptionInvoiceEmail({
                customerEmail,
                customerName,
                productName,
                amountCents: invoice.amount_paid,
                periodStart,
                periodEnd,
                stripeInvoiceId: invoice.id
              });
              console.log(`Invoice email sent to ${customerEmail} for invoice ${invoice.id}`);
            }
          } catch (err: any) {
            console.error('Error updating subscription from invoice.paid:', err.message);
          }
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const expiresAt = subscription.status === 'active' 
          ? new Date(subscription.current_period_end * 1000)
          : null;
        
        try {
          await storage.updatePurchaseSubscription(subscription.id, expiresAt);
          console.log(`Subscription ${subscription.id} updated, status: ${subscription.status}`);
        } catch (err: any) {
          console.error('Error updating subscription:', err.message);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        try {
          await storage.updatePurchaseSubscription(subscription.id, new Date());
          console.log(`Subscription ${subscription.id} cancelled`);
        } catch (err: any) {
          console.error('Error cancelling subscription:', err.message);
        }
        break;
      }
    }
  }
}
