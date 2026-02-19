import { useState } from "react";
import { Script } from "@shared/schema";
import { Monitor, Server, Container, Download, FileCode, Check, Loader2, RefreshCw, ShoppingBag, AlertTriangle, Wrench, Globe, Calendar, Clock, Info, ShieldCheck, Cpu } from "lucide-react";
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

type ScriptStatus = "active" | "offline" | "maintenance" | "development";

interface ScriptCardProps {
  script: Script;
  index: number;
  lockedByCompletePack?: boolean;
  hideMaintenanceBadge?: boolean;
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function ScriptCard({ script, index, lockedByCompletePack = false, hideMaintenanceBadge = false }: ScriptCardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const Icon = IconMap[script.icon.toLowerCase()] || FileCode;

  // Calculate yearly price with 15% discount (prices are already HT)
  const yearlyPriceCents = Math.round(script.monthlyPriceCents * 12 * 0.85);
  const monthlySavings = (script.monthlyPriceCents * 12) - yearlyPriceCents;

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
        title: "Error",
        description: "Unable to create payment session. Please try again.",
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
  const status = (script.status as ScriptStatus) || "active";
  const isInDevelopment = status === "development";
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
      
      <div className="p-4 relative z-10 flex flex-col h-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:ring-primary/50 transition-all duration-300 group-hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.3)]">
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold font-mono group-hover:text-primary transition-colors truncate">
              {script.name}
            </h3>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{script.os}</span>
          </div>
        </div>
        
        <div className="text-xs mb-3 flex-grow space-y-2">
          {(() => {
            const parts = displayDescription.split(/\n\n+/);
            const descPart = parts[0] || "";
            const standardsPart = parts.find(p => p.toLowerCase().startsWith("standards"));
            const compatPart = parts.find(p => p.toLowerCase().startsWith("compatible"));
            return (
              <>
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-blue-400 text-[10px] uppercase tracking-wide">Description</span>
                    <p className="text-muted-foreground leading-relaxed">{descPart}</p>
                  </div>
                </div>
                {standardsPart && (
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-emerald-400 text-[10px] uppercase tracking-wide">Standards</span>
                      <p className="text-muted-foreground leading-relaxed">{standardsPart.replace(/^Standards:\s*/i, "")}</p>
                    </div>
                  </div>
                )}
                {compatPart && (
                  <div className="flex items-start gap-2">
                    <Cpu className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-violet-400 text-[10px] uppercase tracking-wide">Compatibility</span>
                      <p className="text-muted-foreground leading-relaxed">{compatPart.replace(/^Compatible\s*(with\s*)?/i, "")}</p>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>


        {isMaintenance && !isInDevelopment && !hideMaintenanceBadge && (
          <div className="text-xs text-muted-foreground mb-4">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              <Wrench className="w-3 h-3 mr-1" />
              Under maintenance
            </Badge>
          </div>
        )}


        {user && !isInDevelopment && !isAdmin && canPurchase && (
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <div className="flex gap-1.5 mb-2">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  billingCycle === "monthly" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-background hover:bg-muted"
                }`}
                data-testid={`button-cycle-monthly-${script.id}`}
              >
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  billingCycle === "yearly" 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-background hover:bg-muted"
                }`}
                data-testid={`button-cycle-yearly-${script.id}`}
              >
                <Calendar className="w-3 h-3 inline mr-1" />
                Yearly -15%
              </button>
            </div>
            <div>
              {billingCycle === "monthly" ? (
                <p className="text-sm font-bold text-primary" data-testid={`text-price-monthly-${script.id}`}>
                  {formatPrice(script.monthlyPriceCents)}<span className="text-[11px] font-normal text-muted-foreground"> excl. VAT/mo</span>
                </p>
              ) : (
                <>
                  <p className="text-sm font-bold text-primary" data-testid={`text-price-yearly-${script.id}`}>
                    {formatPrice(yearlyPriceCents)}<span className="text-[11px] font-normal text-muted-foreground"> excl. VAT/yr</span>
                  </p>
                  <p className="text-[10px] text-green-600 dark:text-green-400">
                    Save {formatPrice(monthlySavings)}
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto space-y-2">
          {!user && !isInDevelopment && (
            <Button asChild className="w-full" data-testid={`button-login-${script.id}`}>
              <a href="/auth">
                Log in to purchase
              </a>
            </Button>
          )}

          {user && !hasPurchased && !isAdmin && !checkingPurchase && !isInDevelopment && canPurchase && !lockedByCompletePack && (
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
              {billingCycle === "yearly" ? "Subscribe for 1 year" : "Subscribe"}
            </Button>
          )}

          {user && lockedByCompletePack && !hasPurchased && (
            <div className="text-center py-3 text-sm text-green-600 dark:text-green-400">
              <Check className="w-4 h-4 inline mr-2" />
              Included in your Complete Pack
            </div>
          )}


          {isInDevelopment && (
            <div className="flex justify-center">
              <Badge variant="secondary" className="bg-blue-500 text-white text-sm px-3 py-1">
                <Clock className="w-3 h-3 mr-1.5" />
                Coming soon
              </Badge>
            </div>
          )}

          {isMaintenance && !isInDevelopment && hasPurchased && !hideMaintenanceBadge && (
            <div className="text-center py-3 text-sm text-orange-600 dark:text-orange-400">
              <Wrench className="w-4 h-4 inline mr-2" />
              Download temporarily unavailable
            </div>
          )}

          {isAdmin && !hasPurchased && !isInDevelopment && (
            <>
              <div className="flex items-center justify-center gap-2 text-sm text-primary py-2">
                <Check className="w-4 h-4" />
                <span>Admin Access</span>
              </div>
              <Button
                asChild
                className="w-full"
                data-testid={`button-goto-products-${script.id}`}
              >
                <Link href="/purchases">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  My Products
                </Link>
              </Button>
            </>
          )}

          {hasPurchased && (
            <>
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400 py-2">
                <Check className="w-4 h-4" />
                <span>
                  {purchaseType === "direct" ? "Permanent purchase" : "Active subscription"}
                </span>
              </div>
              <Button
                asChild
                className="w-full"
                data-testid={`button-goto-products-${script.id}`}
              >
                <Link href="/purchases">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  My Products
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
