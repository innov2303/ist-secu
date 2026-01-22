import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, User, Mail, Lock, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations personnelles
            </CardTitle>
            <CardDescription>
              Modifiez votre nom et prénom à tout moment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">Informations actuelles:</p>
              <p className="font-medium" data-testid="text-current-name">
                {user.firstName || "Non renseigné"} {user.lastName || ""}
              </p>
              {(user as any).companyName && (
                <p className="text-sm font-medium" data-testid="text-current-company">
                  {(user as any).companyName}
                </p>
              )}
              <p className="text-sm text-muted-foreground" data-testid="text-current-email">
                {user.email || "Email non disponible"}
              </p>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Nom de la société (optionnel)</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={(user as any).companyName || "Nom de votre entreprise"}
                  data-testid="input-company-name"
                />
                <p className="text-xs text-muted-foreground">
                  Ce nom apparaîtra sur vos factures.
                </p>
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

        {isLocalUser && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Changer d'email
                </CardTitle>
                <CardDescription>
                  Un email de vérification sera envoyé à la nouvelle adresse.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    La vérification par email sera disponible prochainement. Votre demande sera enregistrée.
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
                  Changer de mot de passe
                </CardTitle>
                <CardDescription>
                  Modifiez votre mot de passe pour sécuriser votre compte.
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
                    <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
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
                    {changePasswordMutation.isPending ? "Modification..." : "Changer le mot de passe"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
