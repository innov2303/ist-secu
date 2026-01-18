import Stripe from 'stripe';

let connectionSettings: any;
let stripeAvailable: boolean | null = null;

async function getCredentialsFromEnv() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  
  if (secretKey && publishableKey) {
    return { secretKey, publishableKey };
  }
  return null;
}

async function getCredentialsFromReplit() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    return null;
  }

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  try {
    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set('include_secrets', 'true');
    url.searchParams.set('connector_names', connectorName);
    url.searchParams.set('environment', targetEnvironment);

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    });

    const data = await response.json();
    connectionSettings = data.items?.[0];

    if (!connectionSettings || (!connectionSettings.settings.publishable || !connectionSettings.settings.secret)) {
      return null;
    }

    return {
      publishableKey: connectionSettings.settings.publishable,
      secretKey: connectionSettings.settings.secret,
    };
  } catch (error) {
    console.log('Failed to get Stripe credentials from Replit connector:', error);
    return null;
  }
}

async function getCredentials() {
  // First try environment variables (for external VPS)
  const envCredentials = await getCredentialsFromEnv();
  if (envCredentials) {
    return envCredentials;
  }

  // Then try Replit connector
  const replitCredentials = await getCredentialsFromReplit();
  if (replitCredentials) {
    return replitCredentials;
  }

  return null;
}

export async function isStripeAvailable(): Promise<boolean> {
  if (stripeAvailable !== null) {
    return stripeAvailable;
  }
  
  const credentials = await getCredentials();
  stripeAvailable = credentials !== null;
  
  if (!stripeAvailable) {
    console.log('Stripe not configured - payment features disabled');
  }
  
  return stripeAvailable;
}

export async function getUncachableStripeClient(): Promise<Stripe | null> {
  const credentials = await getCredentials();
  if (!credentials) {
    return null;
  }
  return new Stripe(credentials.secretKey, {
    apiVersion: '2025-11-17.clover',
  });
}

export async function getStripePublishableKey(): Promise<string | null> {
  const credentials = await getCredentials();
  return credentials?.publishableKey || null;
}

export async function getStripeSecretKey(): Promise<string | null> {
  const credentials = await getCredentials();
  return credentials?.secretKey || null;
}

let stripeSync: any = null;

export async function getStripeSync() {
  const secretKey = await getStripeSecretKey();
  if (!secretKey) {
    return null;
  }

  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
