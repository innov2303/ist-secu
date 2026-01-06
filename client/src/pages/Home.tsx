import { Hero } from "@/components/Hero";
import { ScriptCard } from "@/components/ScriptCard";
import { useScripts } from "@/hooks/use-scripts";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, AlertCircle, LogIn, LogOut, Settings, ShoppingBag } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: scripts, isLoading, error } = useScripts();
  const { user, isLoading: authLoading, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Auth Header */}
      <div className="fixed top-0 right-0 z-50 p-4 flex items-center gap-3">
        {authLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        ) : user ? (
          <>
            <Button variant="default" size="sm" asChild data-testid="link-purchases">
              <Link href="/purchases">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Mes Achats
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
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur border">
              <Avatar className="h-7 w-7">
                <AvatarImage src={user.profileImageUrl || undefined} />
                <AvatarFallback>{user.firstName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{user.firstName || user.email}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Button asChild data-testid="button-login">
            <Link href="/auth">
              <LogIn className="h-4 w-4 mr-2" />
              Connexion
            </Link>
          </Button>
        )}
      </div>

      <Hero />

      <main className="container mx-auto px-4 pb-24">
        {/* Section Header */}
        <div className="mb-12 text-center md:text-left border-b border-border/40 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold font-mono mb-2">
              Available Environments
            </h2>
            <p className="text-muted-foreground">
              Select your operating system to download the corresponding verification toolkit.
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
              <ScriptCard key={script.id} script={script} index={index} />
            ))}
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 mt-auto">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground font-mono">
            <div>
              &copy; {new Date().getFullYear()} Security Verification Sys.
            </div>
            <div className="flex gap-6">
              <span className="hover:text-primary cursor-pointer transition-colors">Privacy Protocol</span>
              <span className="hover:text-primary cursor-pointer transition-colors">Documentation</span>
              <span className="hover:text-primary cursor-pointer transition-colors">Support</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
