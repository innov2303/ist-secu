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
      description: 'Audit complet basé sur les guides ANSSI et benchmarks CIS pour environnements Windows. Mise à jour et support inclus.',
      metadata: { os: 'Windows', compliance: 'ANSSI & CIS' },
      monthlyPriceCents: 30000,
    },
    {
      name: 'Linux Compliance Toolkit',
      description: 'Pack complet d\'audit de conformité Linux basé sur les recommandations ANSSI-BP-028 et CIS Benchmark. Inclut les versions Base (~55 contrôles) et Renforcée (~100 contrôles).\n\nCompatible Debian/Ubuntu, Red Hat/CentOS, Fedora, SUSE. Fonctionnement limité sur les distributions non listées. Mise à jour et support inclus.',
      metadata: { os: 'Linux', compliance: 'ANSSI-BP-028 + CIS Benchmark' },
      monthlyPriceCents: 30000,
    },
    {
      name: 'ESXi Host Validator',
      description: 'Contrôle de sécurité pour hôtes ESXi selon les recommandations CIS. Mise à jour et support inclus.',
      metadata: { os: 'VMware', compliance: 'CIS' },
      monthlyPriceCents: 40000,
    },
    {
      name: 'Container Security Scanner',
      description: 'Scan de configuration Docker selon le benchmark CIS. En développement.',
      metadata: { os: 'Docker', compliance: 'CIS' },
      monthlyPriceCents: 30000,
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

    // Create recurring price (subscription only)
    const recurringPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: script.monthlyPriceCents,
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { type: 'monthly' },
    });
    console.log(`  - Monthly subscription: ${recurringPrice.id} (${script.monthlyPriceCents / 100}€/month)`);
  }

  console.log('Done creating products!');
}

createProducts().catch(console.error);
