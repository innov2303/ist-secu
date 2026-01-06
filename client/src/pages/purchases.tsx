import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Terminal, Server, Container, Download, ShoppingBag, ArrowLeft, Calendar, CheckCircle, RefreshCw, Infinity } from "lucide-react";
import type { Purchase, Script } from "@shared/schema";

type PurchaseWithScript = Purchase & { script: Script };

const iconMap: Record<string, any> = {
  Monitor,
  Terminal,
  Server,
  Container,
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
        <p className="text-sm text-muted-foreground">{purchase.script.description}</p>

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

export default function Purchases() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: purchases, isLoading } = useQuery<PurchaseWithScript[]>({
    queryKey: ["/api/purchases"],
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <LoadingSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
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
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild data-testid="button-back-home">
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Mes Achats</h1>
          <p className="text-muted-foreground">
            Scripts de sécurité que vous avez achetés
          </p>
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : purchases && purchases.length > 0 ? (
        <div className="space-y-4">
          {purchases.map((purchase) => (
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
  );
}
