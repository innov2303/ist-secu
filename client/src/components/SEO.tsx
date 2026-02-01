import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
}

const SITE_NAME = 'Infra Shield Tools';
const DEFAULT_DESCRIPTION = 'Security audit scripts for Windows, Linux, VMware ESXi, Containers and Web. ANSSI, CIS Benchmark compliance. Detailed HTML/JSON reports.';
const DEFAULT_IMAGE = '/og-image.png';
const BASE_URL = 'https://ist-secu.com';

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = 'cybersecurity, security audit, ANSSI, CIS Benchmark, Windows, Linux, VMware, Docker, compliance, hardening',
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const fullUrl = url ? `${BASE_URL}${url}` : BASE_URL;
  const fullImage = image.startsWith('http') ? image : `${BASE_URL}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <link rel="canonical" href={fullUrl} />
      
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
    </Helmet>
  );
}

export function ProductSchema({ 
  name, 
  description, 
  price, 
  currency = 'USD' 
}: { 
  name: string; 
  description: string; 
  price: number; 
  currency?: string; 
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    offers: {
      '@type': 'Offer',
      price: price / 100,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
    },
    brand: {
      '@type': 'Brand',
      name: 'Infra Shield Tools',
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}

export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Infra Shield Tools',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: DEFAULT_DESCRIPTION,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'contact@ist-secu.com',
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
