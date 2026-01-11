import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";
import logoImg from "@assets/generated_images/white_igs_logo_black_bg.png";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
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
              <img src={logoImg} alt="IGS Logo" className="w-24 h-24 md:w-32 md:h-32 drop-shadow-lg mix-blend-screen cursor-pointer" />
            </Link>
            <h1 className="text-xl md:text-2xl tracking-wider text-white drop-shadow-lg" style={{ fontFamily: "'Oxanium', sans-serif" }}>InfraGuard Security</h1>
          </div>
          <Button variant="outline" size="sm" asChild className="bg-background/20 backdrop-blur border-white/30 text-white hover:bg-background/40" data-testid="button-back-home">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Politique de Confidentialité</h1>
        
        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Collecte des données</h2>
            <p className="text-muted-foreground">
              InfraGuard Security collecte uniquement les données nécessaires au fonctionnement du service :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Informations de compte (email, nom)</li>
              <li>Données de paiement (traitées par Stripe)</li>
              <li>Historique des achats et téléchargements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Utilisation des données</h2>
            <p className="text-muted-foreground">
              Vos données sont utilisées exclusivement pour :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Gérer votre compte et vos abonnements</li>
              <li>Traiter vos paiements de manière sécurisée</li>
              <li>Vous fournir l'accès aux scripts achetés</li>
              <li>Vous contacter pour des informations relatives à votre compte</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Protection des données</h2>
            <p className="text-muted-foreground">
              Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données personnelles contre tout accès non autorisé, modification, divulgation ou destruction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Partage des données</h2>
            <p className="text-muted-foreground">
              Nous ne vendons ni ne partageons vos données personnelles avec des tiers, à l'exception de :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Stripe pour le traitement des paiements</li>
              <li>Obligations légales si requises par la loi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Cookies</h2>
            <p className="text-muted-foreground">
              Nous utilisons des cookies essentiels pour maintenir votre session de connexion. Aucun cookie de tracking ou publicitaire n'est utilisé.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Vos droits</h2>
            <p className="text-muted-foreground">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-1">
              <li>Droit d'accès à vos données</li>
              <li>Droit de rectification</li>
              <li>Droit à l'effacement</li>
              <li>Droit à la portabilité</li>
              <li>Droit d'opposition</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Contact</h2>
            <p className="text-muted-foreground">
              Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, contactez-nous via la section Support.
            </p>
          </section>

          <p className="text-xs text-muted-foreground mt-8 pt-4 border-t">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  );
}
