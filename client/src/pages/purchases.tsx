import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Monitor, Terminal, Server, Container, Download, ShoppingBag, ArrowLeft, Calendar, CheckCircle, RefreshCw, Infinity, LogOut, Settings, ChevronDown, FileCode, Shield } from "lucide-react";
import { SiLinux, SiNetapp } from "react-icons/si";
import { FaWindows } from "react-icons/fa";
import type { Purchase, Script } from "@shared/schema";
import logoImg from "@assets/generated_images/ist_shield_logo_tech_style.png";
import bannerImg from "@assets/stock_images/cybersecurity_digita_51ae1fac.jpg";

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
};

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
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
}

function groupPurchasesByToolkit(purchases: PurchaseWithScript[], scripts: Script[]): { bundles: ToolkitBundle[], standalone: PurchaseWithScript[] } {
  const bundles: ToolkitBundle[] = [];
  const standalone: PurchaseWithScript[] = [];
  const usedPurchaseIds = new Set<number>();

  const toolkitScripts = scripts.filter(s => s.bundledScriptIds && s.bundledScriptIds.length > 0);

  for (const toolkit of toolkitScripts) {
    const bundledIds = toolkit.bundledScriptIds || [];
    const matchingPurchases = purchases.filter(p => bundledIds.includes(p.scriptId));
    
    if (matchingPurchases.length > 0) {
      matchingPurchases.forEach(p => usedPurchaseIds.add(p.id));
      
      const firstPurchase = matchingPurchases[0];
      const anyExpired = matchingPurchases.some(p => isExpired(p));
      
      bundles.push({
        id: toolkit.id,
        name: toolkit.name,
        os: toolkit.os,
        icon: toolkit.icon,
        compliance: toolkit.compliance,
        purchaseType: firstPurchase.purchaseType,
        purchasedAt: firstPurchase.purchasedAt,
        expiresAt: firstPurchase.expiresAt,
        priceCents: toolkit.monthlyPriceCents || 0,
        expired: anyExpired,
        scripts: matchingPurchases,
      });
    }
  }

  for (const purchase of purchases) {
    if (!usedPurchaseIds.has(purchase.id)) {
      standalone.push(purchase);
    }
  }

  return { bundles, standalone };
}

