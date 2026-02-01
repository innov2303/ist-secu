import { Hero } from "@/components/Hero";
import { ScriptCard } from "@/components/ScriptCard";
import { BundleCard } from "@/components/BundleCard";
import { useScripts } from "@/hooks/use-scripts";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { AnnualBundle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { SEO, OrganizationSchema } from "@/components/SEO";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertCircle, LogIn, LogOut, Settings, ShoppingBag, BarChart3, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  const { data: scripts, isLoading, error } = useScripts();
  const { user, isLoading: authLoading, logout } = useAuth();

  // Fetch annual bundles
  const { data: bundles } = useQuery<AnnualBundle[]>({
    queryKey: ["/api/annual-bundles"],
  });

  // Check if user has the Complete Security Pack (bundle with most scripts)
  const completeBundle = bundles?.reduce((max, b) => 
    (b.includedScriptIds.length > (max?.includedScriptIds.length || 0)) ? b : max
  , bundles[0]);
  
  const { data: hasCompletePackData } = useQuery<{ hasCompletePack: boolean }>({
    queryKey: ["/api/purchases/check-complete-pack", completeBundle?.id],
    queryFn: async () => {
      if (!completeBundle) return { hasCompletePack: false };
      let allPurchased = true;
      for (const scriptId of completeBundle.includedScriptIds) {
        const res = await apiRequest("GET", `/api/purchases/check/${scriptId}`);
        const data = await res.json();
        if (!data.hasPurchased) {
          allPurchased = false;
          break;
        }
      }
      return { hasCompletePack: allPurchased };
    },
    enabled: !!user && !!completeBundle,
  });
  
  const hasCompletePack = hasCompletePackData?.hasCompletePack || false;

  return (
    <div className="min-h-screen bg-background">
      <SEO 
        title="Home"
        description="Professional security audit scripts for Windows, Linux, VMware ESXi, Containers and Web. ANSSI and CIS Benchmark compliance with detailed reports."
        url="/"
      />
      <OrganizationSchema />
      {/* Auth Header */}
      <div className="fixed top-0 right-0 z-50 p-4 flex items-center gap-3">
        {authLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        ) : user ? (
          <>
            <Button variant="default" size="sm" asChild data-testid="link-suivi">
              <Link href="/suivi">
                <BarChart3 className="h-4 w-4 mr-2" />
                Fleet Tracking
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild data-testid="link-purchases">
              <Link href="/purchases">
                <ShoppingBag className="h-4 w-4 mr-2" />
                My Products
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild data-testid="link-support">
              <Link href="/support">
                <MessageSquare className="h-4 w-4 mr-2" />
                Support
              </Link>
            </Button>
            {user.isAdmin && (
              <Button variant="secondary" size="sm" asChild data-testid="link-admin">
                <Link href="/admin">
                  <Settings className="h-4 w-4 mr-2" />
                  IST Administration
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
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout" className="text-white hover:text-white/80 hover:bg-transparent">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <ThemeToggle />
            <Button asChild data-testid="button-login">
              <Link href="/auth">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Link>
            </Button>
          </>
        )}
      </div>

      <Hero />

      <main className="container mx-auto px-4 pb-24">
        {/* Section Header */}
        <div className="mb-12 text-center md:text-left border-b border-border/40 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold font-mono mb-2">
              Compliance Toolkit list
            </h2>
            <p className="text-muted-foreground">
              Select the compliance toolkit corresponding to your operating system.
            </p>
          </div>
          <div className="text-xs font-mono text-primary/80 bg-primary/5 px-3 py-1 rounded border border-primary/20">
            Operating System Toolkit
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
            <p className="font-mono animate-pulse">Initializing data streams...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center justify-center py-24 text-destructive">
            <AlertCircle className="w-12 h-12 mb-4" />
            <h3 className="text-xl font-bold font-mono">Connection Failed</h3>
            <p className="text-muted-foreground mt-2">Unable to retrieve script manifest from secure server.</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && scripts?.length === 0 && (
          <div className="text-center py-24 border border-dashed border-border rounded-xl bg-card/50">
            <p className="text-muted-foreground font-mono">No verification scripts currently available.</p>
          </div>
        )}

        {/* Scripts Grid */}
        {!isLoading && !error && scripts && scripts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {scripts.map((script, index) => (
              <ScriptCard key={script.id} script={script} index={index} lockedByCompletePack={hasCompletePack} hideMaintenanceBadge />
            ))}
          </div>
        )}

        
        {/* Discover Packs CTA - Only visible when NOT logged in */}
        {!user && bundles && bundles.length > 0 && (
          <div className="mt-16 text-center">
            <div className="bg-card border border-border/40 rounded-md p-8 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold font-mono mb-3">Annual Packs Available</h3>
              <p className="text-muted-foreground mb-6">
                Log in to discover our bundle offers and save up to 20% on your subscriptions.
              </p>
              <Button asChild data-testid="button-discover-packs">
                <Link href="/auth">
                  Discover our packs
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Annual Bundles Section - Only visible when logged in */}
        {user && bundles && bundles.length > 0 && scripts && (
          <div className="mt-16">
            <div className="mb-12 text-center md:text-left border-b border-border/40 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold font-mono mb-2">
                  Annual Packs
                </h2>
                <p className="text-muted-foreground">
                  Save with our multi-toolkit annual subscription packs.
                </p>
              </div>
              <div className="text-xs font-mono text-primary/80 bg-primary/5 px-3 py-1 rounded border border-primary/20">
                Bundle Offers
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bundles
                .filter(bundle => {
                  // Hide bundles that contain any toolkit with "development" status
                  const hasDevToolkit = bundle.includedScriptIds.some(scriptId => {
                    const script = scripts.find(s => s.id === scriptId);
                    return script?.status === "development";
                  });
                  return !hasDevToolkit;
                })
                .map((bundle, index) => (
                <BundleCard 
                  key={bundle.id} 
                  bundle={bundle} 
                  scripts={scripts} 
                  index={index} 
                  lockedByCompletePack={hasCompletePack && bundle.id !== completeBundle?.id}
                  isCompletePack={bundle.id === completeBundle?.id}
                />
              ))}
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground font-mono">
            <div>
              &copy; 2026 Innov Studio.
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-privacy">Privacy Policy</Link>
              <Link href="/documentation" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-documentation">Documentation</Link>
              <Link href="/support" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-support-footer">
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
