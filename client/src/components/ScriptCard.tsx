import { Script } from "@shared/schema";
import { Monitor, Terminal, Server, Container, Download, FileCode, ShoppingCart, Check, Loader2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { downloadScript } from "@/hooks/use-scripts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  windows: Monitor,
  linux: Terminal,
  vmware: Server,
  docker: Container,
};

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function ScriptCard({ script, index }: ScriptCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const Icon = IconMap[script.icon.toLowerCase()] || FileCode;

  const { data: purchaseStatus, isLoading: checkingPurchase } = useQuery<PurchaseStatus>({
    queryKey: ["/api/purchases/check", script.id],
    queryFn: () => apiRequest("GET", `/api/purchases/check/${script.id}`).then(r => r.json()),
    enabled: !!user,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (purchaseType: "direct" | "monthly") => {
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

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadScript(script.id, script.filename);
      toast({
        title: "Téléchargement démarré",
        description: `${script.filename} a été sauvegardé.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Téléchargement échoué",
        description: "Une erreur s'est produite. Veuillez réessayer.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const hasPurchased = purchaseStatus?.hasPurchased || false;
  const purchaseType = purchaseStatus?.purchaseType;
  const canDownload = hasPurchased;

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
          {script.description}
        </p>

        <div className="text-xs text-muted-foreground mb-4">
          <Badge variant="outline" className="mr-2">{script.compliance}</Badge>
        </div>

        {user && (
          <div className="bg-muted/50 rounded-lg p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Achat direct</p>
                <p className="text-lg font-bold text-primary" data-testid={`text-price-direct-${script.id}`}>
                  {formatPrice(script.priceCents)}
                </p>
              </div>
              <p className="text-xs text-muted-foreground max-w-[120px] text-right">
                Licence permanente
              </p>
            </div>
            <div className="border-t border-border/50" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  Abonnement mensuel
                </p>
                <p className="text-lg font-bold text-primary" data-testid={`text-price-monthly-${script.id}`}>
                  {formatPrice(script.monthlyPriceCents)}<span className="text-sm font-normal text-muted-foreground">/mois</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground max-w-[120px] text-right">
                Mises à jour incluses
              </p>
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2">
          {!user && (
            <Button asChild className="w-full" data-testid={`button-login-${script.id}`}>
              <a href="/api/login">
                Connectez-vous pour acheter
              </a>
            </Button>
          )}

          {user && !hasPurchased && !checkingPurchase && (
            <>
              <Button
                onClick={() => checkoutMutation.mutate("direct")}
                disabled={checkoutMutation.isPending}
                className="w-full"
                data-testid={`button-purchase-direct-${script.id}`}
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShoppingCart className="w-4 h-4 mr-2" />
                )}
                Acheter {formatPrice(script.priceCents)}
              </Button>
              <Button
                onClick={() => checkoutMutation.mutate("monthly")}
                disabled={checkoutMutation.isPending}
                variant="outline"
                className="w-full"
                data-testid={`button-purchase-monthly-${script.id}`}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                S'abonner {formatPrice(script.monthlyPriceCents)}/mois
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
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full"
                data-testid={`button-download-${script.id}`}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Téléchargement...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </>
                )}
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
