import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, User, Mail, Lock, AlertCircle, Building2, FileText, Download, Eye, Calendar, CreditCard, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Invoice, InvoiceItem } from "@shared/schema";

export default function Profile() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [viewingInvoice, setViewingInvoice] = useState<{ invoice: Invoice; items: InvoiceItem[] } | null>(null);

  // Fetch user invoices
  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/my-invoices"],
    enabled: !!user,
  });

  const isLocalUser = (user as any)?.isLocalAuth === true;

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName?: string; lastName?: string; companyName?: string }) => {
      const res = await apiRequest("PATCH", "/api/profile", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Profil mis à jour" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setFirstName("");
      setLastName("");
      setCompanyName("");
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
        title: "Demande enregistrée", 
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
      toast({ title: "Mot de passe modifié avec succès" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() && !lastName.trim() && !companyName.trim()) {
      toast({ title: "Erreur", description: "Veuillez remplir au moins un champ", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate({
      ...(firstName.trim() && { firstName: firstName.trim() }),
      ...(lastName.trim() && { lastName: lastName.trim() }),
      ...(companyName.trim() && { companyName: companyName.trim() }),
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
      toast({ title: "Erreur", description: "Le mot de passe doit contenir au moins 6 caractères", variant: "destructive" });
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
              Veuillez vous connecter pour accéder à votre profil.
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Mon Profil</h1>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations actuelles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Identité</p>
                <p className="font-medium" data-testid="text-current-name">
                  {user.firstName || "Non renseigné"} {user.lastName || ""}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Société</p>
                <p className="font-medium" data-testid="text-current-company">
                  {(user as any).companyName || "Non renseignée"}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</p>
                <p className="font-medium" data-testid="text-current-email">
                  {user.email || "Non disponible"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Identité
              </CardTitle>
              <CardDescription>
                Modifiez votre nom et prénom.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder={user.firstName || "Nouveau prénom"}
                    data-testid="input-firstname"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder={user.lastName || "Nouveau nom"}
                    data-testid="input-lastname"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isPending}
                  data-testid="button-update-profile"
                >
                  {updateProfileMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Société
              </CardTitle>
              <CardDescription>
                Ce nom apparaîtra sur vos factures.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); if (companyName.trim()) updateProfileMutation.mutate({ companyName: companyName.trim() }); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nom de la société</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={(user as any).companyName || "Nom de votre entreprise"}
                    data-testid="input-company-name"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={updateProfileMutation.isPending || !companyName.trim()}
                  data-testid="button-update-company"
                >
                  {updateProfileMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {isLocalUser && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Changer d'email
                </CardTitle>
                <CardDescription>
                  Un email de vérification sera envoyé.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Vérification par email bientôt disponible.
                  </AlertDescription>
                </Alert>
                
                <form onSubmit={handleRequestEmailChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">Nouvel email</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="nouveau@email.com"
                      data-testid="input-new-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailPassword">Mot de passe actuel</Label>
                    <Input
                      id="emailPassword"
                      type="password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      placeholder="Confirmez votre mot de passe"
                      data-testid="input-email-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={requestEmailChangeMutation.isPending}
                    data-testid="button-request-email-change"
                  >
                    {requestEmailChangeMutation.isPending ? "Envoi..." : "Demander le changement"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Mot de passe
                </CardTitle>
                <CardDescription>
                  Modifiez votre mot de passe.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Mot de passe actuel</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Votre mot de passe actuel"
                      data-testid="input-current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      data-testid="input-new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmer</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmez le nouveau mot de passe"
                      data-testid="input-confirm-password"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={changePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    {changePasswordMutation.isPending ? "Modification..." : "Changer"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Invoice History Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Historique des factures
            </CardTitle>
            <CardDescription>
              Consultez vos factures liees a vos abonnements
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !invoicesData?.invoices || invoicesData.invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune facture disponible</p>
                <p className="text-sm mt-1">Vos factures apparaitront ici apres un achat</p>
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
                      <div className="p-2 bg-muted rounded-lg">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium" data-testid={`text-invoice-number-${invoice.id}`}>
                          {invoice.invoiceNumber}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-semibold" data-testid={`text-invoice-total-${invoice.id}`}>
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
                  <span>Total TTC</span>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingInvoice(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
