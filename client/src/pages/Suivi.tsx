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
  ChevronDown,
  Upload,
  Trash2,
  Eye,
  Download,
  X,
  FileJson,
  Check,
  Building2,
  MapPin,
  FolderTree,
  Plus,
  Folder,
  Layers
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info, Globe, HelpCircle } from "lucide-react";
import { SiLinux, SiVmware, SiDocker } from "react-icons/si";
import { FaWindows } from "react-icons/fa";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  originalScore?: number | null;
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

interface ControlCorrection {
  id: number;
  controlId: string;
  originalStatus: string;
  correctedStatus: string;
  justification: string;
  correctedAt: string;
}

interface ReportControl {
  id: string;
  category: string;
  title: string;
  status: string;
  severity: string;
  description: string;
  remediation?: string;
  reference?: string;
  correction?: ControlCorrection | null;
}

interface MachineGroup {
  id: number;
  siteId: number;
  name: string;
  description?: string;
  machines: Machine[];
}

interface Site {
  id: number;
  organizationId: number;
  name: string;
  location?: string;
  groups: MachineGroup[];
}

interface Organization {
  id: number;
  teamId: number;
  name: string;
  description?: string;
  sites: Site[];
}

interface HierarchyData {
  organizations: Organization[];
  unassignedMachines: Machine[];
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
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [machineName, setMachineName] = useState("");
  const [showControlsDialog, setShowControlsDialog] = useState(false);
  const [selectedReportForControls, setSelectedReportForControls] = useState<AuditReport | null>(null);
  const [editingControl, setEditingControl] = useState<ReportControl | null>(null);
  const [correctionJustification, setCorrectionJustification] = useState("");
  const [correctionStatus, setCorrectionStatus] = useState("PASS");
  const [controlsFilter, setControlsFilter] = useState<"all" | "PASS" | "FAIL" | "WARN">("all");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<number>>(new Set());
  const [expandedSites, setExpandedSites] = useState<Set<number>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [showAddOrgDialog, setShowAddOrgDialog] = useState(false);
  const [showAddSiteDialog, setShowAddSiteDialog] = useState(false);
  const [showAddGroupDialog, setShowAddGroupDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteLocation, setNewSiteLocation] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

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

