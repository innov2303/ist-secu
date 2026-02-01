import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { User, Mail, Lock, AlertCircle, Building2, FileText, Eye, Calendar, CreditCard, Loader2, Home, ShoppingBag, MapPin, Printer, Users, UserPlus, Trash2, Edit2, Plus, BadgeCheck, AlertTriangle, Send } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Invoice, InvoiceItem, Team, TeamMember } from "@shared/schema";

type ProfileSection = "personal" | "team" | "purchases";

export default function Profile() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<ProfileSection>("personal");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [billingStreet, setBillingStreet] = useState("");
  const [billingPostalCode, setBillingPostalCode] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [viewingInvoice, setViewingInvoice] = useState<{ invoice: Invoice; items: InvoiceItem[] } | null>(null);
  const [teamName, setTeamName] = useState("");
  const [editingTeamName, setEditingTeamName] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");

  // Fetch team eligibility
  const { data: canCreateTeamData, isLoading: canCreateLoading } = useQuery<{ canCreate: boolean }>({
    queryKey: ["/api/teams/can-create"],
    enabled: !!user,
  });

  // Fetch user's team
  const { data: teamData, isLoading: teamLoading } = useQuery<{ team: Team | null; members: TeamMember[] }>({
    queryKey: ["/api/teams/my-team"],
    enabled: !!user,
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/teams", { name });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Equipe creee avec succes" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
      setTeamName("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await apiRequest("PATCH", `/api/teams/${id}`, { name });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Equipe mise a jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
      setEditingTeamName(false);
      setTeamName("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/teams/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Equipe supprimee" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Add team member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, email, name, role }: { teamId: number; email: string; name?: string; role: string }) => {
      const res = await apiRequest("POST", `/api/teams/${teamId}/members`, { email, name, role });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Membre ajoute" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
      setNewMemberEmail("");
      setNewMemberName("");
      setNewMemberRole("member");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Remove team member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: number; memberId: number }) => {
      const res = await apiRequest("DELETE", `/api/teams/${teamId}/members/${memberId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Membre supprime" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams/my-team"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Fetch user invoices
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/my-invoices"],
    enabled: !!user,
  });

  const isLocalUser = (user as any)?.isLocalAuth === true;

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; companyName?: string; billingStreet?: string; billingPostalCode?: string; billingCity?: string }) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profil mis a jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setFirstName("");
      setLastName("");
      setCompanyName("");
      setBillingStreet("");
      setBillingPostalCode("");
      setBillingCity("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const requestEmailChangeMutation = useMutation({
    mutationFn: async (data: { newEmail: string; password: string }) => {
      const res = await apiRequest("POST", "/api/profile/request-email-change", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: "Demande enregistree", 
        description: data.message 
      });
      setNewEmail("");
      setEmailPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/profile/change-password", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Mot de passe modifie avec succes" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const resendVerificationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/resend-verification", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Email envoye", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim() && !companyName.trim() && !billingStreet.trim() && !billingPostalCode.trim() && !billingCity.trim()) {
      toast({ title: "Erreur", description: "Veuillez remplir au moins un champ", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate({
      ...(firstName.trim() && { firstName: firstName.trim() }),
      ...(lastName.trim() && { lastName: lastName.trim() }),
      ...(companyName.trim() && { companyName: companyName.trim() }),
      ...(billingStreet.trim() && { billingStreet: billingStreet.trim() }),
      ...(billingPostalCode.trim() && { billingPostalCode: billingPostalCode.trim() }),
      ...(billingCity.trim() && { billingCity: billingCity.trim() }),
    });
  };

  const handleRequestEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !emailPassword) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    requestEmailChangeMutation.mutate({ newEmail: newEmail.trim(), password: emailPassword });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caracteres", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleViewInvoice = async (invoiceId: number) => {
    try {
      const response = await apiRequest("GET", `/api/my-invoices/${invoiceId}`);
      if (!response.ok) throw new Error("Erreur lors de la recuperation de la facture");
      const data = await response.json();
      setViewingInvoice(data);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger la facture", variant: "destructive" });
    }
  };

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Payee</Badge>;
      case "sent":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Envoyee</Badge>;
      case "draft":
        return <Badge variant="secondary">Brouillon</Badge>;
      case "overdue":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">En retard</Badge>;
      case "cancelled":
        return <Badge variant="outline">Annulee</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const handlePrintInvoice = () => {
    if (!viewingInvoice) return;
    
    const { invoice, items } = viewingInvoice;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Facture ${invoice.invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #1f2937; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
          .logo span { color: #1f2937; }
          .invoice-info { text-align: right; }
          .invoice-number { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
          .invoice-date { color: #6b7280; }
          .parties { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .party { width: 45%; }
          .party-title { font-weight: bold; color: #6b7280; margin-bottom: 10px; font-size: 12px; text-transform: uppercase; }
          .party-name { font-weight: bold; font-size: 16px; margin-bottom: 5px; }
          .party-detail { color: #6b7280; font-size: 14px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; }
          td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .amount { text-align: right; }
          .totals { margin-left: auto; width: 300px; }
          .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
          .total-row.final { border-top: 2px solid #1f2937; font-weight: bold; font-size: 18px; padding-top: 15px; }
          .notes { margin-top: 30px; padding: 15px; background: #f9fafb; border-radius: 8px; }
          .notes-title { font-weight: bold; margin-bottom: 5px; }
          .notes-text { color: #6b7280; font-size: 14px; }
          .footer { margin-top: 50px; text-align: center; color: #9ca3af; font-size: 12px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status.paid { background: #dcfce7; color: #166534; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">Infra <span>Shield Tools</span></div>
          <div class="invoice-info">
            <div class="invoice-number">${invoice.invoiceNumber}</div>
            <div class="invoice-date">Date: ${new Date(invoice.createdAt).toLocaleDateString('fr-FR')}</div>
            ${invoice.paidAt ? `<div class="status paid">Payee le ${new Date(invoice.paidAt).toLocaleDateString('fr-FR')}</div>` : ''}
          </div>
        </div>
        
        <div class="parties">
          <div class="party">
            <div class="party-title">Emetteur</div>
            <div class="party-name">Infra Shield Tools</div>
            <div class="party-detail">ist-security.fr</div>
          </div>
          <div class="party">
            <div class="party-title">Client</div>
            <div class="party-name">${invoice.customerName}</div>
            <div class="party-detail">${invoice.customerEmail}</div>
            ${invoice.customerAddress ? `<div class="party-detail">${invoice.customerAddress}</div>` : ''}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="amount">Quantite</th>
              <th class="amount">Prix unitaire HT</th>
              <th class="amount">Total HT</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td>${item.description}</td>
                <td class="amount">${item.quantity}</td>
                <td class="amount">${(item.unitPriceCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
                <td class="amount">${(item.totalCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div class="total-row">
            <span>Sous-total HT</span>
            <span>${(invoice.subtotalCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
          <div class="total-row">
            <span>TVA (${invoice.taxRate}%)</span>
            <span>${(invoice.taxCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
          <div class="total-row final">
            <span>Total</span>
            <span>${(invoice.totalCents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</span>
          </div>
        </div>
        
        ${invoice.notes ? `
          <div class="notes">
            <div class="notes-title">Notes</div>
            <div class="notes-text">${invoice.notes}</div>
          </div>
        ` : ''}
        
        <div class="footer">
          <p>Infra Shield Tools - ist-security.fr</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Veuillez vous connecter pour acceder a votre profil.
            </p>
            <div className="flex justify-center mt-4">
              <Link href="/auth">
                <Button data-testid="button-goto-login">Se connecter</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sidebarItems = [
    { id: "personal" as ProfileSection, label: "Informations personnelles", icon: User },
    { id: "team" as ProfileSection, label: "Mon equipe", icon: Users, count: teamData?.members?.length },
    { id: "purchases" as ProfileSection, label: "Historique des achats", icon: ShoppingBag, count: invoicesData?.invoices?.length },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Fixed Sidebar */}
      <aside className="w-64 bg-card border-r flex flex-col fixed h-screen z-50">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-bold text-lg">Mon compte</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === item.id 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover-elevate"
              }`}
              data-testid={`nav-${item.id}`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <Badge 
                  variant={activeSection === item.id ? "secondary" : "outline"} 
                  className="text-xs h-5 min-w-[20px] flex items-center justify-center"
                >
                  {item.count}
                </Badge>
              )}
            </button>
          ))}
        </nav>

        {/* Footer Links */}
        <div className="p-4 border-t space-y-1">
          <Link href="/">
            <Button variant="ghost" className="w-full justify-start gap-3" data-testid="button-goto-home">
              <Home className="h-4 w-4" />
              Retour au site
            </Button>
          </Link>
        </div>

        {/* User Info */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={(user as any).profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">
                {user.firstName?.[0] || user.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64">
        <div className="p-8">
          {/* Personal Information Section */}
          {activeSection === "personal" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <User className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Informations personnelles</h2>
                  <p className="text-muted-foreground">Gerez vos informations de compte</p>
                </div>
              </div>

              {/* Current Info Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Informations actuelles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Identite</p>
                        <p className="font-medium">{user.firstName} {user.lastName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Entreprise</p>
                        <p className="font-medium">{(user as any).companyName || "Non renseignee"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Adresse</p>
                        <p className="font-medium">
                          {(user as any).billingStreet || (user as any).billingCity 
                            ? `${(user as any).billingPostalCode || ""} ${(user as any).billingCity || ""}`.trim() || "Non renseignee"
                            : "Non renseignee"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{user.email}</p>
                          {user.isEmailVerified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600/30 bg-green-50 dark:bg-green-900/20 gap-1" data-testid="badge-email-verified">
                              <BadgeCheck className="h-3 w-3" />
                              Verifie
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-amber-600 border-amber-600/30 bg-amber-50 dark:bg-amber-900/20 gap-1" data-testid="badge-email-not-verified">
                                <AlertTriangle className="h-3 w-3" />
                                Non verifie
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resendVerificationMutation.mutate()}
                                disabled={resendVerificationMutation.isPending}
                                className="h-6 text-xs"
                                data-testid="button-resend-verification"
                              >
                                {resendVerificationMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Send className="h-3 w-3 mr-1" />
                                )}
                                Renvoyer
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Combined Profile Card */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Modifier mes informations</CardTitle>
                  <CardDescription>Ces informations apparaitront sur vos factures</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="firstName" className="text-xs flex items-center gap-1.5">
                          <User className="h-3 w-3" /> Prenom
                        </Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder={user.firstName || "Prenom"}
                          data-testid="input-first-name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="lastName" className="text-xs">Nom</Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder={user.lastName || "Nom"}
                          data-testid="input-last-name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="companyName" className="text-xs flex items-center gap-1.5">
                          <Building2 className="h-3 w-3" /> Entreprise
                        </Label>
                        <Input
                          id="companyName"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder={(user as any).companyName || "Nom de l'entreprise"}
                          data-testid="input-company-name"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 md:col-span-1">
                        <Label htmlFor="billingStreet" className="text-xs flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" /> Adresse
                        </Label>
                        <Input
                          id="billingStreet"
                          value={billingStreet}
                          onChange={(e) => setBillingStreet(e.target.value)}
                          placeholder={(user as any).billingStreet || "Rue, numero"}
                          data-testid="input-billing-street"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="billingPostalCode" className="text-xs">Code postal</Label>
                        <Input
                          id="billingPostalCode"
                          value={billingPostalCode}
                          onChange={(e) => setBillingPostalCode(e.target.value)}
                          placeholder={(user as any).billingPostalCode || "75000"}
                          data-testid="input-billing-postal-code"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="billingCity" className="text-xs">Ville</Label>
                        <Input
                          id="billingCity"
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                          placeholder={(user as any).billingCity || "Paris"}
                          data-testid="input-billing-city"
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={updateProfileMutation.isPending}
                      data-testid="button-update-profile"
                    >
                      {updateProfileMutation.isPending ? "Mise a jour..." : "Enregistrer les modifications"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Security Section - Local users only */}
              {isLocalUser && (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Securite du compte
                    </CardTitle>
                    <CardDescription>Modifiez votre email ou mot de passe</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Email Change */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" /> Changer l'email
                        </h4>
                        <form onSubmit={handleRequestEmailChange} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="newEmail" className="text-xs">Nouvel email</Label>
                              <Input
                                id="newEmail"
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="nouvelle@email.com"
                                data-testid="input-new-email"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="emailPassword" className="text-xs">Mot de passe</Label>
                              <Input
                                id="emailPassword"
                                type="password"
                                value={emailPassword}
                                onChange={(e) => setEmailPassword(e.target.value)}
                                placeholder="Pour confirmer"
                                data-testid="input-email-password"
                              />
                            </div>
                          </div>
                          <Button 
                            type="submit" 
                            size="sm"
                            disabled={requestEmailChangeMutation.isPending}
                            data-testid="button-request-email-change"
                          >
                            {requestEmailChangeMutation.isPending ? "Envoi..." : "Changer l'email"}
                          </Button>
                        </form>
                      </div>

                      {/* Password Change */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5" /> Changer le mot de passe
                        </h4>
                        <form onSubmit={handleChangePassword} className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="currentPassword" className="text-xs">Actuel</Label>
                              <Input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Actuel"
                                data-testid="input-current-password"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="newPassword" className="text-xs">Nouveau</Label>
                              <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Nouveau"
                                data-testid="input-new-password"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="confirmPassword" className="text-xs">Confirmer</Label>
                              <Input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirmer"
                                data-testid="input-confirm-password"
                              />
                            </div>
                          </div>
                          <Button 
                            type="submit" 
                            size="sm"
                            disabled={changePasswordMutation.isPending}
                            data-testid="button-change-password"
                          >
                            {changePasswordMutation.isPending ? "Modification..." : "Changer le mot de passe"}
                          </Button>
                        </form>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Team Section */}
          {activeSection === "team" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Mon equipe</h2>
                  <p className="text-muted-foreground">Gerez les membres de votre equipe</p>
                </div>
              </div>

              {teamLoading || canCreateLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !canCreateTeamData?.canCreate ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">Fonctionnalite reservee</h3>
                      <p className="text-muted-foreground mb-4">
                        Vous devez avoir au moins un toolkit pour creer une equipe.
                      </p>
                      <Link href="/#toolkits">
                        <Button data-testid="button-browse-toolkits-team">
                          Decouvrir nos toolkits
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : !teamData?.team ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Creer votre equipe
                    </CardTitle>
                    <CardDescription>
                      Creez une equipe pour suivre les audits de securite de votre parc informatique
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={(e) => { e.preventDefault(); if (teamName.trim()) createTeamMutation.mutate(teamName); }} className="flex gap-3">
                      <Input
                        placeholder="Nom de l'equipe"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        data-testid="input-team-name"
                        className="max-w-sm"
                      />
                      <Button type="submit" disabled={createTeamMutation.isPending || !teamName.trim()} data-testid="button-create-team">
                        {createTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Creer l'equipe"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Team Info Card */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          {editingTeamName ? (
                            <form onSubmit={(e) => { e.preventDefault(); if (teamName.trim()) updateTeamMutation.mutate({ id: teamData.team!.id, name: teamName }); }} className="flex gap-2">
                              <Input
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                className="max-w-[200px]"
                                data-testid="input-edit-team-name"
                              />
                              <Button type="submit" size="sm" disabled={updateTeamMutation.isPending} data-testid="button-save-team-name">
                                {updateTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauver"}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingTeamName(false); setTeamName(""); }} data-testid="button-cancel-edit">
                                Annuler
                              </Button>
                            </form>
                          ) : (
                            <div>
                              <CardTitle className="flex items-center gap-2">
                                {teamData.team.name}
                                <Button variant="ghost" size="icon" onClick={() => { setTeamName(teamData.team!.name); setEditingTeamName(true); }} data-testid="button-edit-team-name">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </CardTitle>
                              <CardDescription>
                                Creee le {new Date(teamData.team.createdAt).toLocaleDateString('fr-FR')}
                              </CardDescription>
                            </div>
                          )}
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => { if (confirm("Supprimer cette equipe et tous ses membres ?")) deleteTeamMutation.mutate(teamData.team!.id); }} disabled={deleteTeamMutation.isPending} data-testid="button-delete-team">
                          {deleteTeamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Add Member Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Ajouter un membre
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={(e) => { e.preventDefault(); if (newMemberEmail.trim()) addMemberMutation.mutate({ teamId: teamData.team!.id, email: newMemberEmail, name: newMemberName || undefined, role: newMemberRole }); }} className="flex flex-wrap gap-3">
                        <Input
                          type="email"
                          placeholder="Email du membre"
                          value={newMemberEmail}
                          onChange={(e) => setNewMemberEmail(e.target.value)}
                          className="max-w-[240px]"
                          data-testid="input-member-email"
                        />
                        <Input
                          placeholder="Nom (optionnel)"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          className="max-w-[180px]"
                          data-testid="input-member-name"
                        />
                        <select
                          value={newMemberRole}
                          onChange={(e) => setNewMemberRole(e.target.value)}
                          className="px-3 py-2 border rounded-md text-sm"
                          data-testid="select-member-role"
                        >
                          <option value="member">Membre</option>
                          <option value="admin">Admin</option>
                        </select>
                        <Button type="submit" disabled={addMemberMutation.isPending || !newMemberEmail.trim()} data-testid="button-add-member">
                          {addMemberMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Team Members List */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        Membres ({teamData.members.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {teamData.members.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p>Aucun membre dans l'equipe</p>
                          <p className="text-sm">Ajoutez des membres pour commencer</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {teamData.members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`member-row-${member.id}`}>
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback>{member.name?.[0] || member.email[0].toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{member.name || member.email}</p>
                                  {member.name && <p className="text-sm text-muted-foreground">{member.email}</p>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                                  {member.role === "admin" ? "Admin" : "Membre"}
                                </Badge>
                                <Button variant="ghost" size="icon" onClick={() => removeMemberMutation.mutate({ teamId: teamData.team!.id, memberId: member.id })} disabled={removeMemberMutation.isPending} data-testid={`button-remove-member-${member.id}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* Purchases Section */}
          {activeSection === "purchases" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Historique des achats</h2>
                  <p className="text-muted-foreground">Consultez vos factures et abonnements</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Factures
                  </CardTitle>
                  <CardDescription>
                    Toutes vos factures liees a vos abonnements
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {invoicesLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : !invoicesData?.invoices || invoicesData.invoices.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">Aucune facture disponible</p>
                      <p className="text-sm mt-2">Vos factures apparaitront ici apres un achat</p>
                      <Link href="/#toolkits">
                        <Button className="mt-6" data-testid="button-browse-toolkits">
                          Decouvrir nos toolkits
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoicesData.invoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                          onClick={() => handleViewInvoice(invoice.id)}
                          data-testid={`invoice-row-${invoice.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-muted rounded-lg">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium" data-testid={`text-invoice-number-${invoice.id}`}>
                                {invoice.invoiceNumber}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                {new Date(invoice.createdAt).toLocaleDateString('fr-FR', { 
                                  day: 'numeric', 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-semibold text-lg" data-testid={`text-invoice-total-${invoice.id}`}>
                                {formatCurrency(invoice.totalCents)}
                              </div>
                              {getInvoiceStatusBadge(invoice.status)}
                            </div>
                            <Button variant="ghost" size="icon" data-testid={`button-view-invoice-${invoice.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Facture {viewingInvoice?.invoice.invoiceNumber}
            </DialogTitle>
            <DialogDescription>
              Details de la facture
            </DialogDescription>
          </DialogHeader>

          {viewingInvoice && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="font-medium">{viewingInvoice.invoice.customerName}</p>
                <p className="text-sm text-muted-foreground">{viewingInvoice.invoice.customerEmail}</p>
                {viewingInvoice.invoice.customerAddress && (
                  <p className="text-sm text-muted-foreground">{viewingInvoice.invoice.customerAddress}</p>
                )}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Statut</span>
                {getInvoiceStatusBadge(viewingInvoice.invoice.status)}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Date</span>
                <span>{new Date(viewingInvoice.invoice.createdAt).toLocaleDateString('fr-FR')}</span>
              </div>

              {viewingInvoice.invoice.paidAt && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Payee le</span>
                  <span className="flex items-center gap-1 text-green-500">
                    <CreditCard className="h-4 w-4" />
                    {new Date(viewingInvoice.invoice.paidAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Articles</h4>
                <div className="space-y-2">
                  {viewingInvoice.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.description}</span>
                      <span className="font-medium">{formatCurrency(item.totalCents)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sous-total HT</span>
                  <span>{formatCurrency(viewingInvoice.invoice.subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({viewingInvoice.invoice.taxRate}%)</span>
                  <span>{formatCurrency(viewingInvoice.invoice.taxCents)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(viewingInvoice.invoice.totalCents)}</span>
                </div>
              </div>

              {viewingInvoice.invoice.notes && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{viewingInvoice.invoice.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingInvoice(null)}>
              Fermer
            </Button>
            <Button onClick={handlePrintInvoice} data-testid="button-print-invoice">
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
