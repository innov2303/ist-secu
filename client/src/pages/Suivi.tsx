import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useState } from "react";
import { 
  Construction, 
  Users, 
  Monitor, 
  Shield, 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  LayoutDashboard,
  Server,
  Settings,
  FileText,
  TrendingUp,
  LogOut,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TeamMembership {
  teamId: number;
  teamName: string;
  role: string;
  ownerId: string;
  ownerName: string;
}

interface Team {
  id: number;
  name: string;
  ownerId: string;
  members: TeamMember[];
}

interface TeamMember {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

type TabType = "dashboard" | "machines" | "reports" | "team" | "settings";

export default function Suivi() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [, setLocation] = useLocation();

  const { data: team, isLoading: teamLoading } = useQuery<Team>({
    queryKey: ["/api/teams/my-team"],
    enabled: !!user,
  });

  const { data: membership, isLoading: membershipLoading } = useQuery<TeamMembership>({
    queryKey: ["/api/teams/my-membership"],
    enabled: !!user,
  });

  const isLoading = authLoading || teamLoading || membershipLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="w-64 border-r bg-card p-4">
          <Skeleton className="h-10 w-full mb-8" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-2" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Connexion requise</h2>
            <p className="text-muted-foreground mb-4">
              Connectez-vous pour acceder au suivi de votre parc
            </p>
            <Button asChild>
              <Link href="/">Retour a l'accueil</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user.isAdmin;
  const isTeamOwner = !!team && team.ownerId === user.id;
  const isTeamMember = !!membership && membership.ownerId !== user.id;
  const memberRole = membership?.role || "member";
  const hasTeamAccess = isAdmin || isTeamOwner || isTeamMember;
  const hasFullAccess = isAdmin || isTeamOwner || memberRole === "admin";

  if (!hasTeamAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <Card className="border-primary/20">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mx-auto mb-6">
                <Construction className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Suivi de votre parc</h1>
              <p className="text-muted-foreground mb-6">
                Tableau de bord de suivi
              </p>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">Equipe requise</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Creez une equipe ou rejoignez une equipe existante pour acceder au suivi du parc.
                </p>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button asChild variant="outline">
                  <Link href="/">Retour a l'accueil</Link>
                </Button>
                <Button asChild>
                  <Link href="/profile">
                    <Users className="w-4 h-4 mr-2" />
                    Gerer mon equipe
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard" as TabType, label: "Tableau de bord", icon: LayoutDashboard },
    { id: "machines" as TabType, label: "Machines", icon: Server },
    { id: "reports" as TabType, label: "Rapports", icon: FileText },
  ];

  const adminNavItems = [
    { id: "team" as TabType, label: "Equipe", icon: Users },
    { id: "settings" as TabType, label: "Parametres", icon: Settings },
  ];

  const teamName = isAdmin && !isTeamOwner && !isTeamMember 
    ? "Administration" 
    : isTeamOwner 
      ? team?.name 
      : membership?.teamName;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar fixe */}
      <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
        {/* Header sidebar */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-sm truncate">Suivi du Parc</h2>
              <p className="text-xs text-muted-foreground truncate">{teamName}</p>
            </div>
          </div>
        </div>

        {/* Navigation principale */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="mb-6">
            <p className="text-xs font-medium text-muted-foreground px-3 mb-2">Navigation</p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {activeTab === item.id && (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {hasFullAccess && (
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground px-3 mb-2">Administration</p>
              <div className="space-y-1">
                {adminNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === item.id 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    data-testid={`nav-${item.id}`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                    {activeTab === item.id && (
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Footer sidebar */}
        <div className="p-3 border-t">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Retour au site
          </Button>
        </div>
      </aside>

      {/* Contenu principal */}
      <main className="flex-1 overflow-auto">
        {/* Header principal */}
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                {activeTab === "dashboard" && "Tableau de bord"}
                {activeTab === "machines" && "Machines"}
                {activeTab === "reports" && "Rapports"}
                {activeTab === "team" && "Equipe"}
                {activeTab === "settings" && "Parametres"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeTab === "dashboard" && "Vue d'ensemble de votre parc informatique"}
                {activeTab === "machines" && "Gestion des machines enregistrees"}
                {activeTab === "reports" && "Historique des rapports d'audit"}
                {activeTab === "team" && "Gestion des membres de l'equipe"}
                {activeTab === "settings" && "Configuration du suivi"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Badge variant="default" className="bg-red-600">
                  Administrateur
                </Badge>
              )}
              {isTeamOwner && !isAdmin && (
                <Badge variant="default" className="bg-green-600">
                  Proprietaire
                </Badge>
              )}
              {isTeamMember && !isAdmin && (
                <Badge variant={memberRole === "admin" ? "default" : "secondary"}>
                  {memberRole === "admin" ? "Admin equipe" : "Membre"}
                </Badge>
              )}
            </div>
          </div>
        </header>

        {/* Contenu des onglets */}
        <div className="p-6">
          {!hasFullAccess && (
            <Card className="mb-6 bg-blue-500/5 border-blue-500/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">
                    Acces en lecture seule - Contactez un administrateur de l'equipe pour modifier les donnees
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Machines
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Total des machines</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Audits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Rapports generes</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Score moyen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">--</div>
                    <p className="text-xs text-muted-foreground">Aucun audit</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Dernier audit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">--</div>
                    <p className="text-xs text-muted-foreground">Aucun historique</p>
                  </CardContent>
                </Card>
              </div>

              {/* Taux de succes par solution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CheckCircle className="h-4 w-4" />
                      Taux de succes par solution
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">Aucune donnee disponible</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4" />
                      Suivi des scores
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Windows</span>
                          <span>0 (0%)</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Linux</span>
                          <span>0 (0%)</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">VMware</span>
                          <span>0 (0%)</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* En developpement */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Construction className="h-5 w-5 text-primary" />
                    En developpement
                  </CardTitle>
                  <CardDescription>
                    Le suivi complet du parc sera bientot disponible
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-6">
                    <div className="max-w-md">
                      <h3 className="font-semibold mb-3">Fonctionnalites a venir</h3>
                      <ul className="text-sm text-muted-foreground space-y-2">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          Enregistrement des machines (identifiant unique)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          Historique des audits par machine
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          Graphiques d'evolution des scores
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          Export des rapports consolides
                        </li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Machines */}
          {activeTab === "machines" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Machines enregistrees
                  </CardTitle>
                  <CardDescription>
                    Liste des machines de votre parc informatique
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Server className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-1">Aucune machine enregistree</p>
                    <p className="text-sm">Les machines apparaitront ici apres l'execution d'un audit</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Reports */}
          {activeTab === "reports" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Rapports d'audit
                  </CardTitle>
                  <CardDescription>
                    Historique de tous les rapports generes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-1">Aucun rapport disponible</p>
                    <p className="text-sm">Les rapports apparaitront ici apres l'execution d'un audit</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Team */}
          {activeTab === "team" && hasFullAccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Membres de l'equipe
                  </CardTitle>
                  <CardDescription>
                    {team ? `${team.members.length} membre${team.members.length > 1 ? "s" : ""} dans l'equipe` : "Gestion des membres"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!team || team.members.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Users className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">Aucun membre dans l'equipe</p>
                      <p className="text-sm mb-4">Ajoutez des membres pour partager l'acces au suivi</p>
                      <Button variant="outline" asChild>
                        <Link href="/profile">Ajouter des membres</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {team.members.map((member) => (
                        <div 
                          key={member.id} 
                          className="flex items-center justify-between p-3 rounded-lg border"
                          data-testid={`team-member-${member.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {member.firstName?.[0] || member.email?.[0]?.toUpperCase() || "?"}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">
                                {member.firstName && member.lastName 
                                  ? `${member.firstName} ${member.lastName}` 
                                  : member.email}
                              </p>
                              {member.firstName && <p className="text-sm text-muted-foreground">{member.email}</p>}
                            </div>
                          </div>
                          <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                            {member.role === "admin" ? "Admin" : "Membre"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Settings */}
          {activeTab === "settings" && hasFullAccess && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Parametres
                  </CardTitle>
                  <CardDescription>
                    Configuration du suivi de parc
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Settings className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium mb-1">Parametres a venir</p>
                    <p className="text-sm">Les options de configuration seront bientot disponibles</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
