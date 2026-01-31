import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Construction, ArrowLeft, Users, Monitor, Shield, BarChart3, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

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

export default function Suivi() {
  const { user, isLoading: authLoading } = useAuth();

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
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-4xl">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
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
                En developpement
              </p>
              <div className="bg-muted/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  Cette fonctionnalite vous permettra de suivre l'evolution du niveau de securite de l'ensemble de vos machines au fil des audits.
                </p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium text-sm">Equipe requise</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Creez une equipe ou rejoignez une equipe existante pour acceder au suivi du parc.
                </p>
              </div>
              <p className="text-primary font-medium mb-6">
                Prochainement disponible
              </p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button asChild variant="outline">
                  <Link href="/">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour a l'accueil
                  </Link>
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild data-testid="button-back">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Suivi de votre parc</h1>
              <p className="text-muted-foreground text-sm">
                {isAdmin && !isTeamOwner && !isTeamMember
                  ? "Acces administrateur - Tous les parcs"
                  : isTeamOwner 
                    ? `Equipe: ${team?.name}` 
                    : `Membre de: ${membership?.teamName}`}
              </p>
            </div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Machines suivies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Aucune machine enregistree</p>
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
              <p className="text-xs text-muted-foreground">Aucun audit effectue</p>
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

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5 text-primary" />
              En developpement
            </CardTitle>
            <CardDescription>
              Le suivi du parc sera bientot disponible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-6 text-center">
              <div className="max-w-md mx-auto">
                <h3 className="font-semibold mb-2">Fonctionnalites a venir</h3>
                <ul className="text-sm text-muted-foreground text-left space-y-2">
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
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    Acces partage avec l'equipe
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {isTeamOwner && team && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membres de l'equipe
              </CardTitle>
              <CardDescription>
                {team.members.length} membre{team.members.length > 1 ? "s" : ""} dans l'equipe
              </CardDescription>
            </CardHeader>
            <CardContent>
              {team.members.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="mb-2">Aucun membre dans l'equipe</p>
                  <Button variant="outline" size="sm" asChild>
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
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {member.firstName?.[0] || member.email?.[0]?.toUpperCase() || "?"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {member.firstName && member.lastName 
                              ? `${member.firstName} ${member.lastName}` 
                              : member.email}
                          </p>
                          {member.firstName && <p className="text-xs text-muted-foreground">{member.email}</p>}
                        </div>
                      </div>
                      <Badge variant={member.role === "admin" ? "default" : "secondary"} className="text-xs">
                        {member.role === "admin" ? "Admin" : "Membre"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
