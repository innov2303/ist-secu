import { useState } from "react";
import { Hero } from "@/components/Hero";
import { ScriptCard } from "@/components/ScriptCard";
import { BundleCard } from "@/components/BundleCard";
import { useScripts } from "@/hooks/use-scripts";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { AnnualBundle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CONTACT_SUBJECTS = [
  { value: "question", label: "Question générale", description: "Renseignements sur nos produits ou services" },
  { value: "technical", label: "Support technique", description: "Aide à l'installation ou utilisation des scripts" },
  { value: "billing", label: "Facturation", description: "Questions sur les paiements, factures ou abonnements" },
  { value: "feedback", label: "Suggestion", description: "Idées d'amélioration ou nouvelles fonctionnalités" },
];
import { Loader2, AlertCircle, LogIn, LogOut, Settings, ShoppingBag, Mail, Send, CheckCircle, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const { data: scripts, isLoading, error } = useScripts();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", subject: "", description: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const { toast } = useToast();

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
      {/* Auth Header */}
      <div className="fixed top-0 right-0 z-50 p-4 flex items-center gap-3">
        {authLoading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        ) : user ? (
          <>
            <Button variant="default" size="sm" asChild data-testid="link-suivi">
              <Link href="/suivi">
                <BarChart3 className="h-4 w-4 mr-2" />
                Suivi de votre parc
              </Link>
            </Button>
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
            <Button variant="ghost" size="sm" onClick={() => logout()} data-testid="button-logout" className="text-white hover:text-white/80 hover:bg-transparent">
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
              <ScriptCard key={script.id} script={script} index={index} lockedByCompletePack={hasCompletePack} hideMaintenanceBadge />
            ))}
          </div>
        )}

        {/* Discover Packs CTA - Only visible when NOT logged in */}
        {!user && bundles && bundles.length > 0 && (
          <div className="mt-16 text-center">
            <div className="bg-card border border-border/40 rounded-md p-8 max-w-2xl mx-auto">
              <h3 className="text-xl font-bold font-mono mb-3">Packs Annuels Disponibles</h3>
              <p className="text-muted-foreground mb-6">
                Connectez-vous pour decouvrir nos offres groupees et economiser jusqu'a 20% sur vos abonnements.
              </p>
              <Button asChild data-testid="button-discover-packs">
                <Link href="/auth">
                  Decouvrez nos packs
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
                  Packs Annuels
                </h2>
                <p className="text-muted-foreground">
                  Economisez avec nos packs multi-toolkits en abonnement annuel.
                </p>
              </div>
              <div className="text-xs font-mono text-primary/80 bg-primary/5 px-3 py-1 rounded border border-primary/20">
                Offres Groupees
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
              &copy; {new Date().getFullYear()} Security Verification Sys.
            </div>
            <div className="flex gap-6">
              <Link href="/privacy" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-privacy">Politique de Confidentialité</Link>
              <Link href="/documentation" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-documentation">Documentation</Link>
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

      <Dialog open={supportOpen} onOpenChange={(open) => {
        setSupportOpen(open);
        if (!open) {
          setSent(false);
          setTicketNumber("");
          setContactForm({ name: "", email: "", subject: "", description: "" });
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Nous contacter
            </DialogTitle>
            <DialogDescription>
              Envoyez-nous un message et nous vous répondrons rapidement.
            </DialogDescription>
          </DialogHeader>
          {sent ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Message envoyé</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Nous avons bien reçu votre message et vous répondrons dans les plus brefs délais.
              </p>
              <div className="bg-muted px-4 py-2 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Numéro de ticket</p>
                <p className="font-mono font-semibold text-primary">{ticketNumber}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSending(true);
              try {
                const subjectLabel = CONTACT_SUBJECTS.find(s => s.value === contactForm.subject)?.label || contactForm.subject;
                const response = await apiRequest("POST", "/api/contact", {
                  ...contactForm,
                  subject: subjectLabel,
                  userId: user?.id || null,
                  name: contactForm.name || user?.firstName || "",
                  email: contactForm.email || user?.email || "",
                });
                const data = await response.json();
                setTicketNumber(data.ticketNumber);
                setSent(true);
                toast({ title: "Message envoyé", description: `Ticket: ${data.ticketNumber}` });
              } catch (error) {
                toast({ title: "Erreur", description: "Impossible d'envoyer le message.", variant: "destructive" });
              } finally {
                setSending(false);
              }
            }} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Nom</Label>
                <Input
                  id="contact-name"
                  value={contactForm.name || user?.firstName || ""}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="Votre nom"
                  required
                  data-testid="input-contact-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactForm.email || user?.email || ""}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  placeholder="votre@email.com"
                  required
                  data-testid="input-contact-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-subject">Motif de contact</Label>
                <Select
                  value={contactForm.subject}
                  onValueChange={(value) => setContactForm({ ...contactForm, subject: value })}
                >
                  <SelectTrigger data-testid="select-contact-subject">
                    <SelectValue placeholder="Sélectionnez un motif" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_SUBJECTS.map((subject) => (
                      <SelectItem key={subject.value} value={subject.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{subject.label}</span>
                          <span className="text-xs text-muted-foreground">{subject.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-description">Description</Label>
                <Textarea
                  id="contact-description"
                  value={contactForm.description}
                  onChange={(e) => setContactForm({ ...contactForm, description: e.target.value })}
                  placeholder="Décrivez votre demande..."
                  rows={4}
                  required
                  data-testid="input-contact-description"
                />
              </div>
              <Button type="submit" className="w-full" disabled={sending} data-testid="button-send-contact">
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer
                  </>
                )}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