  const { data: hierarchyData } = useQuery<HierarchyData>({
    queryKey: ["/api/fleet/hierarchy"],
    enabled: !!user,
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/fleet/organizations", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organisation creee" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      setShowAddOrgDialog(false);
      setNewOrgName("");
    },
  });

  const createSiteMutation = useMutation({
    mutationFn: async (data: { organizationId: number; name: string; location?: string }) => {
      const res = await apiRequest("POST", "/api/fleet/sites", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Site cree" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      setShowAddSiteDialog(false);
      setNewSiteName("");
      setNewSiteLocation("");
      setSelectedOrgId(null);
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (data: { siteId: number; name: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/fleet/groups", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Groupe cree" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      setShowAddGroupDialog(false);
      setNewGroupName("");
      setSelectedSiteId(null);
    },
  });

  const deleteOrgMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/fleet/organizations/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Organisation supprimee" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/fleet/sites/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Site supprime" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/fleet/groups/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Groupe supprime" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
    },
  });

  const assignMachineMutation = useMutation({
    mutationFn: async (data: { machineId: number; groupId: number | null }) => {
      await apiRequest("PUT", `/api/fleet/machines/${data.machineId}/assign`, { groupId: data.groupId });
    },
    onSuccess: () => {
      toast({ title: "Machine assignee" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { jsonContent: string; htmlContent?: string; fileName: string; machineName?: string; groupId?: number | null }) => {
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

  // Query for report controls
  const { data: reportControlsData, isLoading: isLoadingControls, refetch: refetchControls } = useQuery<{ 
    reportId: number; 
    controls: ReportControl[]; 
    totalControls: number; 
    correctedCount: number; 
  }>({
    queryKey: ["/api/fleet/reports", selectedReportForControls?.id, "controls"],
    enabled: !!selectedReportForControls,
  });

  // Mutation for saving control correction
  const saveControlCorrectionMutation = useMutation({
    mutationFn: async (data: { reportId: number; controlId: string; originalStatus: string; correctedStatus: string; justification: string }) => {
      return await apiRequest("POST", `/api/fleet/reports/${data.reportId}/corrections`, data);
    },
    onSuccess: () => {
      toast({ title: "Correction enregistree - Score mis a jour" });
      refetchControls();
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
      setEditingControl(null);
      setCorrectionJustification("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la sauvegarde",
        variant: "destructive",
      });
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.name.endsWith('.json')) {
      setUploadFile(file);
      setMachineName("");
      setShowUploadDialog(true);
    } else {
      toast({
        title: "Format invalide",
        description: "Veuillez selectionner un fichier JSON",
        variant: "destructive",
      });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmUpload = async () => {
    if (!uploadFile || !machineName.trim()) {
      toast({
        title: "Nom de machine requis",
        description: "Veuillez renseigner le nom de la machine",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const content = await uploadFile.text();
      await uploadMutation.mutateAsync({
        jsonContent: content,
        fileName: uploadFile.name,
        machineName: machineName.trim(),
        groupId: selectedGroupId,
      });
      setShowUploadDialog(false);
      setUploadFile(null);
      setMachineName("");
      setSelectedGroupId(null);
    } catch (e) {
      console.error("Error uploading file:", e);
    }
    
    setIsUploading(false);
  };

  const handleCancelUpload = () => {
    setShowUploadDialog(false);
    setUploadFile(null);
    setMachineName("");
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
    const iconClass = "w-4 h-4";
    switch (os.toLowerCase()) {
      case 'windows': return <FaWindows className={`${iconClass} text-blue-500`} />;
      case 'linux': return <SiLinux className={`${iconClass} text-orange-500`} />;
      case 'vmware': return <SiVmware className={`${iconClass} text-green-600`} />;
      case 'docker': 
      case 'container': return <SiDocker className={`${iconClass} text-blue-400`} />;
      case 'netapp': return <Server className={`${iconClass} text-purple-500`} />;
      case 'web': return <Globe className={`${iconClass} text-cyan-500`} />;
      default: return <HelpCircle className={`${iconClass} text-gray-400`} />;
    }
  };

  const toggleOrg = (id: number) => {
    const newSet = new Set(expandedOrgs);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedOrgs(newSet);
  };

  const toggleSite = (id: number) => {
    const newSet = new Set(expandedSites);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSites(newSet);
  };

  const toggleGroup = (id: number) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedGroups(newSet);
  };

  const organizations = hierarchyData?.organizations || [];
  const unassignedMachines = hierarchyData?.unassignedMachines || [];

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
                    onChange={handleFileSelect}
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
                            <div className="text-right">
                              <Badge className={getGradeColor(report.grade)}>
                                {report.score}% ({report.grade})
                              </Badge>
                              {report.originalScore != null && report.originalScore !== report.score && (
                                <p className="text-xs text-muted-foreground mt-1">Initial: {report.originalScore}%</p>
                              )}
                            </div>
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
              className="space-y-4"
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FolderTree className="h-5 w-5" />
                      Arborescence du parc ({machines.length} machines)
                    </CardTitle>
                    <CardDescription>
                      Organisation hierarchique: Organisation - Site - Groupe - Machines
                    </CardDescription>
                  </div>
                  {hasFullAccess && (
                    <Button size="sm" onClick={() => setShowAddOrgDialog(true)} data-testid="button-add-org">
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter une organisation
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {organizations.length === 0 && unassignedMachines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FolderTree className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">Aucune organisation configuree</p>
                      <p className="text-sm mb-4">Creez une organisation pour structurer votre parc</p>
                      {hasFullAccess && (
                        <Button variant="outline" onClick={() => setShowAddOrgDialog(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Creer une organisation
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Organizations tree */}
                      {organizations.map((org) => (
                        <div key={org.id} className="border rounded-lg" data-testid={`org-${org.id}`}>
                          <div 
                            className="flex items-center gap-2 p-3 hover-elevate cursor-pointer"
                            onClick={() => toggleOrg(org.id)}
                          >
                            {expandedOrgs.has(org.id) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            <Building2 className="w-5 h-5 text-primary" />
                            <span className="font-semibold">{org.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              {org.sites.reduce((acc, s) => acc + s.groups.reduce((a, g) => a + g.machines.length, 0), 0)} machines
                            </Badge>
                            {hasFullAccess && (
                              <div className="ml-auto flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={(e) => { e.stopPropagation(); setSelectedOrgId(org.id); setShowAddSiteDialog(true); }}
                                  title="Ajouter un site"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer l'organisation "${org.name}" ?`)) deleteOrgMutation.mutate(org.id); }}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </div>
                          
                          {expandedOrgs.has(org.id) && (
                            <div className="pl-6 pb-2">
                              {org.sites.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-2 pl-6">Aucun site</p>
                              ) : (
                                org.sites.map((site) => (
                                  <div key={site.id} className="ml-2 border-l-2 border-muted" data-testid={`site-${site.id}`}>
                                    <div 
                                      className="flex items-center gap-2 p-2 pl-4 hover-elevate cursor-pointer"
                                      onClick={() => toggleSite(site.id)}
                                    >
                                      {expandedSites.has(site.id) ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      )}
                                      <MapPin className="w-4 h-4 text-blue-500" />
                                      <span className="font-medium">{site.name}</span>
                                      {site.location && <span className="text-xs text-muted-foreground">({site.location})</span>}
                                      <Badge variant="outline" className="ml-2">
                                        {site.groups.reduce((a, g) => a + g.machines.length, 0)} machines
                                      </Badge>
                                      {hasFullAccess && (
                                        <div className="ml-auto flex gap-1">
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={(e) => { e.stopPropagation(); setSelectedSiteId(site.id); setShowAddGroupDialog(true); }}
                                            title="Ajouter un groupe"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </Button>
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer le site "${site.name}" ?`)) deleteSiteMutation.mutate(site.id); }}
                                          >
                                            <Trash2 className="w-3 h-3 text-destructive" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {expandedSites.has(site.id) && (
                                      <div className="pl-6">
                                        {site.groups.length === 0 ? (
                                          <p className="text-sm text-muted-foreground p-2 pl-4">Aucun groupe</p>
                                        ) : (
                                          site.groups.map((group) => (
                                            <div key={group.id} className="ml-2 border-l-2 border-muted" data-testid={`group-${group.id}`}>
                                              <div 
                                                className="flex items-center gap-2 p-2 pl-4 hover-elevate cursor-pointer"
                                                onClick={() => toggleGroup(group.id)}
                                              >
                                                {expandedGroups.has(group.id) ? (
                                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                ) : (
                                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                )}
                                                <Folder className="w-4 h-4 text-yellow-500" />
                                                <span>{group.name}</span>
                                                <Badge variant="outline" className="ml-2">{group.machines.length}</Badge>
                                                {hasFullAccess && (
                                                  <div className="ml-auto">
                                                    <Button 
                                                      size="icon" 
                                                      variant="ghost" 
                                                      onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer le groupe "${group.name}" ?`)) deleteGroupMutation.mutate(group.id); }}
                                                    >
                                                      <Trash2 className="w-3 h-3 text-destructive" />
                                                    </Button>
                                                  </div>
                                                )}
                                              </div>
                                              
                                              {expandedGroups.has(group.id) && (
                                                <div className="pl-8 pb-2">
                                                  {group.machines.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground p-2">Aucune machine</p>
                                                  ) : (
                                                    <div className="space-y-1">
                                                      {group.machines.map((machine) => (
                                                        <div key={machine.id} className="flex items-center gap-2 p-2 rounded bg-muted/30" data-testid={`machine-${machine.id}`}>
                                                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                                                            {getOSIcon(machine.os)}
                                                          </div>
                                                          <span className="font-medium text-sm">{machine.hostname}</span>
                                                          <span className="text-xs text-muted-foreground capitalize">{machine.os}</span>
                                                          {machine.lastScore != null && (
                                                            <Badge className={`text-xs ${getGradeColor(machine.lastGrade)}`}>
                                                              {machine.lastScore}%
                                                            </Badge>
                                                          )}
                                                          {hasFullAccess && (
                                                            <Button 
                                                              size="icon" 
                                                              variant="ghost" 
                                                              className="ml-auto h-6 w-6"
                                                              onClick={() => { if (confirm(`Supprimer "${machine.hostname}" ?`)) deleteMachineMutation.mutate(machine.id); }}
                                                            >
                                                              <Trash2 className="w-3 h-3 text-destructive" />
                                                            </Button>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Unassigned machines */}
                      {unassignedMachines.length > 0 && (
                        <div className="border rounded-lg border-dashed" data-testid="unassigned-machines">
                          <div className="p-3 bg-muted/30">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-500" />
                              <span className="font-medium">Machines non assignees</span>
                              <Badge variant="secondary">{unassignedMachines.length}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Ces machines n'appartiennent a aucun groupe. Assignez-les a un groupe pour une meilleure organisation.
                            </p>
                          </div>
                          <div className="p-3 space-y-1">
                            {unassignedMachines.map((machine) => (
                              <div key={machine.id} className="flex items-center gap-2 p-2 rounded bg-muted/30" data-testid={`unassigned-machine-${machine.id}`}>
                                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                                  {getOSIcon(machine.os)}
                                </div>
                                <span className="font-medium text-sm">{machine.hostname}</span>
                                <span className="text-xs text-muted-foreground capitalize">{machine.os}</span>
                                {machine.lastScore != null && (
                                  <Badge className={`text-xs ${getGradeColor(machine.lastGrade)}`}>
                                    {machine.lastScore}%
                                  </Badge>
                                )}
                                {hasFullAccess && (
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="ml-auto h-6 w-6"
                                    onClick={() => { if (confirm(`Supprimer "${machine.hostname}" ?`)) deleteMachineMutation.mutate(machine.id); }}
                                  >
                                    <Trash2 className="w-3 h-3 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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
                              <div className="flex flex-col gap-1">
                                <Badge className={getGradeColor(report.grade)}>
                                  {report.score}% ({report.grade})
                                </Badge>
                                {report.originalScore != null && report.originalScore !== report.score && (
                                  <span className="text-xs text-muted-foreground">
                                    Initial: {report.originalScore}%
                                  </span>
                                )}
                              </div>
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
                                  title="Voir le resume"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedReportForControls(report);
                                    setShowControlsDialog(true);
                                    setControlsFilter("all");
                                  }}
                                  data-testid={`button-view-controls-${report.id}`}
                                  title="Voir les controles"
                                >
                                  <Shield className="w-4 h-4" />
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

      {/* Dialog for adding organization */}
      <Dialog open={showAddOrgDialog} onOpenChange={setShowAddOrgDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Nouvelle organisation
            </DialogTitle>
            <DialogDescription>
              Creez une organisation pour regrouper vos sites
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nom de l'organisation *</Label>
              <Input
                id="org-name"
                placeholder="ex: Entreprise ABC, Groupe XYZ..."
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                data-testid="input-org-name"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddOrgDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => createOrgMutation.mutate({ name: newOrgName })} 
              disabled={!newOrgName.trim() || createOrgMutation.isPending}
              data-testid="button-confirm-add-org"
            >
              {createOrgMutation.isPending ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for adding site */}
      <Dialog open={showAddSiteDialog} onOpenChange={setShowAddSiteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Nouveau site
            </DialogTitle>
            <DialogDescription>
              Creez un site pour regrouper vos groupes de machines
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Nom du site *</Label>
              <Input
                id="site-name"
                placeholder="ex: Siege Paris, Usine Lyon..."
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                data-testid="input-site-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-location">Localisation</Label>
              <Input
                id="site-location"
                placeholder="ex: 123 rue de Paris, 75001 Paris"
                value={newSiteLocation}
                onChange={(e) => setNewSiteLocation(e.target.value)}
                data-testid="input-site-location"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddSiteDialog(false); setSelectedOrgId(null); }}>
              Annuler
            </Button>
            <Button 
              onClick={() => selectedOrgId && createSiteMutation.mutate({ organizationId: selectedOrgId, name: newSiteName, location: newSiteLocation })} 
              disabled={!newSiteName.trim() || !selectedOrgId || createSiteMutation.isPending}
              data-testid="button-confirm-add-site"
            >
              {createSiteMutation.isPending ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for adding group */}
      <Dialog open={showAddGroupDialog} onOpenChange={setShowAddGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5" />
              Nouveau groupe de machines
            </DialogTitle>
            <DialogDescription>
              Creez un groupe pour organiser vos machines
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">Nom du groupe *</Label>
              <Input
                id="group-name"
                placeholder="ex: Serveurs Web, Postes Comptabilite..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                data-testid="input-group-name"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddGroupDialog(false); setSelectedSiteId(null); }}>
              Annuler
            </Button>
            <Button 
              onClick={() => selectedSiteId && createGroupMutation.mutate({ siteId: selectedSiteId, name: newGroupName })} 
              disabled={!newGroupName.trim() || !selectedSiteId || createGroupMutation.isPending}
              data-testid="button-confirm-add-group"
            >
              {createGroupMutation.isPending ? "Creation..." : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for uploading report with machine name */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importer un rapport
            </DialogTitle>
            <DialogDescription>
              Renseignez le nom de la machine associee a ce rapport
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Aucune donnee systeme n'est recuperee lors de l'import. Seuls les resultats des tests de securite sont analyses. Veuillez renseigner manuellement le nom de la machine.
              </p>
            </div>

            {uploadFile && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <FileJson className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium truncate">{uploadFile.name}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="machine-name">Nom de la machine *</Label>
              <Input
                id="machine-name"
                placeholder="ex: srv-web-01, pc-compta-jean..."
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                data-testid="input-machine-name"
              />
              <p className="text-xs text-muted-foreground">
                Identifiant unique pour cette machine dans votre parc
              </p>
            </div>

            <div className="space-y-2">
              <Label>Emplacement dans l'arborescence (optionnel)</Label>
              <div className="border rounded-lg p-3 max-h-64 overflow-y-auto bg-muted/30">
                {organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Aucune organisation creee. Creez d'abord une structure dans l'onglet Machines.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <div 
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        selectedGroupId === null ? 'bg-primary/10 border border-primary' : 'hover-elevate'
                      }`}
                      onClick={() => setSelectedGroupId(null)}
                      data-testid="select-no-group"
                    >
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Non assigne</span>
                    </div>
                    
                    {organizations.map(org => (
                      <div key={org.id} className="pl-0">
                        <div 
                          className="flex items-center gap-1 p-2 rounded cursor-pointer hover-elevate"
                          onClick={() => {
                            const newExpanded = new Set(expandedOrgs);
                            if (newExpanded.has(org.id)) {
                              newExpanded.delete(org.id);
                            } else {
                              newExpanded.add(org.id);
                            }
                            setExpandedOrgs(newExpanded);
                          }}
                        >
                          {org.sites.length > 0 ? (
                            expandedOrgs.has(org.id) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )
                          ) : (
                            <div className="w-4" />
                          )}
                          <Building2 className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium">{org.name}</span>
                        </div>
                        
                        {expandedOrgs.has(org.id) && org.sites.map(site => (
                          <div key={site.id} className="pl-6">
                            <div 
                              className="flex items-center gap-1 p-2 rounded cursor-pointer hover-elevate"
                              onClick={() => {
                                const newExpanded = new Set(expandedSites);
                                if (newExpanded.has(site.id)) {
                                  newExpanded.delete(site.id);
                                } else {
                                  newExpanded.add(site.id);
                                }
                                setExpandedSites(newExpanded);
                              }}
                            >
                              {site.groups.length > 0 ? (
                                expandedSites.has(site.id) ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )
                              ) : (
                                <div className="w-4" />
                              )}
                              <MapPin className="w-4 h-4 text-green-600" />
                              <span className="text-sm">{site.name}</span>
                            </div>
                            
                            {expandedSites.has(site.id) && site.groups.map(group => (
                              <div 
                                key={group.id} 
                                className={`pl-12 flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                  selectedGroupId === group.id ? 'bg-primary/10 border border-primary' : 'hover-elevate'
                                }`}
                                onClick={() => setSelectedGroupId(group.id)}
                                data-testid={`select-group-${group.id}`}
                              >
                                <Layers className="w-4 h-4 text-purple-600" />
                                <span className="text-sm">{group.name}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedGroupId ? 
                  `Machine assignee au groupe selectionne` : 
                  `Cliquez sur un groupe pour assigner la machine`
                }
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelUpload} disabled={isUploading}>
              Annuler
            </Button>
            <Button 
              onClick={handleConfirmUpload} 
              disabled={isUploading || !machineName.trim()}
              data-testid="button-confirm-upload"
            >
              {isUploading ? (
                <>Import en cours...</>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirmer l'import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for viewing and editing controls */}
      <Dialog open={showControlsDialog} onOpenChange={(open) => { 
        setShowControlsDialog(open); 
        if (!open) { 
          setEditingControl(null); 
          setCorrectionJustification(""); 
        } 
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Controles de securite
            </DialogTitle>
            <DialogDescription>
              {selectedReportForControls?.hostname} - {selectedReportForControls?.totalControls} controles
              {reportControlsData?.correctedCount ? ` (${reportControlsData.correctedCount} corrige(s))` : ""}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-2 pb-2">
            <Button
              size="sm"
              variant={controlsFilter === "all" ? "default" : "outline"}
              onClick={() => setControlsFilter("all")}
            >
              Tous
            </Button>
            <Button
              size="sm"
              variant={controlsFilter === "PASS" ? "default" : "outline"}
              onClick={() => setControlsFilter("PASS")}
              className="text-green-600"
            >
              Reussis
            </Button>
            <Button
              size="sm"
              variant={controlsFilter === "FAIL" ? "default" : "outline"}
              onClick={() => setControlsFilter("FAIL")}
              className="text-red-600"
            >
              Echoues
            </Button>
            <Button
              size="sm"
              variant={controlsFilter === "WARN" ? "default" : "outline"}
              onClick={() => setControlsFilter("WARN")}
              className="text-yellow-600"
            >
              Avertissements
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {isLoadingControls ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : reportControlsData?.controls?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun controle trouve dans ce rapport
              </div>
            ) : (
              reportControlsData?.controls
                ?.filter((control: ReportControl) => controlsFilter === "all" || control.status === controlsFilter)
                .map((control: ReportControl) => {
                  const effectiveStatus = control.correction?.correctedStatus || control.status;
                  const isEditing = editingControl?.id === control.id;
                  
                  return (
                    <div 
                      key={control.id} 
                      className={`p-3 rounded-lg border ${
                        control.correction ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-xs ${
                              effectiveStatus === 'PASS' ? 'bg-green-100 text-green-700' :
                              effectiveStatus === 'FAIL' ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {effectiveStatus}
                            </Badge>
                            {control.correction && (
                              <Badge className="text-xs bg-blue-100 text-blue-700">
                                Corrige
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">[{control.id}]</span>
                            <span className="text-xs text-muted-foreground">{control.category}</span>
                            <Badge variant="outline" className="text-xs">
                              {control.severity}
                            </Badge>
                          </div>
                          <p className="font-medium mt-1">{control.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{control.description}</p>
                          
                          {control.remediation && (
                            <p className="text-xs text-blue-600 mt-1">
                              Remediation: {control.remediation}
                            </p>
                          )}
                          
                          {control.correction && (
                            <div className="mt-2 p-2 rounded bg-blue-100/50 dark:bg-blue-900/30 text-sm">
                              <p className="font-medium text-blue-700 dark:text-blue-300">Justification de la correction:</p>
                              <p className="text-blue-600 dark:text-blue-400">{control.correction.justification}</p>
                            </div>
                          )}
                          
                          {isEditing && (
                            <div className="mt-3 p-3 rounded-lg border bg-background space-y-3">
                              <div>
                                <Label className="text-sm">Nouveau statut</Label>
                                <Select value={correctionStatus} onValueChange={setCorrectionStatus}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PASS">PASS - Corrige</SelectItem>
                                    <SelectItem value="WARN">WARN - Ameliore</SelectItem>
                                    <SelectItem value="FAIL">FAIL - Non corrige</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-sm">Justification</Label>
                                <Input
                                  className="mt-1"
                                  placeholder="Expliquez la correction effectuee..."
                                  value={correctionJustification}
                                  onChange={(e) => setCorrectionJustification(e.target.value)}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (selectedReportForControls && correctionJustification.trim()) {
                                      saveControlCorrectionMutation.mutate({
                                        reportId: selectedReportForControls.id,
                                        controlId: control.id,
                                        originalStatus: control.status,
                                        correctedStatus: correctionStatus,
                                        justification: correctionJustification.trim()
                                      });
                                    }
                                  }}
                                  disabled={!correctionJustification.trim() || saveControlCorrectionMutation.isPending}
                                >
                                  {saveControlCorrectionMutation.isPending ? "..." : "Enregistrer"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingControl(null);
                                    setCorrectionJustification("");
                                  }}
                                >
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {!isEditing && hasFullAccess && (control.status === 'FAIL' || control.status === 'WARN') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingControl(control);
                              setCorrectionStatus(control.correction?.correctedStatus || "PASS");
                              setCorrectionJustification(control.correction?.justification || "");
                            }}
                          >
                            {control.correction ? "Modifier" : "Corriger"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </DialogContent>
      </Dialog>

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
                  <p className="text-sm text-muted-foreground mb-1">Score actuel</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{selectedReport.score}%</span>
                    <Badge className={getGradeColor(selectedReport.grade)}>
                      {selectedReport.grade}
                    </Badge>
                  </div>
                  {selectedReport.originalScore != null && selectedReport.originalScore !== selectedReport.score && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Score initial: {selectedReport.originalScore}%
                    </p>
                  )}
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
