import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { SEO } from "@/components/SEO";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/ist_logo_white.png";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Privacy Policy"
        description="Infra Shield Tools Privacy Policy. Discover how we collect, use and protect your personal data."
        url="/privacy"
      />
      {/* Header with logo */}
      <div className="relative h-32 md:h-40 w-full overflow-hidden">
        <img 
          src={bannerImg} 
          alt="Security Infrastructure" 
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img src={logoImg} alt="IST Logo" className="w-24 h-24 md:w-32 md:h-32 drop-shadow-lg mix-blend-screen cursor-pointer" />
            </Link>
            <h1 className="text-xl md:text-2xl tracking-wider text-white drop-shadow-lg" style={{ fontFamily: "'Oxanium', sans-serif" }}>Infra Shield Tools</h1>
          </div>
          <Button variant="outline" size="sm" asChild className="bg-background/20 backdrop-blur border-white/30 text-white hover:bg-background/40" data-testid="button-back-home">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Data Collection</h2>
            <p className="text-muted-foreground">
              Infra Shield Tools collects only the data necessary for the service to function:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Account information (email, name)</li>
              <li>Payment data (processed by Stripe)</li>
              <li>Purchase and download history</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Data Usage</h2>
            <p className="text-muted-foreground">
              Your data is used exclusively for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Managing your account and subscriptions</li>
              <li>Processing your payments securely</li>
              <li>Providing you access to purchased scripts</li>
              <li>Contacting you with information related to your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Data Protection</h2>
            <p className="text-muted-foreground">
              We implement appropriate security measures to protect your personal data against unauthorized access, modification, disclosure or destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
            <p className="text-muted-foreground">
              We do not sell or share your personal data with third parties, except for:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Stripe for payment processing</li>
              <li>Legal obligations if required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Cookies</h2>
            <p className="text-muted-foreground">
              We use essential cookies to maintain your login session. No tracking or advertising cookies are used.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground">
              In accordance with GDPR, you have the following rights:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Right of access to your data</li>
              <li>Right of rectification</li>
              <li>Right to erasure</li>
              <li>Right to data portability</li>
              <li>Right to object</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Contact</h2>
            <p className="text-muted-foreground">
              For any questions about this privacy policy or to exercise your rights, please contact us through the Support section.
            </p>
          </section>

          <p className="text-xs text-muted-foreground mt-8 pt-4 border-t">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
