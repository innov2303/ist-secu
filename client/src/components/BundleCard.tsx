import { AnnualBundle, Script } from "@shared/schema";
import { Shield, ShieldCheck, Check, Loader2, Package } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Link } from "wouter";

interface BundleCardProps {
  bundle: AnnualBundle;
  scripts: Script[];
  index: number;
}

const IconMap: Record<string, any> = {
  shield: Shield,
  shieldcheck: ShieldCheck,
  package: Package,
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function BundleCard({ bundle, scripts, index }: BundleCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const Icon = IconMap[bundle.icon.toLowerCase()] || Shield;

  // Get included scripts
  const includedScripts = scripts.filter(s => bundle.includedScriptIds.includes(s.id));
  
  // Calculate prices HT (excluding 20% VAT)
  const totalMonthlyPrice = includedScripts.reduce((sum, s) => sum + s.monthlyPriceCents, 0);
  const annualPrice = totalMonthlyPrice * 12;
  const discountedPrice = Math.round(annualPrice * (1 - bundle.discountPercent / 100));
  const savings = annualPrice - discountedPrice;
  const monthlyEquivalent = Math.round(discountedPrice / 12);
  
  // HT prices (divide by 1.20 to remove 20% VAT)
  const annualPriceHT = Math.round(annualPrice / 1.20);
  const discountedPriceHT = Math.round(discountedPrice / 1.20);
  const savingsHT = Math.round(savings / 1.20);
  const monthlyEquivalentHT = Math.round(monthlyEquivalent / 1.20);
  const scriptMonthlyPriceHT = (cents: number) => Math.round(cents / 1.20);

  // Check if user has all included scripts
  const purchaseChecks = useQuery<Record<number, boolean>>({
    queryKey: ["/api/purchases/check-multiple", bundle.includedScriptIds],
    queryFn: async () => {
      const results: Record<number, boolean> = {};
      for (const scriptId of bundle.includedScriptIds) {
        const res = await apiRequest("GET", `/api/purchases/check/${scriptId}`);
        const data = await res.json();
        results[scriptId] = data.hasPurchased;
      }
      return results;
    },
    enabled: !!user && bundle.includedScriptIds.length > 0,
  });

  const hasAllScripts = purchaseChecks.data 
    ? Object.values(purchaseChecks.data).every(v => v) 
    : false;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/checkout/bundle", { bundleId: bundle.id });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de creer la session de paiement. Veuillez reessayer.",
      });
    },
  });

  const handlePurchase = () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Connexion requise",
        description: "Veuillez vous connecter pour effectuer un achat.",
      });
      return;
    }
    checkoutMutation.mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="h-full flex flex-col overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold" data-testid={`bundle-title-${bundle.id}`}>
                  {bundle.name}
                </h3>
                <Badge variant="secondary" className="mt-1">
                  -{bundle.discountPercent}% annuel
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          <p className="text-sm text-muted-foreground" data-testid={`bundle-description-${bundle.id}`}>
            {bundle.description}
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">Toolkits inclus:</p>
            <ul className="space-y-1">
              {includedScripts.map(script => (
                <li key={script.id} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{script.name}</span>
                  <span className="text-muted-foreground">({formatPrice(scriptMonthlyPriceHT(script.monthlyPriceCents))} HT/mois)</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Prix normal:</span>
              <span className="text-sm line-through text-muted-foreground">{formatPrice(annualPriceHT)} HT/an</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-medium">Votre prix:</span>
              <span className="text-2xl font-bold text-primary">{formatPrice(discountedPriceHT)} HT/an</span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Soit:</span>
              <span className="text-muted-foreground">{formatPrice(monthlyEquivalentHT)} HT/mois</span>
            </div>
            <div className="flex items-center justify-end gap-1 text-green-600">
              <span className="text-sm font-medium">Economie: {formatPrice(savingsHT)} HT</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-4 border-t">
          {hasAllScripts ? (
            <div className="w-full flex items-center justify-center gap-2 py-2 text-green-600">
              <Check className="w-5 h-5" />
              <span className="font-medium">Deja achete</span>
            </div>
          ) : user ? (
            <Button
              className="w-full"
              onClick={handlePurchase}
              disabled={checkoutMutation.isPending}
              data-testid={`bundle-purchase-${bundle.id}`}
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Chargement...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Souscrire au pack
                </>
              )}
            </Button>
          ) : (
            <Link href="/login" className="w-full">
              <Button className="w-full" variant="outline" data-testid={`bundle-login-${bundle.id}`}>
                Se connecter pour acheter
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
