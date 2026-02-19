import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Monitor, Terminal, Server, Container, Download, ShoppingBag, ArrowLeft, Calendar, CheckCircle, RefreshCw, Infinity, LogOut, Settings, ChevronDown, FileCode, Shield, XCircle, Loader2, RotateCcw, Package, ShieldCheck, Globe, History, Plus, Minus, Tag, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SiLinux, SiNetapp } from "react-icons/si";
import { FaWindows } from "react-icons/fa";
import type { Purchase, Script, AnnualBundle, ScriptVersion } from "@shared/schema";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

type PurchaseWithScript = Purchase & { script: Script };

const iconMap: Record<string, any> = {
  Monitor,
  FaWindows,
  Terminal,
  Server,
  Container,
  SiLinux,
  SiNetapp,
  sinetapp: SiNetapp,
  netapp: SiNetapp,
  Shield,
  ShieldCheck,
  Globe,
  Package,
};

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function isExpired(purchase: PurchaseWithScript): boolean {
  if (purchase.purchaseType === "direct") return false;
  if (!purchase.expiresAt) return false;
  return new Date(purchase.expiresAt) < new Date();
}

interface ToolkitBundle {
  id: number;
  name: string;
  os: string;
  icon: string;
  compliance: string;
  purchaseType: string;
  purchasedAt: Date | string;
  expiresAt: Date | string | null;
  priceCents: number;
  expired: boolean;
  scripts: PurchaseWithScript[];
  stripeSubscriptionId: string | null;
  firstPurchaseId: number;
}

interface AnnualBundlePurchase {
  bundle: AnnualBundle;
  toolkits: ToolkitBundle[];
  purchasedAt: Date | string;
  expiresAt: Date | string | null;
  expired: boolean;
  stripeSubscriptionId: string | null;
  firstPurchaseId: number;
  priceCents: number;
}

interface SubscriptionStatus {
  isSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  status?: string;
}

interface VersionHistoryResponse {
  currentVersion: string;
  scriptName: string;
  versions: ScriptVersion[];
}

