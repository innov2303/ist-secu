import { useState } from "react";
import { Script } from "@shared/schema";
import { Monitor, Server, Container, Download, FileCode, Check, Loader2, RefreshCw, ShoppingBag, AlertTriangle, Wrench, Globe, Calendar } from "lucide-react";
import { SiLinux, SiNetapp } from "react-icons/si";
import { FaWindows } from "react-icons/fa";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

function cleanDescription(description: string): string {
  // Remove "[Controles ajoutes...]" section from the description
  const controlsIndex = description.indexOf("[Controles ajoutes");
  if (controlsIndex !== -1) {
    return description.substring(0, controlsIndex).trim();
  }
  return description;
}

function extractBaseControlCount(description: string): number {
  // Extract the highest control count from description (this is the total for the bundle)
  // Look for patterns like "~215 contrôles total" or the largest "~XXX contrôles" number
  const regex = /~(\d+)\s*contr[oô]les/gi;
  let maxCount = 0;
  let match;
  while ((match = regex.exec(description)) !== null) {
    const count = parseInt(match[1]);
    if (count > maxCount) {
      maxCount = count;
    }
  }
  return maxCount;
}

function updateControlCountInDescription(description: string, totalCount: number, _dynamicCount: number): string {
  // Only update the largest control count (the bundle total), not the individual script counts
  // Find all control count patterns and only update the largest one
  const regex = /~(\d+)(\s*contr[oô]les)/gi;
  const matches: Array<{ full: string; count: number; suffix: string; index: number }> = [];
  let match;
  while ((match = regex.exec(description)) !== null) {
    matches.push({
      full: match[0],
      count: parseInt(match[1]),
      suffix: match[2],
      index: match.index
    });
  }
  
  if (matches.length === 0) return description;
  
  // Find the match with the highest count
  let maxMatch = matches[0];
  for (const m of matches) {
    if (m.count > maxMatch.count) {
      maxMatch = m;
    }
  }
  
  // Replace only the largest count with the updated total
  const updatedPattern = `~${totalCount}${maxMatch.suffix}`;
  return description.replace(maxMatch.full, updatedPattern);
}

type ScriptStatus = "active" | "offline" | "maintenance";

interface ScriptCardProps {
  script: Script;
  index: number;
}

interface PurchaseStatus {
  hasPurchased: boolean;
  purchaseType: string | null;
  expiresAt: string | null;
}

