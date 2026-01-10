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
      priceCents: 50000,
      monthlyPriceCents: 10000,
    },
    {
      name: 'Linux Security Toolkit ANSSI',
      description: 'Pack complet d\'audit de sécurité Linux incluant les versions Base (~55 contrôles ANSSI + CIS L1) et Renforcée (~100 contrôles ANSSI + CIS L2).',
      metadata: { os: 'Linux', compliance: 'ANSSI-BP-028 + CIS L1/L2' },
      priceCents: 80000,
      monthlyPriceCents: 15000,
    },
    {
      name: 'ESXi Host Validator',
      description: 'Contrôle de sécurité pour hôtes ESXi selon les recommandations CIS.',
      metadata: { os: 'VMware', compliance: 'CIS' },
      priceCents: 50000,
      monthlyPriceCents: 10000,
    },
    {
      name: 'Container Security Scanner',
      description: 'Scan de configuration Docker selon le benchmark CIS.',
      metadata: { os: 'Docker', compliance: 'CIS' },
      priceCents: 50000,
      monthlyPriceCents: 10000,
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

    // Create one-time price
    const oneTimePrice = await stripe.prices.create({
      product: product.id,
      unit_amount: script.priceCents,
      currency: 'eur',
      metadata: { type: 'direct' },
    });
    console.log(`  - One-time price: ${oneTimePrice.id} (${script.priceCents / 100}€)`);

    // Create recurring price
    const recurringPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: script.monthlyPriceCents,
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { type: 'monthly' },
    });
    console.log(`  - Recurring price: ${recurringPrice.id} (${script.monthlyPriceCents / 100}€/month)`);
  }

  console.log('Done creating products!');
}

createProducts().catch(console.error);
