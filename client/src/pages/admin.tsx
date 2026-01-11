import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Shield, ShieldOff, Trash2, Users, ArrowLeft, MessageSquare, CheckCircle, Clock, Mail } from "lucide-react";
import type { User } from "@shared/models/auth";
import type { ContactRequest } from "@shared/schema";
import { Link } from "wouter";

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  const { data: contactRequests, isLoading: contactLoading } = useQuery<ContactRequest[]>({
    queryKey: ["/api/admin/contact-requests"],
    enabled: !!user?.isAdmin,
  });

  const updateContactStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/admin/contact-requests/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-requests"] });
      toast({ title: "Statut mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/contact-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contact-requests"] });
      toast({ title: "Demande supprimée" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la demande", variant: "destructive" });
    },
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/toggle-admin`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utilisateur mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier l'utilisateur", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Utilisateur supprimé" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Accès refusé</h1>
        <p className="text-muted-foreground mb-6">Vous devez être connecté pour accéder à cette page.</p>
        <Button asChild>
          <a href="/api/login">Se connecter</a>
        </Button>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Accès refusé</h1>
        <p className="text-muted-foreground mb-6">Vous n'avez pas les droits administrateur.</p>
        <Button asChild variant="outline">
          <Link href="/">Retour à l'accueil</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8" />
            Gestion des utilisateurs
          </h1>
          <p className="text-muted-foreground">Gérer les comptes et les permissions administrateur</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs enregistrés</CardTitle>
          <CardDescription>
            {users?.length || 0} utilisateur(s) dans le système
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {users?.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  data-testid={`row-user-${u.id}`}
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={u.profileImageUrl || undefined} />
                      <AvatarFallback>
                        {u.firstName?.[0] || u.email?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {u.firstName} {u.lastName}
                        {u.isAdmin && (
                          <Badge variant="default" className="text-xs">
                            Admin
                          </Badge>
                        )}
                        {u.id === user.id && (
                          <Badge variant="secondary" className="text-xs">
                            Vous
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={u.isAdmin ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleAdminMutation.mutate(u.id)}
                      disabled={u.id === user.id || toggleAdminMutation.isPending}
                      data-testid={`button-toggle-admin-${u.id}`}
                    >
                      {u.isAdmin ? (
                        <>
                          <ShieldOff className="h-4 w-4 mr-1" />
                          Retirer admin
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4 mr-1" />
                          Rendre admin
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deleteUserMutation.mutate(u.id)}
                      disabled={u.id === user.id || deleteUserMutation.isPending}
                      data-testid={`button-delete-user-${u.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Requests Section */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Demandes de contact
          </CardTitle>
          <CardDescription>
            {contactRequests?.filter(c => c.status === "pending").length || 0} demande(s) en attente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contactLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : contactRequests?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune demande de contact</p>
          ) : (
            <div className="space-y-4">
              {contactRequests?.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border bg-card"
                  data-testid={`row-contact-${request.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs font-mono">{request.ticketNumber}</Badge>
                        <span className="font-medium">{request.name}</span>
                        <a href={`mailto:${request.email}`} className="text-sm text-primary flex items-center gap-1 hover:underline">
                          <Mail className="h-3 w-3" />
                          {request.email}
                        </a>
                        <Badge variant={request.status === "pending" ? "secondary" : "default"} className="text-xs">
                          {request.status === "pending" ? (
                            <><Clock className="h-3 w-3 mr-1" /> En attente</>
                          ) : (
                            <><CheckCircle className="h-3 w-3 mr-1" /> Traité</>
                          )}
                        </Badge>
                      </div>
                      <div className="text-sm font-medium">{request.subject}</div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.description}</p>
                      <div className="text-xs text-muted-foreground">
                        {new Date(request.createdAt).toLocaleString('fr-FR')}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {request.status === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => updateContactStatusMutation.mutate({ id: request.id, status: "resolved" })}
                          disabled={updateContactStatusMutation.isPending}
                          data-testid={`button-resolve-${request.id}`}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Marquer traité
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateContactStatusMutation.mutate({ id: request.id, status: "pending" })}
                            disabled={updateContactStatusMutation.isPending}
                            data-testid={`button-unresolve-${request.id}`}
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            Rouvrir
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteContactMutation.mutate(request.id)}
                            disabled={deleteContactMutation.isPending}
                            data-testid={`button-delete-contact-${request.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Supprimer
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
