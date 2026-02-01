import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { useState, useRef, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { 
  Users, 
  Monitor, 
  Shield, 
  BarChart3, 
  Clock, 
  AlertTriangle, 
  LayoutDashboard,
  Server,
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
  Layers,
  Key,
  Pencil,
  MoveHorizontal,
  ShieldAlert
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  createdAt: string;
}

interface TeamData {
  team: Team;
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
  groupId?: number | null;
  hostname: string;
  machineId?: string;
  os: string;
  osVersion?: string;
  lastAuditDate?: string;
  lastScore?: number;
  originalScore?: number | null;
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
  osVersion?: string | null;
}

interface FleetStats {
  totalMachines: number;
  totalReports: number;
  averageScore: number | null;
  lastAuditDate: string | null;
  osCounts: Record<string, number>;
}

interface ScoreHistoryItem {
  month: string;
  originalScore: number;
  currentScore: number;
  reports: number;
}

interface ScoreHistoryResponse {
  history: ScoreHistoryItem[];
  availableYears: number[];
  selectedYear: number;
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

interface MachineGroupWithHierarchy {
  id: number;
  siteId: number;
  name: string;
  description?: string;
  siteName?: string;
  organizationName?: string;
}

interface MachineGroupPermission {
  id: number;
  teamMemberId: number;
  groupId: number;
  canView: boolean;
  canEdit: boolean;
}

interface UserGroup {
  id: number;
  teamId: number;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: string;
}

interface UserGroupMember {
  id: number;
  userGroupId: number;
  teamMemberId: number;
  member: TeamMember | null;
}

type TabType = "dashboard" | "machines" | "reports" | "vulnerabilities" | "team";

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
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [selectedMemberForPermissions, setSelectedMemberForPermissions] = useState<TeamMember | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [machineToMove, setMachineToMove] = useState<Machine | null>(null);
  const [targetGroupId, setTargetGroupId] = useState<string>("");
  const [showUserGroupDialog, setShowUserGroupDialog] = useState(false);
  const [newUserGroupName, setNewUserGroupName] = useState("");
  const [newUserGroupDescription, setNewUserGroupDescription] = useState("");
  const [selectedUserGroup, setSelectedUserGroup] = useState<UserGroup | null>(null);
  const [showUserGroupMembersDialog, setShowUserGroupMembersDialog] = useState(false);
  const [showUserGroupPermissionsDialog, setShowUserGroupPermissionsDialog] = useState(false);
  const [editingUserGroup, setEditingUserGroup] = useState<UserGroup | null>(null);
  
  const [showEditHierarchyDialog, setShowEditHierarchyDialog] = useState(false);
  const [editingHierarchyType, setEditingHierarchyType] = useState<"org" | "site" | "group" | null>(null);
  const [editingHierarchyId, setEditingHierarchyId] = useState<number | null>(null);
  const [editingHierarchyName, setEditingHierarchyName] = useState("");
  const [editingHierarchyLocation, setEditingHierarchyLocation] = useState("");
  const [editingHierarchyDescription, setEditingHierarchyDescription] = useState("");

  const { data: teamData, isLoading: teamLoading } = useQuery<TeamData>({
    queryKey: ["/api/teams/my-team"],
    enabled: !!user,
  });
  
  const team = teamData?.team;
  const teamMembers = teamData?.members || [];

  const { data: membershipResponse, isLoading: membershipLoading } = useQuery<{ membership: TeamMembership | null }>({
    queryKey: ["/api/teams/my-membership"],
    enabled: !!user,
  });
  
  const membership = membershipResponse?.membership;

  const { data: canCreateData } = useQuery<{ canCreate: boolean }>({
    queryKey: ["/api/teams/can-create"],
    enabled: !!user,
  });
  
  const canCreateTeam = canCreateData?.canCreate || false;

  const { data: stats } = useQuery<FleetStats>({
    queryKey: ["/api/fleet/stats"],
    enabled: !!user,
  });

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const { data: scoreHistoryData } = useQuery<ScoreHistoryResponse>({
    queryKey: ["/api/fleet/score-history", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/fleet/score-history?year=${selectedYear}`);
      if (!res.ok) throw new Error("Failed to fetch score history");
      return res.json();
    },
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

  const allMachineGroups = useMemo(() => {
    if (!hierarchyData?.organizations || !team?.id) return [];
    const groups: MachineGroupWithHierarchy[] = [];
    const teamOrgs = hierarchyData.organizations.filter(org => org.teamId === team.id);
    for (const org of teamOrgs) {
      for (const site of org.sites) {
        for (const group of site.groups) {
          groups.push({
            id: group.id,
            siteId: group.siteId,
            name: group.name,
            description: group.description,
            siteName: site.name,
            organizationName: org.name,
          });
        }
      }
    }
    return groups;
  }, [hierarchyData, team?.id]);

  const { data: memberPermissions } = useQuery<MachineGroupPermission[]>({
    queryKey: ["/api/teams", team?.id, "members", selectedMemberForPermissions?.id, "permissions"],
    enabled: !!team?.id && !!selectedMemberForPermissions?.id,
  });

  const setPermissionMutation = useMutation({
    mutationFn: async (data: { groupId: number; canView: boolean; canEdit: boolean }) => {
      const res = await apiRequest(
        "POST", 
        `/api/teams/${team?.id}/members/${selectedMemberForPermissions?.id}/permissions`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Permission updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "members", selectedMemberForPermissions?.id, "permissions"] });
    },
    onError: () => {
      toast({ title: "Error updating permission", variant: "destructive" });
    },
  });

  const deletePermissionMutation = useMutation({
    mutationFn: async (permissionId: number) => {
      const res = await apiRequest(
        "DELETE", 
        `/api/teams/${team?.id}/members/${selectedMemberForPermissions?.id}/permissions/${permissionId}`,
        {}
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Permission deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "members", selectedMemberForPermissions?.id, "permissions"] });
    },
    onError: () => {
      toast({ title: "Error deleting permission", variant: "destructive" });
    },
  });

  const { data: userGroupsData } = useQuery<UserGroup[]>({
    queryKey: ["/api/teams", team?.id, "user-groups"],
    enabled: !!team?.id,
  });

  const { data: membersInGroupsData } = useQuery<number[]>({
    queryKey: ["/api/teams", team?.id, "members-in-groups"],
    enabled: !!team?.id,
  });

  const { data: userGroupMembersData } = useQuery<UserGroupMember[]>({
    queryKey: ["/api/teams", team?.id, "user-groups", selectedUserGroup?.id, "members"],
    enabled: !!team?.id && !!selectedUserGroup?.id && showUserGroupMembersDialog,
  });

  const { data: userGroupPermissionsData } = useQuery<MachineGroupPermission[]>({
    queryKey: ["/api/teams", team?.id, "user-groups", selectedUserGroup?.id, "permissions"],
    enabled: !!team?.id && !!selectedUserGroup?.id && showUserGroupPermissionsDialog,
  });

  const createUserGroupMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiRequest("POST", `/api/teams/${team?.id}/user-groups`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User group created" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups"] });
      setShowUserGroupDialog(false);
      setNewUserGroupName("");
      setNewUserGroupDescription("");
    },
    onError: () => {
      toast({ title: "Error creating group", variant: "destructive" });
    },
  });

  const updateUserGroupMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; description?: string }) => {
      const res = await apiRequest("PATCH", `/api/teams/${team?.id}/user-groups/${data.id}`, {
        name: data.name,
        description: data.description,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User group updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups"] });
      setEditingUserGroup(null);
    },
    onError: () => {
      toast({ title: "Error updating group", variant: "destructive" });
    },
  });

  const deleteUserGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      await apiRequest("DELETE", `/api/teams/${team?.id}/user-groups/${groupId}`);
    },
    onSuccess: () => {
      toast({ title: "User group deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "members-in-groups"] });
    },
    onError: () => {
      toast({ title: "Error deleting group", variant: "destructive" });
    },
  });

  const addUserGroupMemberMutation = useMutation({
    mutationFn: async (data: { userGroupId: number; teamMemberId: number }) => {
      const res = await apiRequest("POST", `/api/teams/${team?.id}/user-groups/${data.userGroupId}/members`, {
        teamMemberId: data.teamMemberId,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Member added to group" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups", selectedUserGroup?.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "members-in-groups"] });
    },
    onError: () => {
      toast({ title: "Error adding member", variant: "destructive" });
    },
  });

  const removeUserGroupMemberMutation = useMutation({
    mutationFn: async (data: { userGroupId: number; teamMemberId: number }) => {
      await apiRequest("DELETE", `/api/teams/${team?.id}/user-groups/${data.userGroupId}/members/${data.teamMemberId}`);
    },
    onSuccess: () => {
      toast({ title: "Member removed from group" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups", selectedUserGroup?.id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "members-in-groups"] });
    },
    onError: () => {
      toast({ title: "Error removing member", variant: "destructive" });
    },
  });

  const setUserGroupPermissionMutation = useMutation({
    mutationFn: async (data: { machineGroupId: number; canView: boolean; canEdit: boolean }) => {
      const res = await apiRequest(
        "POST",
        `/api/teams/${team?.id}/user-groups/${selectedUserGroup?.id}/permissions`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Permission updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups", selectedUserGroup?.id, "permissions"] });
    },
    onError: () => {
      toast({ title: "Error updating permission", variant: "destructive" });
    },
  });

  const deleteUserGroupPermissionMutation = useMutation({
    mutationFn: async (permissionId: number) => {
      await apiRequest("DELETE", `/api/teams/${team?.id}/user-groups/${selectedUserGroup?.id}/permissions/${permissionId}`);
    },
    onSuccess: () => {
      toast({ title: "Permission deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/teams", team?.id, "user-groups", selectedUserGroup?.id, "permissions"] });
    },
    onError: () => {
      toast({ title: "Error deleting permission", variant: "destructive" });
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await apiRequest("POST", "/api/fleet/organizations", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organization created" });
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
      toast({ title: "Site created" });
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
      toast({ title: "Group created" });
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
      toast({ title: "Organization deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
    },
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/fleet/sites/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Site deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/fleet/groups/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Group deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; description?: string }) => {
      await apiRequest("PUT", `/api/fleet/organizations/${data.id}`, { name: data.name, description: data.description });
    },
    onSuccess: () => {
      toast({ title: "Organization updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      setShowEditHierarchyDialog(false);
    },
  });

  const updateSiteMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; location?: string }) => {
      await apiRequest("PUT", `/api/fleet/sites/${data.id}`, { name: data.name, location: data.location });
    },
    onSuccess: () => {
      toast({ title: "Site updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      setShowEditHierarchyDialog(false);
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; description?: string }) => {
      await apiRequest("PUT", `/api/fleet/groups/${data.id}`, { name: data.name, description: data.description });
    },
    onSuccess: () => {
      toast({ title: "Group updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      setShowEditHierarchyDialog(false);
    },
  });

  const assignMachineMutation = useMutation({
    mutationFn: async (data: { machineId: number; groupId: number | null }) => {
      await apiRequest("PUT", `/api/fleet/machines/${data.machineId}/assign`, { groupId: data.groupId });
    },
    onSuccess: () => {
      toast({ title: "Machine assigned" });
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
        title: "Report imported",
        description: data.message || "The report has been imported successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error importing the report",
        variant: "destructive",
      });
    },
  });

  const deleteMachineMutation = useMutation({
    mutationFn: async (machineId: number) => {
      await apiRequest("DELETE", `/api/fleet/machines/${machineId}`);
    },
    onSuccess: () => {
      toast({ title: "Machine deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
    },
  });

  const moveMachineMutation = useMutation({
    mutationFn: async ({ machineId, groupId }: { machineId: number; groupId: number | null }) => {
      await apiRequest("PUT", `/api/fleet/machines/${machineId}/assign`, { groupId });
    },
    onSuccess: () => {
      toast({ title: "Machine moved" });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/hierarchy"] });
      setShowMoveDialog(false);
      setMachineToMove(null);
      setTargetGroupId("");
    },
    onError: () => {
      toast({ title: "Error moving machine", variant: "destructive" });
    },
  });

  const { data: reportControlsData, isLoading: isLoadingControls, refetch: refetchControls } = useQuery<{ 
    reportId: number; 
    controls: ReportControl[]; 
    totalControls: number; 
    correctedCount: number;
    canEdit: boolean;
  }>({
    queryKey: ["/api/fleet/reports", selectedReportForControls?.id, "controls"],
    enabled: !!selectedReportForControls,
  });

  const saveControlCorrectionMutation = useMutation({
    mutationFn: async (data: { reportId: number; controlId: string; originalStatus: string; correctedStatus: string; justification: string }) => {
      return await apiRequest("POST", `/api/fleet/reports/${data.reportId}/corrections`, data);
    },
    onSuccess: () => {
      toast({ title: "Correction saved - Score updated" });
      refetchControls();
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/machines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fleet/stats"] });
      setEditingControl(null);
      setCorrectionJustification("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error saving correction",
        variant: "destructive",
      });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (reportId: number) => {
      await apiRequest("DELETE", `/api/fleet/reports/${reportId}`);
    },
    onSuccess: () => {
      toast({ title: "Report deleted" });
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
        title: "Invalid format",
        description: "Please select a JSON file",
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
        title: "Machine name required",
        description: "Please enter the machine name",
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
    return new Date(dateString).toLocaleDateString("en-US", {
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
            <h2 className="text-xl font-bold mb-2">Login Required</h2>
            <p className="text-muted-foreground mb-4">
              Please log in to access fleet tracking
            </p>
            <Button asChild>
              <Link href="/">Back to Home</Link>
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

  const showAccessRequiredDialog = !hasTeamAccess;

  const navItems = [
    { id: "dashboard" as TabType, label: "Dashboard", icon: LayoutDashboard },
    { id: "machines" as TabType, label: "Machines", icon: Server },
    { id: "reports" as TabType, label: "Reports", icon: FileText },
    { id: "vulnerabilities" as TabType, label: "Vulnerabilities", icon: ShieldAlert },
  ];

  const adminNavItems = [
    { id: "team" as TabType, label: "Team", icon: Users },
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
      <Dialog open={showAccessRequiredDialog}>
        <DialogContent className="sm:max-w-lg [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
              <Server className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">Fleet Tracking</DialogTitle>
            <DialogDescription className="text-center">
              Security audit tracking dashboard
            </DialogDescription>
          </DialogHeader>
          {canCreateTeam ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 my-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-500 mb-2">
                <Check className="h-4 w-4" />
                <span className="font-medium text-sm">Active subscription</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                You have an active subscription. To access fleet tracking, you need to create your team.
              </p>
              <ul className="text-sm text-muted-foreground text-left space-y-2">
                <li className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Go to your profile to create your team</span>
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Once the team is created, you will have access to fleet tracking</span>
                </li>
              </ul>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 my-4">
              <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">Access required</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                To access the fleet tracking service, you must:
              </p>
              <ul className="text-sm text-muted-foreground text-left space-y-2">
                <li className="flex items-start gap-2">
                  <Shield className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Subscribe to at least one security toolkit</span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Or request access from your company's main administrator</span>
                </li>
              </ul>
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:justify-center">
            {canCreateTeam ? (
              <Button asChild>
                <Link href="/profile">
                  <Users className="w-4 h-4 mr-2" />
                  Create my team
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link href="/">View toolkits</Link>
                </Button>
                <Button asChild>
                  <Link href="/profile">
                    <Users className="w-4 h-4 mr-2" />
                    Manage my team
                  </Link>
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="overflow-hidden">
              <h2 className="font-bold text-sm truncate">Fleet Tracking</h2>
              <p className="text-xs text-muted-foreground truncate">{teamName}</p>
            </div>
          </div>
        </div>

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

        <div className="p-3 border-t">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            onClick={() => setLocation("/")}
            data-testid="button-back-home"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Back to site
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">
                {activeTab === "dashboard" && "Dashboard"}
                {activeTab === "machines" && "Machines"}
                {activeTab === "reports" && "Reports"}
                {activeTab === "vulnerabilities" && "Vulnerabilities"}
                {activeTab === "team" && "Team"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {activeTab === "dashboard" && "Overview of your IT fleet"}
                {activeTab === "machines" && "Manage registered machines"}
                {activeTab === "reports" && "Audit report history"}
                {activeTab === "vulnerabilities" && "Security vulnerabilities tracking"}
                {activeTab === "team" && "Manage team members"}
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
                    {isUploading ? "Importing..." : "Import report"}
                  </Button>
                </>
              )}
              {isAdmin && (
                <Badge variant="default" className="bg-red-600">
                  Administrator
                </Badge>
              )}
              {isTeamOwner && !isAdmin && (
                <Badge variant="default" className="bg-green-600">
                  Owner
                </Badge>
              )}
              {isTeamMember && !isAdmin && (
                <Badge variant={memberRole === "admin" ? "default" : "secondary"}>
                  {memberRole === "admin" ? "Team Admin" : "Member"}
                </Badge>
              )}
            </div>
          </div>
        </header>

        <div className="p-6">
          {!hasFullAccess && (
            <Card className="mb-6 bg-blue-500/5 border-blue-500/20">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Shield className="h-4 w-4" />
                  <span className="text-sm">
                    Read-only access - Contact a team administrator to modify data
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "dashboard" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
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
                    <p className="text-xs text-muted-foreground">Total machines</p>
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
                    <p className="text-xs text-muted-foreground">Reports generated</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Average score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {stats?.averageScore != null ? `${stats.averageScore}%` : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats?.averageScore != null ? "Overall average" : "No audits"}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Last audit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold truncate">
                      {stats?.lastAuditDate ? formatDate(stats.lastAuditDate).split(' ')[0] : "--"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stats?.lastAuditDate ? formatDate(stats.lastAuditDate).split(' ')[1] : "No history"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="h-4 w-4" />
                        Fleet score evolution
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        <span>Average score per month</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-gray-700 dark:bg-gray-500" />
                            <span className="text-xs">Initial score</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                            <span className="text-xs">Current score</span>
                          </div>
                        </div>
                      </CardDescription>
                    </div>
                    <Select 
                      value={selectedYear.toString()} 
                      onValueChange={(value) => setSelectedYear(parseInt(value))}
                    >
                      <SelectTrigger className="w-28" data-testid="select-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(scoreHistoryData?.availableYears || [new Date().getFullYear()]).map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {scoreHistoryData?.history && scoreHistoryData.history.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={scoreHistoryData.history} 
                          margin={{ top: 10, right: 30, left: -10, bottom: 0 }}
                          barGap={1}
                          barCategoryGap="60%"
                        >
                          <CartesianGrid 
                            strokeDasharray="3 3" 
                            vertical={false}
                            className="stroke-muted/30" 
                          />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            domain={[0, 100]} 
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                            tickFormatter={(value) => `${value}`}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              `${value}%`, 
                              name === 'originalScore' ? 'Initial score' : 'Current score'
                            ]}
                            labelFormatter={(label) => label}
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                            }}
                            cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                          />
                          <Bar 
                            dataKey="originalScore" 
                            fill="#374151"
                            radius={[2, 2, 0, 0]}
                            name="originalScore"
                            maxBarSize={8}
                          />
                          <Bar 
                            dataKey="currentScore" 
                            fill="#10b981"
                            radius={[2, 2, 0, 0]}
                            name="currentScore"
                            maxBarSize={8}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">No data available</p>
                      <p className="text-xs">Scores will appear after the first audits</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Check className="h-4 w-4" />
                      Distribution by OS
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const osColors: Record<string, string> = {
                        'windows': '#7c3aed',
                        'linux': '#f59e0b',
                        'vmware': '#6d9a2e',
                        'esxi': '#6d9a2e',
                        'docker': '#06b6d4',
                        'container': '#06b6d4',
                        'web': '#ef4444',
                        'unknown': '#6b7280',
                      };
                      
                      const getOsColor = (os: string) => {
                        const osLower = os.toLowerCase();
                        for (const [key, color] of Object.entries(osColors)) {
                          if (osLower.includes(key)) return color;
                        }
                        return osColors['unknown'];
                      };

                      return stats?.osCounts && Object.keys(stats.osCounts).length > 0 ? (
                      <div className="flex flex-col items-center">
                        <div className="w-full h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={Object.entries(stats.osCounts).map(([os, count]) => ({
                                  name: os,
                                  value: count
                                }))}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={85}
                                paddingAngle={2}
                                dataKey="value"
                              >
                                {Object.entries(stats.osCounts).map(([os]) => (
                                  <Cell key={`cell-${os}`} fill={getOsColor(os)} />
                                ))}
                              </Pie>
                              <Tooltip 
                                formatter={(value: number) => [`${value} machine${value > 1 ? 's' : ''}`, '']}
                                contentStyle={{ 
                                  backgroundColor: 'hsl(var(--card))', 
                                  border: '1px solid hsl(var(--border))',
                                  borderRadius: '8px'
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                          {[
                            { key: 'windows', label: 'Windows', color: '#7c3aed' },
                            { key: 'linux', label: 'Linux', color: '#f59e0b' },
                            { key: 'vmware', label: 'VMware', color: '#6d9a2e' },
                            { key: 'container', label: 'Container', color: '#06b6d4' },
                            { key: 'web', label: 'Web', color: '#ef4444' },
                          ].map(({ key, label, color }) => {
                            const count = Object.entries(stats.osCounts).find(([os]) => 
                              os.toLowerCase().includes(key)
                            )?.[1] || 0;
                            return (
                              <div key={key} className={`flex items-center gap-1.5 text-xs ${count === 0 ? 'opacity-40' : ''}`}>
                                <div 
                                  className="w-2.5 h-2.5 rounded-sm" 
                                  style={{ backgroundColor: color }}
                                />
                                <span>{label}</span>
                                {count > 0 && (
                                  <span className="text-muted-foreground">({Math.round((count / stats.totalMachines) * 100)}%)</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Monitor className="h-12 w-12 mb-3 opacity-20" />
                        <p className="text-sm">No machines registered</p>
                      </div>
                    );
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-4 w-4" />
                      Recent audits
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
                                <p className="text-xs text-muted-foreground capitalize">{report.os || 'unknown'} - {report.osVersion || 'Unknown version'}</p>
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
                        <p className="text-sm">No reports available</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {machines.length === 0 && (
                <Card className="border-dashed border-2">
                  <CardContent className="py-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <FileJson className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-2">Import your audit reports</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md">
                        Run your audit scripts on your machines, then import the generated JSON files to track your fleet's security evolution.
                      </p>
                      <Button onClick={() => fileInputRef.current?.click()} data-testid="button-first-upload">
                        <Upload className="w-4 h-4 mr-2" />
                        Import a JSON report
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

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
                      Fleet hierarchy ({machines.length} machines)
                    </CardTitle>
                    <CardDescription>
                      Hierarchical organization: Organization - Site - Group - Machines
                    </CardDescription>
                  </div>
                  {hasFullAccess && (
                    <Button size="sm" onClick={() => setShowAddOrgDialog(true)} data-testid="button-add-org">
                      <Plus className="w-4 h-4 mr-2" />
                      Add organization
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {organizations.length === 0 && unassignedMachines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FolderTree className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">No organization configured</p>
                      <p className="text-sm mb-4">Create an organization to structure your fleet</p>
                      {hasFullAccess && (
                        <Button variant="outline" onClick={() => setShowAddOrgDialog(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Create an organization
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
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
                                  title="Add a site"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setEditingHierarchyType("org");
                                    setEditingHierarchyId(org.id);
                                    setEditingHierarchyName(org.name);
                                    setEditingHierarchyDescription(org.description || "");
                                    setShowEditHierarchyDialog(true);
                                  }}
                                  title="Edit name"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete the organization "{org.name}"? This action is irreversible.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteOrgMutation.mutate(org.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </div>
                          
                          {expandedOrgs.has(org.id) && (
                            <div className="pl-6 pb-2">
                              {org.sites.length === 0 ? (
                                <p className="text-sm text-muted-foreground p-2 pl-6">No sites</p>
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
                                            title="Add a group"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </Button>
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            onClick={(e) => { 
                                              e.stopPropagation(); 
                                              setEditingHierarchyType("site");
                                              setEditingHierarchyId(site.id);
                                              setEditingHierarchyName(site.name);
                                              setEditingHierarchyLocation(site.location || "");
                                              setShowEditHierarchyDialog(true);
                                            }}
                                            title="Edit name"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </Button>
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                              <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                                <Trash2 className="w-3 h-3 text-destructive" />
                                              </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Are you sure you want to delete the site "{site.name}"? This action is irreversible.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => deleteSiteMutation.mutate(site.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                  Delete
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {expandedSites.has(site.id) && (
                                      <div className="pl-6">
                                        {site.groups.length === 0 ? (
                                          <p className="text-sm text-muted-foreground p-2 pl-4">No groups</p>
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
                                                  <div className="ml-auto flex gap-1">
                                                    <Button 
                                                      size="icon" 
                                                      variant="ghost" 
                                                      onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setEditingHierarchyType("group");
                                                        setEditingHierarchyId(group.id);
                                                        setEditingHierarchyName(group.name);
                                                        setEditingHierarchyDescription(group.description || "");
                                                        setShowEditHierarchyDialog(true);
                                                      }}
                                                      title="Edit name"
                                                    >
                                                      <Pencil className="w-3 h-3" />
                                                    </Button>
                                                    <AlertDialog>
                                                      <AlertDialogTrigger asChild>
                                                        <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                                                          <Trash2 className="w-3 h-3 text-destructive" />
                                                        </Button>
                                                      </AlertDialogTrigger>
                                                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                        <AlertDialogHeader>
                                                          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
                                                          <AlertDialogDescription>
                                                            Are you sure you want to delete the group "{group.name}"? This action is irreversible.
                                                          </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                          <AlertDialogAction onClick={() => deleteGroupMutation.mutate(group.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                            Delete
                                                          </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                      </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                                )}
                                              </div>
                                              
                                              {expandedGroups.has(group.id) && (
                                                <div className="pl-8 pb-2">
                                                  {group.machines.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground p-2">No machines</p>
                                                  ) : (
                                                    <div className="space-y-1">
                                                      {group.machines.map((machine) => (
                                                        <div key={machine.id} className="flex items-center gap-2 p-2 rounded bg-muted/30" data-testid={`machine-${machine.id}`}>
                                                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                                                            {getOSIcon(machine.os)}
                                                          </div>
                                                          <span className="font-medium text-sm">{machine.hostname}</span>
                                                          <span className="text-xs text-muted-foreground capitalize">{machine.os} - {machine.osVersion || 'Unknown version'}</span>
                                                          {machine.lastScore != null && (
                                                            <div className="flex items-center gap-1">
                                                              {machine.originalScore != null && machine.originalScore !== machine.lastScore && (
                                                                <span className="text-xs text-muted-foreground">
                                                                  {machine.originalScore}%
                                                                </span>
                                                              )}
                                                              {machine.originalScore != null && machine.originalScore !== machine.lastScore && (
                                                                <span className="text-xs text-muted-foreground">-&gt;</span>
                                                              )}
                                                              <Badge className={`text-xs ${getGradeColor(machine.lastGrade)}`}>
                                                                {machine.lastScore}%
                                                              </Badge>
                                                            </div>
                                                          )}
                                                          {hasFullAccess && (
                                                            <div className="ml-auto flex gap-1">
                                                              <Button 
                                                                size="icon" 
                                                                variant="ghost"
                                                                onClick={() => { setMachineToMove(machine); setShowMoveDialog(true); }}
                                                                title="Move to another group"
                                                                data-testid={`button-move-machine-${machine.id}`}
                                                              >
                                                                <MoveHorizontal className="w-4 h-4" />
                                                              </Button>
                                                              <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                  <Button size="icon" variant="ghost" data-testid={`button-delete-machine-${machine.id}`}>
                                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                                  </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                  <AlertDialogHeader>
                                                                    <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                      Are you sure you want to delete "{machine.hostname}"? This action is irreversible.
                                                                    </AlertDialogDescription>
                                                                  </AlertDialogHeader>
                                                                  <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => deleteMachineMutation.mutate(machine.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                      Delete
                                                                    </AlertDialogAction>
                                                                  </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                              </AlertDialog>
                                                            </div>
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

                      {unassignedMachines.length > 0 && (
                        <div className="border rounded-lg border-dashed" data-testid="unassigned-machines">
                          <div className="flex items-center gap-2 p-3">
                            <Monitor className="w-5 h-5 text-muted-foreground" />
                            <span className="font-semibold text-muted-foreground">Unassigned</span>
                            <Badge variant="secondary" className="ml-2">{unassignedMachines.length} machines</Badge>
                          </div>
                          <div className="pl-6 pb-2 space-y-1">
                            {unassignedMachines.map((machine) => (
                              <div key={machine.id} className="flex items-center gap-2 p-2 rounded bg-muted/30" data-testid={`unassigned-machine-${machine.id}`}>
                                <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-bold">
                                  {getOSIcon(machine.os)}
                                </div>
                                <span className="font-medium text-sm">{machine.hostname}</span>
                                <span className="text-xs text-muted-foreground capitalize">{machine.os} - {machine.osVersion || 'Unknown version'}</span>
                                {machine.lastScore != null && (
                                  <Badge className={`text-xs ${getGradeColor(machine.lastGrade)}`}>
                                    {machine.lastScore}%
                                  </Badge>
                                )}
                                {hasFullAccess && (
                                  <div className="ml-auto flex gap-1">
                                    <Button 
                                      size="icon" 
                                      variant="ghost"
                                      onClick={() => { setMachineToMove(machine); setShowMoveDialog(true); }}
                                      title="Move to a group"
                                      data-testid={`button-move-unassigned-${machine.id}`}
                                    >
                                      <MoveHorizontal className="w-4 h-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button size="icon" variant="ghost" data-testid={`button-delete-unassigned-${machine.id}`}>
                                          <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete "{machine.hostname}"? This action is irreversible.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteMachineMutation.mutate(machine.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Delete
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
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
                    Audit reports
                  </CardTitle>
                  <CardDescription>
                    {reports.length} report{reports.length > 1 ? "s" : ""} in history
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileText className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">No reports yet</p>
                      <p className="text-sm mb-4">Import your first audit report</p>
                      <Button onClick={() => fileInputRef.current?.click()} data-testid="button-first-report-upload">
                        <Upload className="w-4 h-4 mr-2" />
                        Import a report
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Machine</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Script</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Controls</TableHead>
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
                                <div>
                                  <span className="font-medium">{report.hostname || `Machine #${report.machineId}`}</span>
                                  <p className="text-xs text-muted-foreground capitalize">{report.os || 'unknown'} - {report.osVersion || 'Unknown version'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(report.auditDate)}</TableCell>
                            <TableCell>
                              {report.scriptName || "Unknown script"}
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
                                  title="View summary"
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
                                  title="View controls"
                                >
                                  <Shield className="w-4 h-4" />
                                </Button>
                                {hasFullAccess && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" data-testid={`button-delete-report-${report.id}`}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this report? This action is irreversible.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteReportMutation.mutate(report.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
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

          {activeTab === "vulnerabilities" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
                    <ShieldAlert className="h-10 w-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Under Development</h2>
                  <p className="text-muted-foreground text-center max-w-md mb-6">
                    This feature is currently under development. It will allow you to track security vulnerabilities reported by vendors and organizations for the operating systems in your fleet.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Monitor className="h-4 w-4" />
                          Fleet OS Inventory
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          View the complete list of operating systems deployed in your fleet with version details.
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Vulnerability Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Automatic detection of new security vulnerabilities reported by ANSSI, CIS, and vendors.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  <Badge variant="secondary" className="mt-6">
                    Coming Soon
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          )}

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
                    Team members without a group
                  </CardTitle>
                  <CardDescription>
                    {team ? `${teamMembers.filter(m => !membersInGroupsData?.includes(m.id)).length} member${teamMembers.filter(m => !membersInGroupsData?.includes(m.id)).length > 1 ? "s" : ""} without a group` : "Member management"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!team || teamMembers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Users className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">No members in the team</p>
                      <p className="text-sm mb-4">Add members to share access to tracking</p>
                      <Button variant="outline" asChild>
                        <Link href="/profile">Add members</Link>
                      </Button>
                    </div>
                  ) : teamMembers.filter(m => !membersInGroupsData?.includes(m.id)).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Layers className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">All members are in groups</p>
                      <p className="text-xs mt-1">Manage their permissions via user groups</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {teamMembers.filter(m => !membersInGroupsData?.includes(m.id)).map((member) => (
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
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedMemberForPermissions(member);
                                setShowPermissionsDialog(true);
                              }}
                              data-testid={`btn-permissions-${member.id}`}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              Permissions
                            </Button>
                            <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                              {member.role === "admin" ? "Admin" : "Member"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      User groups
                    </CardTitle>
                    <CardDescription>
                      Group members to manage permissions more easily
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUserGroupDialog(true)}
                    data-testid="btn-add-user-group"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    New group
                  </Button>
                </CardHeader>
                <CardContent>
                  {!userGroupsData || userGroupsData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Layers className="h-16 w-16 mb-4 opacity-20" />
                      <p className="text-lg font-medium mb-1">No user groups</p>
                      <p className="text-sm">Create groups to manage permissions in bulk</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {userGroupsData.map((userGroup) => (
                        <div
                          key={userGroup.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          data-testid={`user-group-${userGroup.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Layers className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{userGroup.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {userGroup.memberCount} member{userGroup.memberCount > 1 ? "s" : ""}
                                {userGroup.description && ` - ${userGroup.description}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUserGroup(userGroup);
                                setShowUserGroupMembersDialog(true);
                              }}
                              data-testid={`btn-members-${userGroup.id}`}
                            >
                              <Users className="h-4 w-4 mr-1" />
                              Members
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedUserGroup(userGroup);
                                setShowUserGroupPermissionsDialog(true);
                              }}
                              data-testid={`btn-group-permissions-${userGroup.id}`}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              Permissions
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingUserGroup(userGroup)}
                              data-testid={`btn-edit-group-${userGroup.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`btn-delete-group-${userGroup.id}`}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the group "{userGroup.name}"? This action is irreversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteUserGroupMutation.mutate(userGroup.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>

      <Dialog open={showAddOrgDialog} onOpenChange={setShowAddOrgDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              New organization
            </DialogTitle>
            <DialogDescription>
              Create an organization to group your sites
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name *</Label>
              <Input
                id="org-name"
                placeholder="e.g., ABC Company, XYZ Group..."
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                data-testid="input-org-name"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddOrgDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createOrgMutation.mutate({ name: newOrgName })} 
              disabled={!newOrgName.trim() || createOrgMutation.isPending}
              data-testid="button-confirm-add-org"
            >
              {createOrgMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditHierarchyDialog} onOpenChange={(open) => { if (!open) { setShowEditHierarchyDialog(false); setEditingHierarchyType(null); setEditingHierarchyId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingHierarchyType === "org" && <Building2 className="w-5 h-5" />}
              {editingHierarchyType === "site" && <MapPin className="w-5 h-5" />}
              {editingHierarchyType === "group" && <Folder className="w-5 h-5" />}
              Edit {editingHierarchyType === "org" ? "organization" : editingHierarchyType === "site" ? "site" : "group"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-hierarchy-name">Name *</Label>
              <Input
                id="edit-hierarchy-name"
                value={editingHierarchyName}
                onChange={(e) => setEditingHierarchyName(e.target.value)}
                data-testid="input-edit-hierarchy-name"
              />
            </div>
            {editingHierarchyType === "site" && (
              <div className="space-y-2">
                <Label htmlFor="edit-hierarchy-location">Location</Label>
                <Input
                  id="edit-hierarchy-location"
                  value={editingHierarchyLocation}
                  onChange={(e) => setEditingHierarchyLocation(e.target.value)}
                  data-testid="input-edit-hierarchy-location"
                />
              </div>
            )}
            {(editingHierarchyType === "org" || editingHierarchyType === "group") && (
              <div className="space-y-2">
                <Label htmlFor="edit-hierarchy-description">Description</Label>
                <Input
                  id="edit-hierarchy-description"
                  value={editingHierarchyDescription}
                  onChange={(e) => setEditingHierarchyDescription(e.target.value)}
                  data-testid="input-edit-hierarchy-description"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowEditHierarchyDialog(false); setEditingHierarchyType(null); setEditingHierarchyId(null); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (editingHierarchyType === "org" && editingHierarchyId) {
                  updateOrgMutation.mutate({ id: editingHierarchyId, name: editingHierarchyName, description: editingHierarchyDescription || undefined });
                } else if (editingHierarchyType === "site" && editingHierarchyId) {
                  updateSiteMutation.mutate({ id: editingHierarchyId, name: editingHierarchyName, location: editingHierarchyLocation || undefined });
                } else if (editingHierarchyType === "group" && editingHierarchyId) {
                  updateGroupMutation.mutate({ id: editingHierarchyId, name: editingHierarchyName, description: editingHierarchyDescription || undefined });
                }
              }} 
              disabled={!editingHierarchyName.trim() || updateOrgMutation.isPending || updateSiteMutation.isPending || updateGroupMutation.isPending}
              data-testid="button-confirm-edit-hierarchy"
            >
              {(updateOrgMutation.isPending || updateSiteMutation.isPending || updateGroupMutation.isPending) ? "Updating..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddSiteDialog} onOpenChange={setShowAddSiteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              New site
            </DialogTitle>
            <DialogDescription>
              Create a site to group your machine groups
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site name *</Label>
              <Input
                id="site-name"
                placeholder="e.g., Paris HQ, Lyon Factory..."
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                data-testid="input-site-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-location">Location</Label>
              <Input
                id="site-location"
                placeholder="e.g., 123 Main Street, New York"
                value={newSiteLocation}
                onChange={(e) => setNewSiteLocation(e.target.value)}
                data-testid="input-site-location"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddSiteDialog(false); setSelectedOrgId(null); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedOrgId && createSiteMutation.mutate({ organizationId: selectedOrgId, name: newSiteName, location: newSiteLocation })} 
              disabled={!newSiteName.trim() || !selectedOrgId || createSiteMutation.isPending}
              data-testid="button-confirm-add-site"
            >
              {createSiteMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddGroupDialog} onOpenChange={setShowAddGroupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5" />
              New machine group
            </DialogTitle>
            <DialogDescription>
              Create a group to organize your machines
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name *</Label>
              <Input
                id="group-name"
                placeholder="e.g., Web Servers, Accounting Workstations..."
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                data-testid="input-group-name"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAddGroupDialog(false); setSelectedSiteId(null); }}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedSiteId && createGroupMutation.mutate({ siteId: selectedSiteId, name: newGroupName })} 
              disabled={!newGroupName.trim() || !selectedSiteId || createGroupMutation.isPending}
              data-testid="button-confirm-add-group"
            >
              {createGroupMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPermissionsDialog} onOpenChange={(open) => {
        setShowPermissionsDialog(open);
        if (!open) setSelectedMemberForPermissions(null);
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Permissions for {selectedMemberForPermissions?.firstName || selectedMemberForPermissions?.email}
            </DialogTitle>
            <DialogDescription>
              Define access rights to machine groups for this member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!allMachineGroups || allMachineGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>No machine groups available</p>
                <p className="text-sm">First create organizations, sites and groups in the Machines tab</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Check the groups this member can access and define their rights (view or edit).
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Group</TableHead>
                      <TableHead>Hierarchy</TableHead>
                      <TableHead className="text-center">View</TableHead>
                      <TableHead className="text-center">Edit</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allMachineGroups.map((group) => {
                      const permission = memberPermissions?.find(p => p.groupId === group.id);
                      return (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Folder className="h-4 w-4 text-muted-foreground" />
                              {group.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {group.organizationName} / {group.siteName}
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={permission?.canView || false}
                              onChange={(e) => {
                                setPermissionMutation.mutate({
                                  groupId: group.id,
                                  canView: e.target.checked,
                                  canEdit: permission?.canEdit || false,
                                });
                              }}
                              className="h-4 w-4 rounded border-gray-300"
                              data-testid={`checkbox-view-${group.id}`}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={permission?.canEdit || false}
                              onChange={(e) => {
                                setPermissionMutation.mutate({
                                  groupId: group.id,
                                  canView: permission?.canView || e.target.checked,
                                  canEdit: e.target.checked,
                                });
                              }}
                              className="h-4 w-4 rounded border-gray-300"
                              data-testid={`checkbox-edit-${group.id}`}
                            />
                          </TableCell>
                          <TableCell>
                            {permission && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    data-testid={`btn-remove-permission-${group.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove access</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove this member's access to the group "{group.name}"?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deletePermissionMutation.mutate(permission.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import a report
            </DialogTitle>
            <DialogDescription>
              Enter the name of the machine associated with this report
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="mb-2">Data automatically retrieved from the report:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Operating system and version</li>
                  <li>Security test results (score, controls)</li>
                  <li>Audit date</li>
                </ul>
                <p className="mt-2 text-xs opacity-80">Please manually enter the machine name.</p>
              </div>
            </div>

            {uploadFile && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <FileJson className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium truncate">{uploadFile.name}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="machine-name">Machine name *</Label>
              <Input
                id="machine-name"
                placeholder="e.g., srv-web-01, pc-accounting-john..."
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                data-testid="input-machine-name"
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier for this machine in your fleet
              </p>
            </div>

            <div className="space-y-2">
              <Label>Location in hierarchy (optional)</Label>
              <div className="border rounded-lg p-3 max-h-64 overflow-y-auto bg-muted/30">
                {organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No organization created. First create a structure in the Machines tab.
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
                      <span className="text-sm">Unassigned</span>
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
                  `Machine will be assigned to the selected group` : 
                  `Click on a group to assign the machine`
                }
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelUpload} disabled={isUploading}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmUpload} 
              disabled={isUploading || !machineName.trim()}
              data-testid="button-confirm-upload"
            >
              {isUploading ? (
                <>Importing...</>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Confirm import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              Security controls
            </DialogTitle>
            <DialogDescription>
              {selectedReportForControls?.hostname} - {selectedReportForControls?.totalControls} controls
              {reportControlsData?.correctedCount ? ` (${reportControlsData.correctedCount} corrected)` : ""}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center gap-2 pb-2">
            <Button
              size="sm"
              variant={controlsFilter === "all" ? "default" : "outline"}
              onClick={() => setControlsFilter("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={controlsFilter === "PASS" ? "default" : "outline"}
              onClick={() => setControlsFilter("PASS")}
              className="text-green-600"
            >
              Passed
            </Button>
            <Button
              size="sm"
              variant={controlsFilter === "FAIL" ? "default" : "outline"}
              onClick={() => setControlsFilter("FAIL")}
              className="text-red-600"
            >
              Failed
            </Button>
            <Button
              size="sm"
              variant={controlsFilter === "WARN" ? "default" : "outline"}
              onClick={() => setControlsFilter("WARN")}
              className="text-yellow-600"
            >
              Warnings
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {isLoadingControls ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : reportControlsData?.controls?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No controls found in this report
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
                                Corrected
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
                              <p className="font-medium text-blue-700 dark:text-blue-300">Correction justification:</p>
                              <p className="text-blue-600 dark:text-blue-400">{control.correction.justification}</p>
                            </div>
                          )}
                          
                          {isEditing && (
                            <div className="mt-3 p-3 rounded-lg border bg-background space-y-3">
                              <div>
                                <Label className="text-sm">New status</Label>
                                <Select value={correctionStatus} onValueChange={setCorrectionStatus}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="PASS">PASS - Fixed</SelectItem>
                                    <SelectItem value="WARN">WARN - Improved</SelectItem>
                                    <SelectItem value="FAIL">FAIL - Not fixed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-sm">Justification</Label>
                                <Input
                                  className="mt-1"
                                  placeholder="Explain the correction made..."
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
                                        justification: correctionJustification,
                                      });
                                    }
                                  }}
                                  disabled={!correctionJustification.trim() || saveControlCorrectionMutation.isPending}
                                >
                                  {saveControlCorrectionMutation.isPending ? "Saving..." : "Save"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingControl(null);
                                    setCorrectionJustification("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {hasFullAccess && reportControlsData?.canEdit && !isEditing && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingControl(control);
                              setCorrectionStatus(control.correction?.correctedStatus || "PASS");
                              setCorrectionJustification(control.correction?.justification || "");
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            {control.correction ? "Edit" : "Correct"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowControlsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Report summary
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.hostname} - {formatDate(selectedReport?.auditDate)}
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Current score</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{selectedReport.score}%</span>
                    <Badge className={getGradeColor(selectedReport.grade)}>
                      {selectedReport.grade}
                    </Badge>
                  </div>
                  {selectedReport.originalScore != null && selectedReport.originalScore !== selectedReport.score && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Initial score: {selectedReport.originalScore}%
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Script</p>
                  <p className="font-medium">{selectedReport.scriptName || "Unknown"}</p>
                  {selectedReport.scriptVersion && (
                    <p className="text-xs text-muted-foreground">v{selectedReport.scriptVersion}</p>
                  )}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground mb-2">Control results</p>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xl font-bold">{selectedReport.totalControls}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-600">{selectedReport.passedControls}</p>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-red-600">{selectedReport.failedControls}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-yellow-600">{selectedReport.warningControls}</p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                </div>
              </div>
              
              {selectedReport.fileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileJson className="w-4 h-4" />
                  <span>File: {selectedReport.fileName}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveDialog} onOpenChange={(open) => {
        setShowMoveDialog(open);
        if (!open) {
          setMachineToMove(null);
          setTargetGroupId("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveHorizontal className="w-5 h-5" />
              Move machine
            </DialogTitle>
            <DialogDescription>
              {machineToMove && `Select the destination group for "${machineToMove.hostname}"`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Destination group</label>
              <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                <SelectTrigger data-testid="select-target-group">
                  <SelectValue placeholder="Select a group..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned (remove from group)</SelectItem>
                  {allMachineGroups?.map((group) => (
                    <SelectItem 
                      key={group.id} 
                      value={group.id.toString()}
                      disabled={machineToMove?.groupId === group.id}
                    >
                      {group.organizationName} / {group.siteName} / {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (machineToMove && targetGroupId) {
                  const groupId = targetGroupId === "unassigned" ? null : parseInt(targetGroupId);
                  moveMachineMutation.mutate({ machineId: machineToMove.id, groupId });
                }
              }}
              disabled={!targetGroupId || moveMachineMutation.isPending}
              data-testid="button-confirm-move"
            >
              {moveMachineMutation.isPending ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserGroupDialog} onOpenChange={(open) => {
        setShowUserGroupDialog(open);
        if (!open) {
          setNewUserGroupName("");
          setNewUserGroupDescription("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              New user group
            </DialogTitle>
            <DialogDescription>
              Create a group to manage permissions for multiple members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="user-group-name">Group name *</Label>
              <Input
                id="user-group-name"
                placeholder="e.g., Administrators, Technicians..."
                value={newUserGroupName}
                onChange={(e) => setNewUserGroupName(e.target.value)}
                data-testid="input-user-group-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-group-description">Description</Label>
              <Input
                id="user-group-description"
                placeholder="Group description..."
                value={newUserGroupDescription}
                onChange={(e) => setNewUserGroupDescription(e.target.value)}
                data-testid="input-user-group-description"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUserGroupDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createUserGroupMutation.mutate({ 
                name: newUserGroupName, 
                description: newUserGroupDescription || undefined 
              })}
              disabled={!newUserGroupName.trim() || createUserGroupMutation.isPending}
              data-testid="button-confirm-create-user-group"
            >
              {createUserGroupMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUserGroup} onOpenChange={(open) => {
        if (!open) setEditingUserGroup(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit group
            </DialogTitle>
          </DialogHeader>
          {editingUserGroup && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="edit-group-name">Group name *</Label>
                <Input
                  id="edit-group-name"
                  value={editingUserGroup.name}
                  onChange={(e) => setEditingUserGroup({ ...editingUserGroup, name: e.target.value })}
                  data-testid="input-edit-user-group-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-group-description">Description</Label>
                <Input
                  id="edit-group-description"
                  value={editingUserGroup.description || ""}
                  onChange={(e) => setEditingUserGroup({ ...editingUserGroup, description: e.target.value })}
                  data-testid="input-edit-user-group-description"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingUserGroup(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingUserGroup) {
                  updateUserGroupMutation.mutate({
                    id: editingUserGroup.id,
                    name: editingUserGroup.name,
                    description: editingUserGroup.description || undefined,
                  });
                }
              }}
              disabled={!editingUserGroup?.name.trim() || updateUserGroupMutation.isPending}
              data-testid="button-confirm-edit-user-group"
            >
              {updateUserGroupMutation.isPending ? "Updating..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserGroupMembersDialog} onOpenChange={(open) => {
        setShowUserGroupMembersDialog(open);
        if (!open) setSelectedUserGroup(null);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Group members: {selectedUserGroup?.name}
            </DialogTitle>
            <DialogDescription>
              Manage members of this user group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <h4 className="text-sm font-medium mb-2">Current members</h4>
              {userGroupMembersData && userGroupMembersData.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {userGroupMembersData.map((gm) => (
                    <div key={gm.id} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">
                        {gm.member?.firstName && gm.member?.lastName 
                          ? `${gm.member.firstName} ${gm.member.lastName}` 
                          : gm.member?.email || "Unknown member"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (selectedUserGroup) {
                            removeUserGroupMemberMutation.mutate({
                              userGroupId: selectedUserGroup.id,
                              teamMemberId: gm.teamMemberId,
                            });
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No members in this group</p>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Add a member</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {teamMembers
                  .filter(m => !userGroupMembersData?.some(gm => gm.teamMemberId === m.id))
                  .map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">
                        {member.firstName && member.lastName 
                          ? `${member.firstName} ${member.lastName}` 
                          : member.email}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedUserGroup) {
                            addUserGroupMemberMutation.mutate({
                              userGroupId: selectedUserGroup.id,
                              teamMemberId: member.id,
                            });
                          }
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                {teamMembers.filter(m => !userGroupMembersData?.some(gm => gm.teamMemberId === m.id)).length === 0 && (
                  <p className="text-sm text-muted-foreground">All members are already in this group</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserGroupMembersDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUserGroupPermissionsDialog} onOpenChange={(open) => {
        setShowUserGroupPermissionsDialog(open);
        if (!open) setSelectedUserGroup(null);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Group permissions: {selectedUserGroup?.name}
            </DialogTitle>
            <DialogDescription>
              Define which machine groups are accessible to this user group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {allMachineGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No machine groups available. First create a hierarchy (Organization / Site / Group).
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Machine group</TableHead>
                    <TableHead className="w-24 text-center">View</TableHead>
                    <TableHead className="w-24 text-center">Edit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allMachineGroups.map((machineGroup) => {
                    const permission = userGroupPermissionsData?.find(p => p.groupId === machineGroup.id);
                    return (
                      <TableRow key={machineGroup.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{machineGroup.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {machineGroup.organizationName} / {machineGroup.siteName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant={permission?.canView ? "default" : "outline"}
                            size="icon"
                            onClick={() => {
                              const newCanView = !permission?.canView;
                              setUserGroupPermissionMutation.mutate({
                                machineGroupId: machineGroup.id,
                                canView: newCanView,
                                canEdit: newCanView ? (permission?.canEdit || false) : false,
                              });
                            }}
                          >
                            {permission?.canView ? <Check className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant={permission?.canEdit ? "default" : "outline"}
                            size="icon"
                            disabled={!permission?.canView}
                            onClick={() => {
                              setUserGroupPermissionMutation.mutate({
                                machineGroupId: machineGroup.id,
                                canView: true,
                                canEdit: !permission?.canEdit,
                              });
                            }}
                          >
                            {permission?.canEdit ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserGroupPermissionsDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
