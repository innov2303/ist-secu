import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useState, useRef } from "react";
import { 
  Users, 
  Monitor, 
  Shield, 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  LayoutDashboard,
  Server,
  Settings,
  FileText,
  TrendingUp,
  LogOut,
  ChevronRight,
  Upload,
  Trash2,
  Eye,
  Download,
  X,
  FileJson,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface Machine {
  id: number;
  teamId: number;
  hostname: string;
  machineId?: string;
  os: string;
  osVersion?: string;
  lastAuditDate?: string;
  lastScore?: number;
  lastGrade?: string;
  totalAudits: number;
  createdAt: string;
}

interface AuditReport {
  id: number;
  machineId: number;
  uploadedBy: string;
  auditDate: string;
  scriptName?: string;
  scriptVersion?: string;
  score: number;
  grade?: string;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  warningControls: number;
  fileName?: string;
  createdAt: string;
  hostname?: string;
  os?: string;
}

interface FleetStats {
  totalMachines: number;
  totalReports: number;
  averageScore: number | null;
  lastAuditDate: string | null;
  osCounts: Record<string, number>;
}

type TabType = "dashboard" | "machines" | "reports" | "team" | "settings";

export default function Suivi() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<AuditReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: team, isLoading: teamLoading } = useQuery<Team>({
    queryKey: ["/api/teams/my-team"],
    enabled: !!user,
  });

  const { data: membership, isLoading: membershipLoading } = useQuery<TeamMembership>({
    queryKey: ["/api/teams/my-membership"],
    enabled: !!user,
  });

  const { data: stats } = useQuery<FleetStats>({
    queryKey: ["/api/fleet/stats"],
    enabled: !!user,
  });

  const { data: machinesData } = useQuery<{ machines: Machine[] }>({
    queryKey: ["/api/fleet/machines"],
    enabled: !!user,
  });

  const { data: reportsData } = useQuery<{ reports: AuditReport[] }>({
    queryKey: ["/api/fleet/reports"],
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { jsonContent: string; htmlContent?: string; fileName: string }) => {
      const res = await apiRequest("POST", "/api/fleet/upload-report", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Rapport importe",
        description: data.message || "Le rapport a ete importe avec succes",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de l'import du rapport",
        variant: "destructive",
      });
    },
  });

  const deleteMachineMutation = useMutation({
    mutationFn: async (machineId: number) => {
      await apiRequest("DELETE", `/api/fleet/machines/${machineId}`);
    },
    onSuccess: () => {
      toast({ title: "Machine supprimee" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: number) => {
      await apiRequest("DELETE", `/api/fleet/reports/${reportId}`);
    },
    onSuccess: () => {
      toast({ title: "Rapport supprime" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
    },
  });

  const isLoading = authLoading || teamLoading || membershipLoading;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.json')) {
        try {
          const content = await file.text();
          await uploadMutation.mutateAsync({
            jsonContent: content,
            fileName: file.name,
          });
        } catch (e) {
          console.error("Error uploading file:", e);
        }
      }
    }
    
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "--";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getGradeColor = (grade?: string) => {
    switch (grade) {
      case 'A': return 'text-green-600 bg-green-100';
      case 'B': return 'text-blue-600 bg-blue-100';
      case 'C': return 'text-yellow-600 bg-yellow-100';
      case 'D': return 'text-orange-600 bg-orange-100';
      case 'E': case 'F': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getOSIcon = (os: string) => {
    switch (os.toLowerCase()) {
      case 'windows': return 'W';
      case 'linux': return 'L';
      case 'vmware': return 'V';
      case 'docker': return 'D';
      case 'netapp': return 'N';
      default: return '?';
    }
  };

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
                <Server className="w-10 h-10 text-primary" />
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

  const machines = machinesData?.machines || [];
  const reports = reportsData?.reports || [];

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
              {(activeTab === "reports" || activeTab === "machines" || activeTab === "dashboard") && hasFullAccess && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".json"
                    multiple
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-report"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? "Import en cours..." : "Importer un rapport"}
                  </Button>
                </>
              )}
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
                    <div className="text-3xl font-bold">{stats?.totalMachines || 0}</div>
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
                    <div className="text-3xl font-bold">{stats?.totalReports || 0}</div>
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
                    <div className="text-3xl font-bold">
                      {stats?.averageScore != null ? `${stats.averageScore}%` : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats?.averageScore != null ? "Moyenne globale" : "Aucun audit"}
                    </p>
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
                    <div className="text-xl font-bold truncate">
                      {stats?.lastAuditDate ? formatDate(stats.lastAuditDate).split(' ')[0] : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats?.lastAuditDate ? formatDate(stats.lastAuditDate).split(' ')[1] : "Aucun historique"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Graphiques */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Check className="h-4 w-4" />
                      Repartition par OS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats?.osCounts && Object.keys(stats.osCounts).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(stats.osCounts).map(([os, count]) => (
                          <div key={os}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="capitalize">{os}</span>
                              <span>{count} ({Math.round((count / stats.totalMachines) * 100)}%)</span>
                            </div>
                            <Progress value={(count / stats.totalMachines) * 100} className="h-2" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Monitor className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm">Aucune machine enregistree</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4" />
                      Derniers audits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reports.length > 0 ? (
                      <div className="space-y-2">
                        {reports.slice(0, 5).map((report) => (
                          <div key={report.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                                {getOSIcon(report.os || 'unknown')}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{report.hostname}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(report.auditDate)}</p>
                              </div>
                            </div>
                            <Badge className={getGradeColor(report.grade)}>
                              {report.score}% ({report.grade})
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm">Aucun rapport disponible</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Instructions d'import */}
              {machines.length === 0 && (
                <Card className="border-dashed border-2">
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <FileJson className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-2">Importez vos rapports d'audit</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md">
                        Executez vos scripts d'audit sur vos machines, puis importez les fichiers JSON generes pour suivre l'evolution de la securite de votre parc.
                      </p>
                      <Button onClick={() => fileInputRef.current?.click()} data-testid="button-first-upload">
                        <Upload className="w-4 h-4 mr-2" />
                        Importer un rapport JSON
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                    Machines enregistrees ({machines.length})
                  </CardTitle>
                  <CardDescription>
                    Liste des machines de votre parc informatique
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {machines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Server className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">Aucune machine enregistree</p>
                      <p className="text-sm mb-4">Importez un rapport JSON pour enregistrer vos machines</p>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        Importer un rapport
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Machine</TableHead>
                          <TableHead>OS</TableHead>
                          <TableHead>Dernier audit</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Audits</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {machines.map((machine) => (
                          <TableRow key={machine.id} data-testid={`machine-row-${machine.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                                  {getOSIcon(machine.os)}
                                </div>
                                <div>
                                  <p className="font-medium">{machine.hostname}</p>
                                  {machine.machineId && (
                                    <p className="text-xs text-muted-foreground truncate max-w-32">
                                      {machine.machineId}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="capitalize">{machine.os}</span>
                              {machine.osVersion && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({machine.osVersion})
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(machine.lastAuditDate)}</TableCell>
                            <TableCell>
                              {machine.lastScore != null ? (
                                <Badge className={getGradeColor(machine.lastGrade)}>
                                  {machine.lastScore}% ({machine.lastGrade})
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </TableCell>
                            <TableCell>{machine.totalAudits}</TableCell>
                            <TableCell className="text-right">
                              {hasFullAccess && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm(`Supprimer la machine "${machine.hostname}" et tous ses rapports ?`)) {
                                      deleteMachineMutation.mutate(machine.id);
                                    }
                                  }}
                                  data-testid={`button-delete-machine-${machine.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
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
                    Rapports d'audit ({reports.length})
                  </CardTitle>
                  <CardDescription>
                    Historique de tous les rapports generes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">Aucun rapport disponible</p>
                      <p className="text-sm mb-4">Importez vos rapports JSON pour commencer le suivi</p>
                      <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        Importer un rapport
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Machine</TableHead>
                          <TableHead>Date d'audit</TableHead>
                          <TableHead>Script</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Controles</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.map((report) => (
                          <TableRow key={report.id} data-testid={`report-row-${report.id}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                                  {getOSIcon(report.os || 'unknown')}
                                </div>
                                <span className="font-medium">{report.hostname || `Machine #${report.machineId}`}</span>
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(report.auditDate)}</TableCell>
                            <TableCell>
                              {report.scriptName || "Script inconnu"}
                              {report.scriptVersion && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  v{report.scriptVersion}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={getGradeColor(report.grade)}>
                                {report.score}% ({report.grade})
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs">
                                <span className="text-green-600">{report.passedControls}</span>
                                <span>/</span>
                                <span className="text-red-600">{report.failedControls}</span>
                                <span>/</span>
                                <span>{report.totalControls}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedReport(report);
                                    setShowReportDialog(true);
                                  }}
                                  data-testid={`button-view-report-${report.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {hasFullAccess && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      if (confirm("Supprimer ce rapport ?")) {
                                        deleteReportMutation.mutate(report.id);
                                      }
                                    }}
                                    data-testid={`button-delete-report-${report.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
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

      {/* Dialog for viewing report details */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Details du rapport
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.hostname} - {formatDate(selectedReport?.auditDate)}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Score</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{selectedReport.score}%</span>
                    <Badge className={getGradeColor(selectedReport.grade)}>
                      {selectedReport.grade}
                    </Badge>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Script</p>
                  <p className="font-medium">{selectedReport.scriptName || "Inconnu"}</p>
                  {selectedReport.scriptVersion && (
                    <p className="text-xs text-muted-foreground">v{selectedReport.scriptVersion}</p>
                  )}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">Resultats des controles</p>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xl font-bold">{selectedReport.totalControls}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-600">{selectedReport.passedControls}</p>
                    <p className="text-xs text-muted-foreground">Reussis</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-red-600">{selectedReport.failedControls}</p>
                    <p className="text-xs text-muted-foreground">Echoues</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-yellow-600">{selectedReport.warningControls}</p>
                    <p className="text-xs text-muted-foreground">Avertissements</p>
                  </div>
                </div>
              </div>
              
              {selectedReport.fileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileJson className="w-4 h-4" />
                  <span>Fichier: {selectedReport.fileName}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