function ToolkitCard({ bundle }: { bundle: ToolkitBundle }) {
  const Icon = iconMap[bundle.icon] || Monitor;

  return (
    <Card data-testid={`card-toolkit-${bundle.id}`}>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="scripts" className="border-0">
          <CardHeader className="pb-0">
            <div className="flex flex-row items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{bundle.name}</CardTitle>
                  <CardDescription className="mt-1">{bundle.os}</CardDescription>
                </div>
              </div>
              <Badge variant={bundle.expired ? "destructive" : "secondary"} className="shrink-0">
                {bundle.purchaseType === "direct" ? (
                  <>
                    <Infinity className="h-3 w-3 mr-1" />
                    Permanent
                  </>
                ) : bundle.expired ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Expiré
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Abonnement
                  </>
                )}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{bundle.compliance}</Badge>
              <Badge variant="outline" className="text-xs">
                {bundle.scripts.length} scripts inclus
              </Badge>
            </div>

            <div className="flex items-center justify-between pt-2 border-t gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDate(bundle.purchasedAt)}</span>
                </div>
                <span className="hidden sm:inline mx-1">-</span>
                <span className="font-medium">{formatPrice(bundle.priceCents)}/mois</span>
                {bundle.purchaseType === "monthly" && bundle.expiresAt && (
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    Expire le {formatDate(bundle.expiresAt)}
                  </span>
                )}
              </div>
            </div>

            <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline" data-testid={`button-expand-toolkit-${bundle.id}`}>
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4" />
                Voir les scripts à télécharger
              </div>
            </AccordionTrigger>
            
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {bundle.scripts.map((purchase) => (
                  <div 
                    key={purchase.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 gap-4"
                    data-testid={`script-item-${purchase.script.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{purchase.script.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{purchase.script.filename}</p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant={bundle.expired ? "secondary" : "outline"}
                      asChild={!bundle.expired}
                      disabled={bundle.expired}
                      data-testid={`button-download-script-${purchase.script.id}`}
                    >
                      {bundle.expired ? (
                        <span>
                          <Download className="h-4 w-4" />
                        </span>
                      ) : (
                        <a href={`/api/scripts/${purchase.script.id}/download`} download>
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </CardContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function PurchaseCard({ purchase }: { purchase: PurchaseWithScript }) {
  const Icon = iconMap[purchase.script.icon] || Monitor;
  const expired = isExpired(purchase);

  return (
    <Card data-testid={`card-purchase-${purchase.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{purchase.script.name}</CardTitle>
            <CardDescription className="mt-1">{purchase.script.os}</CardDescription>
          </div>
        </div>
        <Badge variant={expired ? "destructive" : "secondary"} className="shrink-0">
          {purchase.purchaseType === "direct" ? (
            <>
              <Infinity className="h-3 w-3 mr-1" />
              Permanent
            </>
          ) : expired ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              Expiré
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 mr-1" />
              Abonnement
            </>
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground whitespace-pre-line">{purchase.script.description}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{purchase.script.compliance}</Badge>
          {purchase.script.features.map((feature, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {feature}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(purchase.purchasedAt)}</span>
            </div>
            <span className="hidden sm:inline mx-1">-</span>
            <span className="font-medium">{formatPrice(purchase.priceCents)}</span>
            {purchase.purchaseType === "monthly" && purchase.expiresAt && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                Expire le {formatDate(purchase.expiresAt)}
              </span>
            )}
          </div>
          <Button 
            size="sm" 
            asChild={!expired}
            disabled={expired}
            variant={expired ? "secondary" : "default"}
            data-testid={`button-download-${purchase.id}`}
          >
            {expired ? (
              <span>
                <Download className="h-4 w-4 mr-2" />
                Renouveler
              </span>
            ) : (
              <a href={`/api/scripts/${purchase.script.id}/download`} download>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </a>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
            <Skeleton className="h-10 w-10 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AdminScriptCard({ script }: { script: Script }) {
  const Icon = iconMap[script.icon] || iconMap[script.icon.toLowerCase()] || Monitor;

  return (
    <Card data-testid={`card-admin-script-${script.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">{script.name}</CardTitle>
            <CardDescription className="mt-1">{script.os}</CardDescription>
          </div>
        </div>
        <Badge variant="default" className="shrink-0 bg-green-600">
          <Shield className="h-3 w-3 mr-1" />
          Accès Admin
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-3">{script.description}</p>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{script.compliance}</Badge>
        </div>

        <div className="flex items-center justify-between pt-2 border-t gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{formatPrice(script.monthlyPriceCents)}/mois</span>
          </div>
          <Button 
            size="sm" 
            asChild
            data-testid={`button-admin-download-${script.id}`}
          >
            <a href={`/api/scripts/${script.id}/download`} download>
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Purchases() {
  const { user, isLoading: authLoading, logout } = useAuth();

  const { data: purchases, isLoading } = useQuery<PurchaseWithScript[]>({
    queryKey: ["/api/purchases"],
    enabled: !!user,
  });

  const { data: scripts } = useQuery<Script[]>({
    queryKey: ["/api/scripts"],
    enabled: !!user,
  });

  const { bundles, standalone } = purchases && scripts 
    ? groupPurchasesByToolkit(purchases, scripts) 
    : { bundles: [], standalone: [] };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-8 px-4 max-w-4xl">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto py-16 px-4 max-w-4xl text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Connexion requise</h1>
          <p className="text-muted-foreground mb-6">
            Connectez-vous pour accéder à vos achats
          </p>
          <Button asChild data-testid="button-login-redirect">
            <Link href="/">Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Auth Header - Same as Home page */}
      <div className="fixed top-0 right-0 z-50 p-4 flex items-center gap-3">
        <Button variant="default" size="sm" asChild data-testid="link-home">
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Accueil
          </Link>
        </Button>
        {user.isAdmin && (
          <Button variant="secondary" size="sm" asChild data-testid="link-admin">
            <Link href="/admin">
              <Settings className="h-4 w-4 mr-2" />
              Admin
            </Link>
          </Button>
        )}
        <Link href="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur border hover-elevate cursor-pointer" data-testid="link-profile">
          <Avatar className="h-7 w-7">
            <AvatarImage src={user.profileImageUrl || undefined} />
            <AvatarFallback>{user.firstName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium hidden sm:inline">{user.firstName || user.email}</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Hero Banner - Same style as Home page */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <img 
          src={bannerImg} 
          alt="Security Infrastructure" 
          className="w-full h-full object-cover brightness-[0.4]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        <div className="absolute inset-0 flex items-start justify-start p-6">
          <div className="flex items-center gap-4">
            <Link href="/">
              <img 
                src={logoImg} 
                alt="IST Logo" 
                className="w-56 h-56 drop-shadow-lg mix-blend-screen"
              />
            </Link>
            <div>
              <h1 className="text-2xl tracking-wider text-white drop-shadow-lg" style={{ fontFamily: "'Oxanium', sans-serif" }}>
                Mes produits
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto py-8 px-4">

        {isLoading ? (
          <LoadingSkeleton />
        ) : user?.isAdmin ? (
          // Admin view - show all available toolkits
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-green-600" />
              <h2 className="text-xl font-semibold">Accès Administrateur - Tous les Toolkits</h2>
            </div>
            <div className="space-y-4">
              {scripts?.filter(s => !s.isHidden && s.bundledScriptIds && s.bundledScriptIds.length > 0).map((script) => (
                <AdminScriptCard key={script.id} script={script} />
              ))}
            </div>
          </div>
        ) : (bundles.length > 0 || standalone.length > 0) ? (
          <div className="space-y-4">
            {bundles.map((bundle) => (
              <ToolkitCard key={bundle.id} bundle={bundle} />
            ))}
            {standalone.map((purchase) => (
              <PurchaseCard key={purchase.id} purchase={purchase} />
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">Aucun achat</h2>
              <p className="text-muted-foreground mb-6">
                Vous n'avez pas encore acheté de scripts de sécurité
              </p>
              <Button asChild data-testid="button-browse-scripts">
                <Link href="/">Parcourir les scripts</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Infra Shield Tools - Security Compliance Toolkit</p>
        </div>
      </footer>
    </div>
  );
}
