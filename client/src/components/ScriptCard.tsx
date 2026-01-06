import { Script } from "@shared/schema";
import { Monitor, Terminal, Server, Container, Download, FileCode, ShoppingCart, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { downloadScript } from "@/hooks/use-scripts";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

interface ScriptCardProps {
  script: Script;
  index: number;
}

const IconMap: Record<string, any> = {
  windows: Monitor,
  linux: Terminal,
  vmware: Server,
  docker: Container,
};

function formatPrice(cents: number) {
  if (cents === 0) return "Gratuit";
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

  const { data: purchaseStatus, isLoading: checkingPurchase } = useQuery<{ hasPurchased: boolean }>({
    queryKey: ["/api/purchases/check", script.id],
    queryFn: () => apiRequest("GET", `/api/purchases/check/${script.id}`).then(r => r.json()),
    enabled: !!user,
  });

  const purchaseMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/purchases", { scriptId: script.id }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchases/check", script.id] });
      toast({
        title: "Achat réussi",
        description: `${script.name} a été ajouté à vos achats.`,
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur d'achat",
        description: "Une erreur s'est produite. Veuillez réessayer.",
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
  const isFree = script.priceCents === 0;
  const canDownload = !user || isFree || hasPurchased;

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
        <div className="flex items-start justify-between mb-6 gap-2">
          <div className="p-3 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300 group-hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)]">
            <Icon className="w-8 h-8" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="px-2.5 py-1 rounded bg-secondary text-xs font-mono text-muted-foreground uppercase tracking-wider">
              {script.os}
            </div>
            <div className="text-lg font-bold text-primary" data-testid={`text-price-${script.id}`}>
              {formatPrice(script.priceCents)}
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold mb-2 font-mono group-hover:text-primary transition-colors">
          {script.name}
        </h3>
        
        <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-grow">
          {script.description}
        </p>

        <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
          <span className="font-semibold text-primary">{script.compliance}</span>
        </div>

        <div className="mt-auto pt-4 border-t border-border/50 space-y-3">
          {user && !isFree && !hasPurchased && (
            <Button
              onClick={() => purchaseMutation.mutate()}
              disabled={purchaseMutation.isPending || checkingPurchase}
              className="w-full"
              data-testid={`button-purchase-${script.id}`}
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Achat en cours...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Acheter
                </>
              )}
            </Button>
          )}

          {hasPurchased && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 mb-2">
              <Check className="w-4 h-4" />
              <span>Acheté</span>
            </div>
          )}

          <Button
            onClick={canDownload ? handleDownload : undefined}
            disabled={isDownloading || (!canDownload)}
            variant={canDownload ? "default" : "secondary"}
            className="w-full"
            data-testid={`button-download-${script.id}`}
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Téléchargement...
              </>
            ) : canDownload ? (
              <>
                <Download className="w-4 h-4 mr-2" />
                Télécharger
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Achetez pour télécharger
              </>
            )}
          </Button>
          
          <div className="text-center">
            <code className="text-[10px] text-muted-foreground/60 font-mono">
              SHA-256 Verified
            </code>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
