import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  console.log('Creating InfraGuard Security products in Stripe...');

  // Check if products already exist
  const existingProducts = await stripe.products.list({ limit: 10 });
  const existingNames = existingProducts.data.map(p => p.name);

  const scriptsToCreate = [
    {
      name: 'Windows Security Audit',
      description: 'Audit complet basé sur les guides ANSSI et benchmarks CIS pour environnements Windows.',
      metadata: { os: 'Windows', compliance: 'ANSSI & CIS' },
    },
    {
      name: 'Linux Hardening Check',
      description: 'Vérification de la conformité ANSSI (BP-028) et CIS pour serveurs Linux.',
      metadata: { os: 'Linux', compliance: 'ANSSI & CIS' },
    },
    {
      name: 'ESXi Host Validator',
      description: 'Contrôle de sécurité pour hôtes ESXi selon les recommandations CIS.',
      metadata: { os: 'VMware', compliance: 'CIS' },
    },
    {
      name: 'Container Security Scanner',
      description: 'Scan de configuration Docker selon le benchmark CIS.',
      metadata: { os: 'Docker', compliance: 'CIS' },
    },
  ];

  for (const script of scriptsToCreate) {
    if (existingNames.includes(script.name)) {
      console.log(`Product "${script.name}" already exists, skipping...`);
      continue;
    }

    // Create product
    const product = await stripe.products.create({
      name: script.name,
      description: script.description,
      metadata: script.metadata,
    });

    console.log(`Created product: ${product.name} (${product.id})`);

    // Create one-time price (500€)
    const oneTimePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 50000,
      currency: 'eur',
      metadata: { type: 'direct' },
    });
    console.log(`  - One-time price: ${oneTimePrice.id} (500€)`);

    // Create recurring price (100€/month)
    const recurringPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 10000,
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { type: 'monthly' },
    });
    console.log(`  - Recurring price: ${recurringPrice.id} (100€/month)`);
  }

  console.log('Done creating products!');
}

createProducts().catch(console.error);