function VersionHistoryDialog({ 
  scriptId, 
  scriptName,
  currentVersion,
  open, 
  onOpenChange 
}: { 
  scriptId: number; 
  scriptName: string;
  currentVersion: string;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedVersion, setSelectedVersion] = useState<string>(currentVersion);
  
  const { data, isLoading, error } = useQuery<VersionHistoryResponse>({
    queryKey: ["/api/scripts", scriptId, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/scripts/${scriptId}/versions`, { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to fetch version history");
      }
      return res.json();
    },
    enabled: open,
  });

  const changeTypeLabels: Record<string, { label: string; icon: any; color: string }> = {
    controls_added: { label: "Controls added", icon: Plus, color: "text-green-600 dark:text-green-400" },
    controls_removed: { label: "Controls removed", icon: Minus, color: "text-red-600 dark:text-red-400" },
    major_update: { label: "Major update", icon: Tag, color: "text-blue-600 dark:text-blue-400" },
    minor_update: { label: "Minor update", icon: Tag, color: "text-yellow-600 dark:text-yellow-400" },
    patch: { label: "Patch", icon: Tag, color: "text-gray-600 dark:text-gray-400" },
  };

  const allVersions = [
    currentVersion,
    ...(data?.versions?.map(v => v.version) || [])
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-version-history">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History
          </DialogTitle>
          <DialogDescription>
            {scriptName} - Current version: {currentVersion}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Download a version</label>
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="w-full" data-testid="select-version">
                <SelectValue placeholder="Select a version" />
              </SelectTrigger>
              <SelectContent>
                {allVersions.map((version) => (
                  <SelectItem key={version} value={version}>
                    v{version} {version === currentVersion && "(current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="pt-5">
            <Button
              size="sm"
              variant="default"
              data-testid="button-download-version"
              asChild
            >
              <a href={`/api/scripts/${scriptId}/download?version=${selectedVersion}`} download>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
        </div>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              <XCircle className="h-10 w-10 mx-auto mb-2 text-destructive opacity-50" />
              <p>Failed to load version history.</p>
              <p className="text-sm">Please try again later.</p>
            </div>
          ) : data?.versions && data.versions.length > 0 ? (
            <div className="space-y-3">
              {data.versions.map((version) => {
                const changeInfo = changeTypeLabels[version.changeType] || changeTypeLabels.patch;
                const ChangeIcon = changeInfo.icon;
                return (
                  <div 
                    key={version.id} 
                    className="border rounded-lg p-3 space-y-2"
                    data-testid={`version-entry-${version.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          v{version.version}
                        </Badge>
                        <span className={`flex items-center gap-1 text-sm ${changeInfo.color}`}>
                          <ChangeIcon className="h-3 w-3" />
                          {changeInfo.label}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(version.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {version.changesSummary}
                    </p>
                    {(version.controlsAdded !== null && version.controlsAdded > 0) || 
                     (version.controlsRemoved !== null && version.controlsRemoved > 0) ? (
                      <div className="flex gap-3 text-xs">
                        {version.controlsAdded !== null && version.controlsAdded > 0 && (
                          <span className="text-green-600 dark:text-green-400">
                            +{version.controlsAdded} control(s)
                          </span>
                        )}
                        {version.controlsRemoved !== null && version.controlsRemoved > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            -{version.controlsRemoved} control(s)
                          </span>
                        )}
                      </div>
                    ) : null}
                    {version.previousVersion && (
                      <div className="text-xs text-muted-foreground">
                        Since v{version.previousVersion}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>No update history available.</p>
              <p className="text-sm">This toolkit has not yet received any updates.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function groupPurchases(
  purchases: PurchaseWithScript[], 
  scripts: Script[],
  annualBundles: AnnualBundle[]
): { 
  annualBundlePurchases: AnnualBundlePurchase[], 
  toolkitBundles: ToolkitBundle[], 
  standalone: PurchaseWithScript[] 
} {
  const annualBundlePurchases: AnnualBundlePurchase[] = [];
  const toolkitBundles: ToolkitBundle[] = [];
  const standalone: PurchaseWithScript[] = [];
  const usedPurchaseIds = new Set<number>();

  const annualBundlePurchasesList = purchases.filter(p => p.purchaseType === "annual_bundle");
  const subscriptionGroups = new Map<string, PurchaseWithScript[]>();
  
  for (const purchase of annualBundlePurchasesList) {
    if (purchase.stripeSubscriptionId) {
      if (!subscriptionGroups.has(purchase.stripeSubscriptionId)) {
        subscriptionGroups.set(purchase.stripeSubscriptionId, []);
      }
      subscriptionGroups.get(purchase.stripeSubscriptionId)!.push(purchase);
    }
  }

  Array.from(subscriptionGroups.entries()).forEach(([subscriptionId, bundlePurchases]) => {
    bundlePurchases.forEach((p: PurchaseWithScript) => usedPurchaseIds.add(p.id));
    
    const purchasedScriptIds = bundlePurchases.map((p: PurchaseWithScript) => p.scriptId);
    const matchingBundle = annualBundles.find(ab => {
      const bundleScriptIds = ab.includedScriptIds || [];
      return bundleScriptIds.every((id: number) => purchasedScriptIds.includes(id)) &&
             purchasedScriptIds.every((id: number) => bundleScriptIds.includes(id));
    });

    if (matchingBundle) {
      const toolkitsInBundle: ToolkitBundle[] = [];
      
      for (const purchase of bundlePurchases) {
        const toolkit = scripts.find(s => s.id === purchase.scriptId);
        if (toolkit) {
          const bundledScripts = scripts.filter(s => (toolkit.bundledScriptIds || []).includes(s.id));
          
          toolkitsInBundle.push({
            id: toolkit.id,
            name: toolkit.name,
            os: toolkit.os,
            icon: toolkit.icon,
            compliance: toolkit.compliance,
            purchaseType: purchase.purchaseType,
            purchasedAt: purchase.purchasedAt,
            expiresAt: purchase.expiresAt,
            priceCents: toolkit.monthlyPriceCents || 0,
            expired: isExpired(purchase),
            scripts: bundledScripts.map(s => ({ ...purchase, script: s, scriptId: s.id })),
            stripeSubscriptionId: purchase.stripeSubscriptionId || null,
            firstPurchaseId: purchase.id,
          });
        }
      }

      const firstPurchase = bundlePurchases[0];
      annualBundlePurchases.push({
        bundle: matchingBundle,
        toolkits: toolkitsInBundle,
        purchasedAt: firstPurchase.purchasedAt,
        expiresAt: firstPurchase.expiresAt,
        expired: bundlePurchases.some(p => isExpired(p)),
        stripeSubscriptionId: subscriptionId,
        firstPurchaseId: firstPurchase.id,
        priceCents: firstPurchase.priceCents,
      });
    }
  });

  const nonAnnualBundlePurchases = purchases.filter(p => p.purchaseType !== "annual_bundle" && !usedPurchaseIds.has(p.id));
  const toolkitScripts = scripts.filter(s => s.bundledScriptIds && s.bundledScriptIds.length > 0);

  for (const toolkit of toolkitScripts) {
    const bundledIds = toolkit.bundledScriptIds || [];
    const matchingPurchases = nonAnnualBundlePurchases.filter(p => bundledIds.includes(p.scriptId));
    
    if (matchingPurchases.length > 0) {
      matchingPurchases.forEach(p => usedPurchaseIds.add(p.id));
      
      const firstPurchase = matchingPurchases[0];
      
      toolkitBundles.push({
        id: toolkit.id,
        name: toolkit.name,
        os: toolkit.os,
        icon: toolkit.icon,
        compliance: toolkit.compliance,
        purchaseType: firstPurchase.purchaseType,
        purchasedAt: firstPurchase.purchasedAt,
        expiresAt: firstPurchase.expiresAt,
        priceCents: toolkit.monthlyPriceCents || 0,
        expired: matchingPurchases.some(p => isExpired(p)),
        scripts: matchingPurchases,
        stripeSubscriptionId: firstPurchase.stripeSubscriptionId || null,
        firstPurchaseId: firstPurchase.id,
      });
    }
  }

  for (const purchase of purchases) {
    if (!usedPurchaseIds.has(purchase.id)) {
      standalone.push(purchase);
    }
  }

  return { annualBundlePurchases, toolkitBundles: toolkitBundles, standalone };
}

function AnnualBundleCard({ bundlePurchase, allScripts }: { bundlePurchase: AnnualBundlePurchase, allScripts: Script[] }) {
  const Icon = iconMap[bundlePurchase.bundle.icon] || Package;
  const { toast } = useToast();

  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/purchases", bundlePurchase.firstPurchaseId, "subscription-status"],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${bundlePurchase.firstPurchaseId}/subscription-status`, { credentials: "include" });
      return res.json();
    },
    enabled: !bundlePurchase.expired && !!bundlePurchase.stripeSubscriptionId,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${bundlePurchase.firstPurchaseId}/cancel-renewal`);
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", bundlePurchase.firstPurchaseId, "subscription-status"] });
      toast({ title: "Renewal cancelled", description: "Your subscription will not be automatically renewed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel renewal.", variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${bundlePurchase.firstPurchaseId}/reactivate-renewal`);
      if (!res.ok) throw new Error("Failed to reactivate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", bundlePurchase.firstPurchaseId, "subscription-status"] });
      toast({ title: "Renewal reactivated", description: "Your subscription will be automatically renewed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reactivate renewal.", variant: "destructive" });
    },
  });

  const cancelAtPeriodEnd = subscriptionStatus?.cancelAtPeriodEnd || false;
  const expirationDate = subscriptionStatus?.currentPeriodEnd || bundlePurchase.expiresAt;

  return (
    <Card data-testid={`card-annual-bundle-${bundlePurchase.bundle.id}`} className={bundlePurchase.expired ? "opacity-60" : ""}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="toolkits" className="border-0">
          <CardHeader className="pb-0">
            <div className="flex flex-row items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-md bg-gradient-to-br from-primary/20 to-primary/5">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {bundlePurchase.bundle.name}
                    {bundlePurchase.expired ? (
                      <Badge variant="destructive" className="text-xs">Expired</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Active
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {bundlePurchase.bundle.description}
                  </CardDescription>
                </div>
              </div>
              <AccordionTrigger className="p-0 hover:no-underline" data-testid={`accordion-trigger-bundle-${bundlePurchase.bundle.id}`}>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {bundlePurchase.toolkits.length} toolkits
                </Badge>
              </AccordionTrigger>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Purchased: {formatDate(bundlePurchase.purchasedAt)}</span>
              </div>
              <span className="hidden sm:inline mx-1">-</span>
              <span className="font-medium">
                {formatPrice(bundlePurchase.priceCents)} excl. VAT/year
              </span>
              <Badge variant="outline" className="ml-2">
                -{bundlePurchase.bundle.discountPercent}%
              </Badge>
            </div>
            
            {!bundlePurchase.expired && (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 mb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {cancelAtPeriodEnd ? "Expires on" : "Next renewal"}
                  </span>
                  {expirationDate ? (
                    <span className="text-sm text-muted-foreground">{formatDate(expirationDate)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Active subscription</span>
                  )}
                  {cancelAtPeriodEnd && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      Automatic renewal is disabled
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {cancelAtPeriodEnd ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reactivateMutation.isPending}
                          data-testid={`button-reactivate-bundle-${bundlePurchase.bundle.id}`}
                        >
                          {reactivateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reactivate renewal</AlertDialogTitle>
                          <AlertDialogDescription>
                            Do you want to reactivate automatic renewal of your annual package? Your card will be charged automatically on the renewal date.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => reactivateMutation.mutate()}>
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cancelMutation.isPending}
                          data-testid={`button-cancel-bundle-${bundlePurchase.bundle.id}`}
                        >
                          {cancelMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Stop renewal
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Stop renewal</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to stop automatic renewal? You will retain access until the end of the current period.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )}

            <AccordionContent className="pt-0 pb-0">
              <div className="space-y-3 mt-2">
                {bundlePurchase.toolkits.map((toolkit) => (
                  <NestedToolkitCard key={toolkit.id} toolkit={toolkit} allScripts={allScripts} parentExpired={bundlePurchase.expired} />
                ))}
              </div>
            </AccordionContent>
          </CardContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function NestedToolkitCard({ toolkit, allScripts, parentExpired }: { toolkit: ToolkitBundle, allScripts: Script[], parentExpired: boolean }) {
  const Icon = iconMap[toolkit.icon] || Monitor;
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  
  const toolkitScript = allScripts.find(s => s.id === toolkit.id);
  const bundledScripts = toolkitScript?.bundledScriptIds 
    ? allScripts.filter(s => toolkitScript.bundledScriptIds!.includes(s.id))
    : [];
  
  const currentVersion = toolkitScript?.version || "1.0.0";
  const isMaintenanceOrOffline = toolkitScript?.status === "maintenance" || toolkitScript?.status === "offline";
  const canDownload = !parentExpired && !toolkit.expired && toolkitScript?.status === "active";

  return (
    <Card className="border-l-4 border-l-primary/30">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="scripts" className="border-0">
          <CardHeader className="py-3 px-4">
            <div className="flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    {toolkit.name}
                    <Badge variant="outline" className="text-xs font-mono">
                      v{currentVersion}
                    </Badge>
                    {isMaintenanceOrOffline && (
                      <Badge variant="secondary" className="text-xs">
                        {toolkitScript?.status === "maintenance" ? "Under maintenance" : "Offline"}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">{toolkit.compliance}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={canDownload ? "default" : "secondary"}
                  disabled={!canDownload}
                  data-testid={`button-download-toolkit-${toolkit.id}`}
                  asChild={canDownload}
                >
                  {canDownload ? (
                    <a href={`/api/scripts/${toolkit.id}/download`} download>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </a>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      {isMaintenanceOrOffline ? "Unavailable" : "Download"}
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setVersionHistoryOpen(true)}
                  data-testid={`button-version-history-nested-${toolkit.id}`}
                >
                  <History className="h-4 w-4 mr-1" />
                  Updates
                </Button>
                <AccordionTrigger className="p-0 hover:no-underline" data-testid={`accordion-trigger-toolkit-${toolkit.id}`}>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <FileCode className="h-3 w-3" />
                    {bundledScripts.length} scripts
                  </Badge>
                </AccordionTrigger>
              </div>
            </div>
          </CardHeader>
          
          <AccordionContent className="px-4 pb-3">
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              {bundledScripts.map((script) => (
                <div key={script.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{script.name}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!canDownload}
                    data-testid={`button-download-script-${script.id}`}
                    asChild={canDownload}
                  >
                    {canDownload ? (
                      <a href={`/api/scripts/${script.id}/download`} download>
                        <Download className="h-3 w-3" />
                      </a>
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <VersionHistoryDialog
        scriptId={toolkit.id}
        scriptName={toolkit.name}
        currentVersion={currentVersion}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
      />
    </Card>
  );
}

function ToolkitCard({ bundle, allScripts }: { bundle: ToolkitBundle, allScripts: Script[] }) {
  const Icon = iconMap[bundle.icon] || Monitor;
  const { toast } = useToast();
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  
  const toolkitScript = allScripts.find(s => s.id === bundle.id);
  const bundledScripts = toolkitScript?.bundledScriptIds 
    ? allScripts.filter(s => toolkitScript.bundledScriptIds!.includes(s.id))
    : [];
  
  const currentVersion = toolkitScript?.version || "1.0.0";

  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/purchases", bundle.firstPurchaseId, "subscription-status"],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${bundle.firstPurchaseId}/subscription-status`, { credentials: "include" });
      return res.json();
    },
    enabled: !bundle.expired && (bundle.purchaseType === "monthly" || bundle.purchaseType === "yearly") && !!bundle.stripeSubscriptionId,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${bundle.firstPurchaseId}/cancel-renewal`);
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", bundle.firstPurchaseId, "subscription-status"] });
      toast({ title: "Renewal cancelled", description: "Your subscription will not be automatically renewed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel renewal.", variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${bundle.firstPurchaseId}/reactivate-renewal`);
      if (!res.ok) throw new Error("Failed to reactivate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", bundle.firstPurchaseId, "subscription-status"] });
      toast({ title: "Renewal reactivated", description: "Your subscription will be automatically renewed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reactivate renewal.", variant: "destructive" });
    },
  });

  const isSubscription = bundle.purchaseType === "monthly" || bundle.purchaseType === "yearly";
  const cancelAtPeriodEnd = subscriptionStatus?.cancelAtPeriodEnd || false;
  const expirationDate = subscriptionStatus?.currentPeriodEnd || bundle.expiresAt;
  
  const isMaintenanceOrOffline = toolkitScript?.status === "maintenance" || toolkitScript?.status === "offline";
  const canDownload = !bundle.expired && toolkitScript?.status === "active";

  return (
    <Card data-testid={`card-toolkit-${bundle.id}`} className={bundle.expired ? "opacity-60" : ""}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="scripts" className="border-0">
          <CardHeader className="pb-0">
            <div className="flex flex-row items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {bundle.name}
                    {bundle.expired ? (
                      <Badge variant="destructive" className="text-xs">Expired</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        Active
                      </Badge>
                    )}
                    {isMaintenanceOrOffline && (
                      <Badge variant="secondary" className="text-xs">
                        {toolkitScript?.status === "maintenance" ? "Under maintenance" : "Offline"}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 flex-wrap">
                    {bundle.compliance}
                    <Badge variant="outline" className="font-mono text-xs">
                      v{currentVersion}
                    </Badge>
                  </CardDescription>
                </div>
              </div>
              <AccordionTrigger className="p-0 hover:no-underline" data-testid={`accordion-trigger-toolkit-${bundle.id}`}>
                <Badge variant="outline" className="flex items-center gap-1">
                  <FileCode className="h-3 w-3" />
                  {bundledScripts.length} scripts
                </Badge>
              </AccordionTrigger>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>Purchased: {formatDate(bundle.purchasedAt)}</span>
              </div>
              <span className="hidden sm:inline mx-1">-</span>
              <span className="font-medium">
                {bundle.purchaseType === "yearly" ? formatPrice(bundle.priceCents * 12 * 0.85) + " excl. VAT/year" : formatPrice(bundle.priceCents) + " excl. VAT/month"}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <Button
                size="sm"
                variant={canDownload ? "default" : "secondary"}
                disabled={!canDownload}
                data-testid={`button-download-toolkit-${bundle.id}`}
                asChild={canDownload}
              >
                {canDownload ? (
                  <a href={`/api/scripts/${bundle.id}/download`} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download toolkit
                  </a>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    {isMaintenanceOrOffline ? "Download temporarily unavailable" : "Download"}
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setVersionHistoryOpen(true)}
                data-testid={`button-version-history-${bundle.id}`}
              >
                <History className="h-4 w-4 mr-2" />
                Updates
              </Button>
            </div>
            
            {isSubscription && !bundle.expired && (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 mt-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {cancelAtPeriodEnd ? "Expires on" : "Next renewal"}
                  </span>
                  {expirationDate ? (
                    <span className="text-sm text-muted-foreground">{formatDate(expirationDate)}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Active subscription</span>
                  )}
                  {cancelAtPeriodEnd && (
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      Automatic renewal is disabled
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {cancelAtPeriodEnd ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reactivateMutation.isPending}
                          data-testid={`button-reactivate-subscription-${bundle.id}`}
                        >
                          {reactivateMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Reactivate
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reactivate renewal</AlertDialogTitle>
                          <AlertDialogDescription>
                            Do you want to reactivate automatic renewal of your subscription? Your card will be charged automatically on the renewal date.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => reactivateMutation.mutate()}>
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={cancelMutation.isPending}
                          data-testid={`button-cancel-subscription-${bundle.id}`}
                        >
                          {cancelMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 mr-1" />
                              Stop renewal
                            </>
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Stop renewal</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to stop automatic renewal? You will retain access until the end of the current period.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                            Confirm
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            )}

            <AccordionContent className="pt-4 pb-0">
              <div className="space-y-2 pl-4 border-l-2 border-muted">
                {bundledScripts.map((script) => (
                  <div key={script.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{script.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!canDownload}
                      data-testid={`button-download-script-${script.id}`}
                      asChild={canDownload}
                    >
                      {canDownload ? (
                        <a href={`/api/scripts/${script.id}/download`} download>
                          <Download className="h-3 w-3" />
                        </a>
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </CardContent>
        </AccordionItem>
      </Accordion>
      
      <VersionHistoryDialog
        scriptId={bundle.id}
        scriptName={bundle.name}
        currentVersion={currentVersion}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
      />
    </Card>
  );
}

function PurchaseCard({ purchase }: { purchase: PurchaseWithScript }) {
  const Icon = iconMap[purchase.script.icon] || Monitor;
  const expired = isExpired(purchase);
  const { toast } = useToast();
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  
  const isMaintenanceOrOffline = purchase.script.status === "maintenance" || purchase.script.status === "offline";
  const canDownload = !expired && purchase.script.status === "active";
  const currentVersion = purchase.script.version || "1.0.0";

  const { data: subscriptionStatus } = useQuery<SubscriptionStatus>({
    queryKey: ["/api/purchases", purchase.id, "subscription-status"],
    queryFn: async () => {
      const res = await fetch(`/api/purchases/${purchase.id}/subscription-status`, { credentials: "include" });
      return res.json();
    },
    enabled: !expired && (purchase.purchaseType === "monthly" || purchase.purchaseType === "yearly") && !!purchase.stripeSubscriptionId,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${purchase.id}/cancel-renewal`);
      if (!res.ok) throw new Error("Failed to cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", purchase.id, "subscription-status"] });
      toast({ title: "Renewal cancelled", description: "Your subscription will not be automatically renewed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel renewal.", variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/purchases/${purchase.id}/reactivate-renewal`);
      if (!res.ok) throw new Error("Failed to reactivate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases", purchase.id, "subscription-status"] });
      toast({ title: "Renewal reactivated", description: "Your subscription will be automatically renewed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reactivate renewal.", variant: "destructive" });
    },
  });

  const isSubscription = purchase.purchaseType === "monthly" || purchase.purchaseType === "yearly";
  const cancelAtPeriodEnd = subscriptionStatus?.cancelAtPeriodEnd || false;
  const expirationDate = subscriptionStatus?.currentPeriodEnd || purchase.expiresAt;

  return (
    <Card data-testid={`card-purchase-${purchase.id}`} className={expired ? "opacity-60" : ""}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              {purchase.script.name}
              <Badge variant="outline" className="text-xs font-mono">
                v{currentVersion}
              </Badge>
              {expired ? (
                <Badge variant="destructive" className="text-xs">Expired</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Active
                </Badge>
              )}
              {isMaintenanceOrOffline && (
                <Badge variant="secondary" className="text-xs">
                  {purchase.script.status === "maintenance" ? "Under maintenance" : "Offline"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{purchase.script.compliance}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Purchased: {formatDate(purchase.purchasedAt)}</span>
            </div>
            <span className="hidden sm:inline mx-1">-</span>
            <span className="font-medium">
              {purchase.purchaseType === "direct" 
                ? formatPrice(purchase.priceCents) + " excl. VAT" 
                : purchase.purchaseType === "yearly"
                  ? formatPrice(purchase.priceCents) + " excl. VAT/year"
                  : formatPrice(purchase.priceCents) + " excl. VAT/month"
              }
            </span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={canDownload ? "default" : "secondary"}
              disabled={!canDownload}
              data-testid={`button-download-${purchase.id}`}
              asChild={canDownload}
            >
              {canDownload ? (
                <a href={`/api/scripts/${purchase.scriptId}/download`} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {isMaintenanceOrOffline ? "Download temporarily unavailable" : "Download"}
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVersionHistoryOpen(true)}
              data-testid={`button-version-history-${purchase.id}`}
            >
              <History className="h-4 w-4 mr-2" />
              Updates
            </Button>
          </div>

          {purchase.purchaseType === "direct" && purchase.expiresAt && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {expired ? "Expires on" : "Valid until"}
                </span>
                <span className="text-sm text-muted-foreground">{formatDate(purchase.expiresAt)}</span>
              </div>
            </div>
          )}
          
          {isSubscription && !expired && (
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {cancelAtPeriodEnd ? "Expire le" : "Prochain renouvellement"}
                </span>
                {expirationDate ? (
                  <span className="text-sm text-muted-foreground">{formatDate(expirationDate)}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Abonnement actif</span>
                )}
                {cancelAtPeriodEnd && (
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    Le renouvellement automatique est desactive
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {cancelAtPeriodEnd ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reactivateMutation.isPending}
                        data-testid={`button-reactivate-subscription-${purchase.id}`}
                      >
                        {reactivateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reactiver
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reactiver le renouvellement</AlertDialogTitle>
                        <AlertDialogDescription>
                          Voulez-vous reactiver le renouvellement automatique de votre abonnement ? Votre carte sera debitee automatiquement a la date de renouvellement.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => reactivateMutation.mutate()}>
                          Confirmer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={cancelMutation.isPending}
                        data-testid={`button-cancel-subscription-${purchase.id}`}
                      >
                        {cancelMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="h-4 w-4 mr-1" />
                            Arreter le renouvellement
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Arreter le renouvellement</AlertDialogTitle>
                        <AlertDialogDescription>
                          Etes-vous sur de vouloir arreter le renouvellement automatique ? Vous conserverez l'acces jusqu'a la fin de la periode en cours.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancelMutation.mutate()}>
                          Confirmer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <VersionHistoryDialog
        scriptId={purchase.scriptId}
        scriptName={purchase.script.name}
        currentVersion={currentVersion}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
      />
    </Card>
  );
}

function AdminScriptCard({ script, allScripts }: { script: Script; allScripts: Script[] }) {
  const Icon = iconMap[script.icon] || Monitor;
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedBundledScript, setSelectedBundledScript] = useState<Script | null>(null);
  const [bundledVersionHistoryOpen, setBundledVersionHistoryOpen] = useState(false);
  const currentVersion = script.version || "1.0.0";
  const [expanded, setExpanded] = useState(false);
  
  const bundledScripts = script.bundledScriptIds?.map(id => allScripts.find(s => s.id === id)).filter(Boolean) as Script[] || [];
  
  const openBundledVersionHistory = (bundledScript: Script) => {
    setSelectedBundledScript(bundledScript);
    setBundledVersionHistoryOpen(true);
  };
  
  return (
    <Card data-testid={`card-admin-script-${script.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
              {script.name}
              <Badge variant="outline" className="text-xs font-mono">
                v{currentVersion}
              </Badge>
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                Admin
              </Badge>
              {bundledScripts.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {bundledScripts.length} script(s)
                </Badge>
              )}
            </CardTitle>
            <CardDescription>{script.compliance}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="default"
            data-testid={`button-admin-download-${script.id}`}
            asChild
          >
            <a href={`/api/scripts/${script.id}/download`} download>
              <Download className="h-4 w-4 mr-2" />
              Download
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVersionHistoryOpen(true)}
            data-testid={`button-admin-version-history-${script.id}`}
          >
            <History className="h-4 w-4 mr-2" />
            Updates
          </Button>
          {bundledScripts.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              data-testid={`button-toggle-bundled-${script.id}`}
            >
              <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              {expanded ? 'Hide scripts' : 'View scripts'}
            </Button>
          )}
        </div>
        
        {expanded && bundledScripts.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              Scripts included in this toolkit
            </h4>
            {bundledScripts.map((bundledScript) => {
              const BundledIcon = iconMap[bundledScript.icon] || FileCode;
              const bundledVersion = bundledScript.version || "1.0.0";
              return (
                <div
                  key={bundledScript.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                  data-testid={`row-admin-bundled-script-${bundledScript.id}`}
                >
                  <div className="flex items-center gap-3">
                    <BundledIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        {bundledScript.name}
                        <Badge variant="outline" className="text-xs font-mono">
                          v{bundledVersion}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bundledScript.filename}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                      data-testid={`button-download-bundled-${bundledScript.id}`}
                    >
                      <a href={`/api/scripts/${bundledScript.id}/download`} download>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openBundledVersionHistory(bundledScript)}
                      data-testid={`button-bundled-version-history-${bundledScript.id}`}
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      
      <VersionHistoryDialog
        scriptId={script.id}
        scriptName={script.name}
        currentVersion={currentVersion}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
      />
      
      {selectedBundledScript && (
        <VersionHistoryDialog
          scriptId={selectedBundledScript.id}
          scriptName={selectedBundledScript.name}
          currentVersion={selectedBundledScript.version || "1.0.0"}
          open={bundledVersionHistoryOpen}
          onOpenChange={setBundledVersionHistoryOpen}
        />
      )}
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-start gap-4 space-y-0">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Purchases() {
  const { user, isLoading: authLoading, logout } = useAuth();

  const { data: purchases, isLoading } = useQuery<PurchaseWithScript[]>({
    queryKey: ["/api/purchases"],
    enabled: !!user,
  });

  const { data: scripts } = useQuery<Script[]>({
    queryKey: ["/api/scripts/all"],
    enabled: !!user,
  });

  const { data: annualBundles } = useQuery<AnnualBundle[]>({
    queryKey: ["/api/annual-bundles"],
    enabled: !!user,
  });

  // Fetch shared purchases if user is a team member
  const { data: sharedData } = useQuery<{ 
    purchases: PurchaseWithScript[]; 
    isTeamMember: boolean; 
    teamName?: string;
    memberRole?: string;
  }>({
    queryKey: ["/api/teams/shared-purchases"],
    enabled: !!user,
  });

  const [activeTab] = useState("products");

  const { annualBundlePurchases, toolkitBundles, standalone } = purchases && scripts && annualBundles
    ? groupPurchases(purchases, scripts, annualBundles) 
    : { annualBundlePurchases: [], toolkitBundles: [], standalone: [] };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-64 border-r bg-card p-4">
          <Skeleton className="h-10 w-full mb-8" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>My Products</CardTitle>
            <CardDescription>Please log in to access your purchases.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild data-testid="button-login-redirect">
              <Link href="/auth">Log In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasAnyPurchases = annualBundlePurchases.length > 0 || toolkitBundles.length > 0 || standalone.length > 0;
  const hasSharedPurchases = sharedData?.isTeamMember && sharedData.purchases.length > 0;

  // Group shared purchases for display
  const sharedPurchasesGrouped = sharedData?.purchases && scripts && annualBundles
    ? groupPurchases(sharedData.purchases, scripts, annualBundles)
    : { annualBundlePurchases: [], toolkitBundles: [], standalone: [] };

  const navItems = [
    { id: "products" as const, label: "My Products", icon: ShoppingBag },
  ];

  const activePurchasesCount = toolkitBundles.filter(b => !b.expired).length + 
    annualBundlePurchases.filter(b => !b.expired).length +
    standalone.filter(p => !isExpired(p)).length;

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-sm truncate">My Products</h2>
              <p className="text-xs text-muted-foreground truncate">
                {activePurchasesCount > 0 ? `${activePurchasesCount} active product${activePurchasesCount > 1 ? "s" : ""}` : "No active products"}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="mb-6">
            <p className="text-xs font-medium text-muted-foreground px-3 mb-2">Navigation</p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {user.isAdmin && (
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground px-3 mb-2">Administration</p>
              <div className="space-y-1">
                <Link href="/admin">
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    data-testid="nav-admin"
                  >
                    <Settings className="w-4 h-4" />
                    Admin Panel
                  </button>
                </Link>
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t space-y-1">
          <Link href="/profile">
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              <Avatar className="h-5 w-5">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">{user.firstName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <span className="truncate">{user.firstName || user.email}</span>
            </button>
          </Link>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Log out
          </Button>
          <Link href="/">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-3" />
              Back to site
            </Button>
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-6 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">My Products</h1>
              <p className="text-sm text-muted-foreground">
                {user?.isAdmin ? "Admin access - All toolkits available" : "Manage your purchased security toolkits"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button asChild data-testid="button-browse-scripts">
                <Link href="/">Browse Scripts</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="p-6">

        {isLoading ? (
          <LoadingSkeleton />
        ) : user?.isAdmin ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold">Admin Access - All Toolkits</h2>
            </div>
            <div className="space-y-4">
              {scripts?.filter(s => !s.isHidden && s.bundledScriptIds && s.bundledScriptIds.length > 0).map((script) => (
                <AdminScriptCard key={script.id} script={script} allScripts={scripts || []} />
              ))}
            </div>
          </div>
        ) : hasAnyPurchases ? (
          <div className="space-y-6">
            {annualBundlePurchases.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Annual Packages
                </h2>
                {annualBundlePurchases.map((bundlePurchase) => (
                  <AnnualBundleCard key={bundlePurchase.bundle.id} bundlePurchase={bundlePurchase} allScripts={scripts || []} />
                ))}
              </div>
            )}
            
            {toolkitBundles.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Toolkits
                </h2>
                {toolkitBundles.map((bundle) => (
                  <ToolkitCard key={bundle.id} bundle={bundle} allScripts={scripts || []} />
                ))}
              </div>
            )}
            
            {standalone.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  Individual Scripts
                </h2>
                {standalone.map((purchase) => (
                  <PurchaseCard key={purchase.id} purchase={purchase} />
                ))}
              </div>
            )}
            
            {/* Show shared team purchases if user is a team member */}
            {hasSharedPurchases && (
              <>
                <Card className="bg-primary/5 border-primary/20 mt-8">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5 text-primary" />
                      Products shared by the team
                    </CardTitle>
                    <CardDescription>
                      Access to team products "{sharedData?.teamName}"
                      {sharedData?.memberRole === "admin" ? " (Admin)" : " (Member)"}
                    </CardDescription>
                  </CardHeader>
                </Card>
                
                {sharedPurchasesGrouped.toolkitBundles.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Shared Toolkits
                    </h2>
                    {sharedPurchasesGrouped.toolkitBundles.map((bundle) => (
                      <ToolkitCard key={`shared-${bundle.id}`} bundle={bundle} allScripts={scripts || []} />
                    ))}
                  </div>
                )}
                
                {sharedPurchasesGrouped.standalone.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FileCode className="h-5 w-5 text-primary" />
                      Shared Scripts
                    </h2>
                    {sharedPurchasesGrouped.standalone.map((purchase) => (
                      <PurchaseCard key={`shared-${purchase.id}`} purchase={purchase} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ) : hasSharedPurchases ? (
          <div className="space-y-6">
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5 text-primary" />
                  Products shared by the team
                </CardTitle>
                <CardDescription>
                  You have access to team products "{sharedData?.teamName}" 
                  {sharedData?.memberRole === "admin" ? " (Admin)" : " (Member)"}
                </CardDescription>
              </CardHeader>
            </Card>
            
            {sharedPurchasesGrouped.toolkitBundles.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Shared Toolkits
                </h2>
                {sharedPurchasesGrouped.toolkitBundles.map((bundle) => (
                  <ToolkitCard key={`shared-${bundle.id}`} bundle={bundle} allScripts={scripts || []} />
                ))}
              </div>
            )}
            
            {sharedPurchasesGrouped.standalone.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-primary" />
                  Shared Scripts
                </h2>
                {sharedPurchasesGrouped.standalone.map((purchase) => (
                  <PurchaseCard key={`shared-${purchase.id}`} purchase={purchase} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">No purchases</h2>
              <p className="text-muted-foreground mb-6">
                You haven't purchased any security scripts yet
              </p>
              <Button asChild data-testid="button-browse-scripts">
                <Link href="/">Browse scripts</Link>
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  );
}
