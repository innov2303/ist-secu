import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Trash2, Users, ArrowLeft, MessageSquare, CheckCircle, Clock, Mail, Search, 
  ChevronLeft, ChevronRight, Package, Shield, Home, Settings, Pencil, Loader2,
  AlertTriangle, Power, Wrench
} from "lucide-react";
import type { User } from "@shared/models/auth";
import type { ContactRequest, Script } from "@shared/schema";
import { Link } from "wouter";

const ITEMS_PER_PAGE = 10;

type AdminSection = "users" | "tickets" | "toolkits";
type ScriptStatus = "active" | "offline" | "maintenance";

const statusLabels: Record<ScriptStatus, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Power }> = {
  active: { label: "Actif", variant: "default", icon: Power },
  offline: { label: "Offline", variant: "destructive", icon: AlertTriangle },
  maintenance: { label: "En maintenance", variant: "secondary", icon: Wrench },
};

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSection>("users");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [contactSearch, setContactSearch] = useState("");
  const [contactPage, setContactPage] = useState(1);
  const [scriptSearch, setScriptSearch] = useState("");
  const [scriptPage, setScriptPage] = useState(1);
  
  // Script editing state
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStatus, setEditStatus] = useState<ScriptStatus>("active");

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  const { data: contactRequests, isLoading: contactLoading } = useQuery<ContactRequest[]>({
    queryKey: ["/api/admin/contact-requests"],
    enabled: !!user?.isAdmin,
  });

  const { data: scripts, isLoading: scriptsLoading } = useQuery<Script[]>({
    queryKey: ["/api/scripts"],
    enabled: !!user?.isAdmin,
  });

  // Users filtering and pagination
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!userSearch.trim()) return users;
    const search = userSearch.toLowerCase();
    return users.filter(u => 
      u.firstName?.toLowerCase().includes(search) ||
      u.lastName?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search)
    );
  }, [users, userSearch]);

  const totalUserPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, userPage]);

  // Contact requests filtering and pagination
  const filteredContacts = useMemo(() => {
    if (!contactRequests) return [];
    if (!contactSearch.trim()) return contactRequests;
    const search = contactSearch.toLowerCase();
    return contactRequests.filter(c => 
      c.name?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.subject?.toLowerCase().includes(search) ||
      c.ticketNumber?.toLowerCase().includes(search)
    );
  }, [contactRequests, contactSearch]);

  const totalContactPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  const paginatedContacts = useMemo(() => {
    const start = (contactPage - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredContacts, contactPage]);

  // Scripts filtering and pagination
  const filteredScripts = useMemo(() => {
    if (!scripts) return [];
    if (!scriptSearch.trim()) return scripts;
    const search = scriptSearch.toLowerCase();
    return scripts.filter(s => 
      s.name?.toLowerCase().includes(search) ||
      s.os?.toLowerCase().includes(search)
    );
  }, [scripts, scriptSearch]);

  const totalScriptPages = Math.ceil(filteredScripts.length / ITEMS_PER_PAGE);
  const paginatedScripts = useMemo(() => {
    const start = (scriptPage - 1) * ITEMS_PER_PAGE;
    return filteredScripts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredScripts, scriptPage]);

  // Mutations
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

  const updateScriptMutation = useMutation({
    mutationFn: async ({ id, name, monthlyPriceCents, status }: { id: number; name?: string; monthlyPriceCents?: number; status?: string }) => {
      await apiRequest("PATCH", `/api/admin/scripts/${id}`, { name, monthlyPriceCents, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      toast({ title: "Toolkit mis à jour" });
      setEditingScript(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le toolkit", variant: "destructive" });
    },
  });

  const openEditDialog = (script: Script) => {
    setEditingScript(script);
    setEditName(script.name);
    setEditPrice(String(script.monthlyPriceCents / 100));
    setEditStatus((script.status as ScriptStatus) || "active");
  };

  const handleSaveScript = () => {
    if (!editingScript) return;
    
    const priceInCents = Math.round(parseFloat(editPrice) * 100);
    if (isNaN(priceInCents) || priceInCents < 0) {
      toast({ title: "Erreur", description: "Prix invalide", variant: "destructive" });
      return;
    }
    
    updateScriptMutation.mutate({
      id: editingScript.id,
      name: editName,
      monthlyPriceCents: priceInCents,
      status: editStatus,
    });
  };

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
          <a href="/auth">Se connecter</a>
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

  const sidebarItems = [
    { id: "users" as AdminSection, label: "Utilisateurs", icon: Users, count: users?.length },
    { id: "tickets" as AdminSection, label: "Gestion des tickets", icon: MessageSquare, count: contactRequests?.filter(c => c.status === "pending").length },
    { id: "toolkits" as AdminSection, label: "Gestion des toolkit", icon: Package, count: scripts?.length },
  ];

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Fixed Sidebar */}
      <aside className="w-64 bg-card border-r flex flex-col fixed h-screen z-50">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-bold text-lg">Administration</h1>
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
              <AvatarImage src={user.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">
                {user.firstName?.[0] || user.email?.[0] || "A"}
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
          {/* Users Section */}
          {activeSection === "users" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Utilisateurs</h2>
                  <p className="text-muted-foreground">Gérer les comptes utilisateurs</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Utilisateurs enregistrés</CardTitle>
                      <CardDescription>
                        {filteredUsers.length} sur {users?.length || 0} utilisateur(s)
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={userSearch}
                        onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                        className="pl-9"
                        data-testid="input-user-search"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : paginatedUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {userSearch ? "Aucun utilisateur trouvé" : "Aucun utilisateur"}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {paginatedUsers.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
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
                                  <Badge variant="default" className="text-xs">Admin</Badge>
                                )}
                                {u.id === user.id && (
                                  <Badge variant="secondary" className="text-xs">Vous</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
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
                      ))}
                    </div>
                  )}
                  {totalUserPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">Page {userPage} sur {totalUserPages}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => Math.max(1, p - 1))}
                          disabled={userPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                          disabled={userPage === totalUserPages}
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tickets Section */}
          {activeSection === "tickets" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Gestion des tickets</h2>
                  <p className="text-muted-foreground">Demandes de contact et support</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Demandes de contact</CardTitle>
                      <CardDescription>
                        {filteredContacts.filter(c => c.status === "pending").length} en attente sur {filteredContacts.length} demande(s)
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={contactSearch}
                        onChange={(e) => { setContactSearch(e.target.value); setContactPage(1); }}
                        className="pl-9"
                        data-testid="input-contact-search"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {contactLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : paginatedContacts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {contactSearch ? "Aucune demande trouvée" : "Aucune demande de contact"}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {paginatedContacts.map((request) => (
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
                  {totalContactPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">Page {contactPage} sur {totalContactPages}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setContactPage(p => Math.max(1, p - 1))}
                          disabled={contactPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setContactPage(p => Math.min(totalContactPages, p + 1))}
                          disabled={contactPage === totalContactPages}
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Toolkits Section */}
          {activeSection === "toolkits" && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <h2 className="text-2xl font-bold">Gestion des toolkit</h2>
                  <p className="text-muted-foreground">Scripts de sécurité disponibles</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Toolkit disponibles</CardTitle>
                      <CardDescription>
                        {filteredScripts.length} toolkit(s) configuré(s)
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={scriptSearch}
                        onChange={(e) => { setScriptSearch(e.target.value); setScriptPage(1); }}
                        className="pl-9"
                        data-testid="input-script-search"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {scriptsLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : paginatedScripts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      {scriptSearch ? "Aucun toolkit trouvé" : "Aucun toolkit configuré"}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {paginatedScripts.map((script) => {
                        const status = (script.status as ScriptStatus) || "active";
                        const statusInfo = statusLabels[status];
                        const StatusIcon = statusInfo.icon;
                        
                        return (
                          <div
                            key={script.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover-elevate"
                            data-testid={`row-script-${script.id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Shield className="h-5 w-5 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium flex items-center gap-2 flex-wrap">
                                  {script.name}
                                  <Badge variant="outline" className="text-xs">{script.os}</Badge>
                                  <Badge variant={statusInfo.variant} className="text-xs">
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  {script.description}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <div className="font-medium text-primary">
                                  {formatPrice(script.monthlyPriceCents)}/mois
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  ID: {script.id}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => openEditDialog(script)}
                                data-testid={`button-edit-script-${script.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {totalScriptPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">Page {scriptPage} sur {totalScriptPages}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setScriptPage(p => Math.max(1, p - 1))}
                          disabled={scriptPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Précédent
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setScriptPage(p => Math.min(totalScriptPages, p + 1))}
                          disabled={scriptPage === totalScriptPages}
                        >
                          Suivant
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* Edit Script Dialog */}
      <Dialog open={!!editingScript} onOpenChange={(open) => !open && setEditingScript(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le toolkit</DialogTitle>
            <DialogDescription>
              Modifiez les informations du toolkit ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nom du toolkit</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nom du toolkit"
                data-testid="input-edit-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price">Prix mensuel (EUR)</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="300.00"
                data-testid="input-edit-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Statut</Label>
              <Select value={editStatus} onValueChange={(value) => setEditStatus(value as ScriptStatus)}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <Power className="h-4 w-4 text-green-500" />
                      Actif
                    </div>
                  </SelectItem>
                  <SelectItem value="offline">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Offline
                    </div>
                  </SelectItem>
                  <SelectItem value="maintenance">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-orange-500" />
                      En maintenance
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingScript(null)} data-testid="button-cancel-edit">
              Annuler
            </Button>
            <Button onClick={handleSaveScript} disabled={updateScriptMutation.isPending} data-testid="button-save-script">
              {updateScriptMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