const IconMap: Record<string, any> = {
  windows: FaWindows,
  monitor: FaWindows,
  linux: SiLinux,
  terminal: SiLinux,
  vmware: Server,
  server: Server,
  docker: Container,
  container: Container,
  sinetapp: SiNetapp,
  netapp: SiNetapp,
  globe: Globe,
  web: Globe,
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function ScriptCard({ script, index }: ScriptCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const Icon = IconMap[script.icon.toLowerCase()] || FileCode;

  // Calculate yearly price with 15% discount
  const yearlyPriceCents = Math.round(script.monthlyPriceCents * 12 * 0.85);
  const monthlyEquivalent = Math.round(yearlyPriceCents / 12);
  const savingsPercent = 15;

  const { data: purchaseStatus, isLoading: checkingPurchase } = useQuery<PurchaseStatus>({
    queryKey: ["/api/purchases/check", script.id],
    queryFn: () => apiRequest("GET", `/api/purchases/check/${script.id}`).then(r => r.json()),
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (purchaseType: "direct" | "monthly" | "yearly") => {
      const response = await apiRequest("POST", "/api/checkout", { scriptId: script.id, purchaseType });
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
        description: "Impossible de créer la session de paiement. Veuillez réessayer.",
      });
    },
  });

  // Fetch dynamic controls count for all scripts
  const { data: controlsCounts } = useQuery<Record<number, number>>({
    queryKey: ["/api/scripts/controls-count"],
    queryFn: () => apiRequest("GET", "/api/scripts/controls-count").then(r => r.json()),
    staleTime: 60000, // Cache for 1 minute
  });

  const hasPurchased = purchaseStatus?.hasPurchased || false;
  const purchaseType = purchaseStatus?.purchaseType;
  const isAdmin = user?.isAdmin || false;
  const isInDevelopment = script.description.includes("En développement");
  const status = (script.status as ScriptStatus) || "active";
  const isOffline = status === "offline";
  const isMaintenance = status === "maintenance";
  const canPurchase = !isOffline; // Allow subscriptions during maintenance, only block when offline
  const canDownload = !isMaintenance && !isOffline;

  // Calculate total controls: base count + dynamic controls
  const baseControlCount = extractBaseControlCount(script.description);
  const dynamicControlCount = controlsCounts?.[script.id] || 0;
  const totalControlCount = baseControlCount + dynamicControlCount;
  
  // Clean description and update control count
  let displayDescription = cleanDescription(script.description);
  if (dynamicControlCount > 0) {
    displayDescription = updateControlCountInDescription(displayDescription, totalControlCount, dynamicControlCount);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group relative bg-card border border-border/50 hover:border-primary/50 rounded-xl overflow-hidden transition-colors duration-300"
      data-testid={`card-script-${script.id}`}
    >
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="p-6 relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between mb-4 gap-2">
          <div className="p-3 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300 group-hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)]">
            <Icon className="w-8 h-8" />
          </div>
          <div className="px-2.5 py-1 rounded bg-secondary text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {script.os}
          </div>
        </div>

        <h3 className="text-xl font-bold mb-2 font-mono group-hover:text-primary transition-colors">
          {script.name}
        </h3>
        
        <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-grow whitespace-pre-line">
          {displayDescription}
        </p>

        {isInDevelopment && (
          <div className="text-xs text-muted-foreground mb-4">
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">En développement</Badge>
          </div>
        )}

        {isMaintenance && !isInDevelopment && (
          <div className="text-xs text-muted-foreground mb-4">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              <Wrench className="w-3 h-3 mr-1" />
              En maintenance
            </Badge>
          </div>
        )}


        {user && !isInDevelopment && !isAdmin && canPurchase && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                  billingCycle === "monthly"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
                data-testid={`button-billing-monthly-${script.id}`}
              >
                Mensuel
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`flex-1 py-1.5 px-3 rounded text-xs font-medium transition-colors ${
                  billingCycle === "yearly"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
                data-testid={`button-billing-yearly-${script.id}`}
              >
                Annuel -{savingsPercent}%
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {billingCycle === "monthly" ? (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Abonnement mensuel
                    </>
                  ) : (
                    <>
                      <Calendar className="w-3 h-3" />
                      Security Pack annuel
                    </>
                  )}
                </p>
                <p className="text-lg font-bold text-primary" data-testid={`text-price-${billingCycle}-${script.id}`}>
                  {billingCycle === "monthly" ? (
                    <>
                      {formatPrice(script.monthlyPriceCents)}<span className="text-sm font-normal text-muted-foreground">/mois</span>
                    </>
                  ) : (
                    <>
                      {formatPrice(yearlyPriceCents)}<span className="text-sm font-normal text-muted-foreground">/an</span>
                    </>
                  )}
                </p>
                {billingCycle === "yearly" && (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    soit {formatPrice(monthlyEquivalent)}/mois
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-[120px] text-right">
                {billingCycle === "yearly" ? "Economisez " + savingsPercent + "%" : "Mise a jour et support inclus"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2">
          {!user && (
            <Button asChild className="w-full" data-testid={`button-login-${script.id}`}>
              <a href="/auth">
                Connectez-vous pour acheter
              </a>
            </Button>
          )}

          {user && !hasPurchased && !isAdmin && !checkingPurchase && !isInDevelopment && canPurchase && (
            <Button
              onClick={() => checkoutMutation.mutate(billingCycle)}
              disabled={checkoutMutation.isPending}
              className="w-full"
              data-testid={`button-purchase-${billingCycle}-${script.id}`}
            >
              {checkoutMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : billingCycle === "yearly" ? (
                <Calendar className="w-4 h-4 mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {billingCycle === "yearly" ? "S'abonner - Security Pack" : "S'abonner"}
            </Button>
          )}


          {isInDevelopment && (
            <div className="text-center py-3 text-sm text-muted-foreground">
              Disponible prochainement
            </div>
          )}

          {isMaintenance && !isInDevelopment && hasPurchased && (
            <div className="text-center py-3 text-sm text-orange-600 dark:text-orange-400">
              <Wrench className="w-4 h-4 inline mr-2" />
              Téléchargement temporairement indisponible
            </div>
          )}

          {isAdmin && !hasPurchased && !isInDevelopment && (
            <>
              <div className="flex items-center justify-center gap-2 text-sm text-primary py-2">
                <Check className="w-4 h-4" />
                <span>Accès Admin</span>
              </div>
              <Button
                asChild
                className="w-full"
                data-testid={`button-goto-products-${script.id}`}
              >
                <Link href="/purchases">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Mes Produits
                </Link>
              </Button>
            </>
          )}

          {hasPurchased && (
            <>
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 py-2">
                <Check className="w-4 h-4" />
                <span>
                  {purchaseType === "direct" ? "Achat permanent" : "Abonnement actif"}
                </span>
              </div>
              <Button
                asChild
                className="w-full"
                data-testid={`button-goto-products-${script.id}`}
              >
                <Link href="/purchases">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Mes Produits
                </Link>
              </Button>
            </>
          )}

          {checkingPurchase && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
          
          <div className="text-center pt-2">
            <code className="text-[10px] text-muted-foreground/60 font-mono">
              SHA-256 Verified
            </code>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
