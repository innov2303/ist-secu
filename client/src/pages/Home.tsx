import { useState } from "react";
import { Hero } from "@/components/Hero";
import { ScriptCard } from "@/components/ScriptCard";
import { useScripts } from "@/hooks/use-scripts";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, AlertCircle, LogIn, LogOut, Settings, ShoppingBag, Mail } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { data: scripts, isLoading, error } = useScripts();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);

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
                Mes produits
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
              <Link href="/privacy" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-privacy">Politique de Confidentialité</Link>
              <span className="hover:text-primary cursor-pointer transition-colors">Documentation</span>
              <span 
                className="hover:text-primary cursor-pointer transition-colors" 
                onClick={() => setSupportOpen(true)}
                data-testid="button-support"
              >
                Support
              </span>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Contacter le Support
            </DialogTitle>
            <DialogDescription>
              Pour toute question ou assistance, contactez-nous par email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Notre équipe support est disponible pour vous aider avec :
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Questions sur les scripts et leur utilisation</li>
              <li>Problèmes de paiement ou d'abonnement</li>
              <li>Demandes de fonctionnalités</li>
              <li>Signalement de bugs</li>
            </ul>
            <div className="pt-4 border-t">
              <a 
                href="mailto:cyrilallegretb@gmail.com" 
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                data-testid="link-email-support"
              >
                <Mail className="h-4 w-4" />
                cyrilallegretb@gmail.com
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
