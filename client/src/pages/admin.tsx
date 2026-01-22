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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Trash2, Users, ArrowLeft, MessageSquare, CheckCircle, Clock, Mail, Search, 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Package, Shield, Home, Settings, Pencil, Loader2,
  AlertTriangle, Power, Wrench, RefreshCw, Check, X, List, ToggleLeft, ToggleRight,
  FileText, Plus, Eye, Send, CreditCard, CalendarDays, User as UserIcon, KeyRound, Copy
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@shared/models/auth";
import type { ContactRequest, Script, Invoice, InvoiceItem } from "@shared/schema";
import { Link } from "wouter";

type InvoiceStatus = "draft" | "sent" | "paid" | "cancelled" | "overdue";

const invoiceStatusLabels: Record<InvoiceStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  sent: { label: "Envoyee", variant: "outline" },
  paid: { label: "Payee", variant: "default" },
  cancelled: { label: "Annulee", variant: "destructive" },
  overdue: { label: "En retard", variant: "destructive" },
};

const ITEMS_PER_PAGE = 10;

type AdminSection = "users" | "tickets" | "toolkits" | "invoices";
type ScriptStatus = "active" | "offline" | "maintenance";

const statusLabels: Record<ScriptStatus, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof Power }> = {
  active: { label: "Online", variant: "default", icon: Power },
  offline: { label: "Offline", variant: "destructive", icon: AlertTriangle },
  maintenance: { label: "Maintenance", variant: "secondary", icon: Wrench },
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
  
  // Update checker state
  const [checkingUpdatesFor, setCheckingUpdatesFor] = useState<number | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [applyingUpdates, setApplyingUpdates] = useState(false);
  
  // Controls viewer state
  const [viewingControlsFor, setViewingControlsFor] = useState<{ id: number; name: string } | null>(null);
  const [scriptControls, setScriptControls] = useState<{
    id: number;
    controlId: string;
    name: string;
    description: string;
    category: string;
    severity: string;
    reference: string;
    enabled: number;
    addedAt: string;
  }[]>([]);
  const [updateSuggestions, setUpdateSuggestions] = useState<{
    toolkit: { id: number; name: string; os: string; currentControlCount: number };
    standards: { id: string; name: string; version: string }[];
    totalReferenceControls: number;
    suggestions: {
      id: string;
      name: string;
      description: string;
      category: string;
      severity: string;
      reference: string;
      implementationHint?: string;
      recommended: boolean;
    }[];
    analysisDate: string;
    message: string;
  } | null>(null);

  // Password reset state
  const [resetPasswordResult, setResetPasswordResult] = useState<{ email: string; password: string } | null>(null);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!user?.isAdmin,
  });

  const { data: contactRequests, isLoading: contactLoading } = useQuery<ContactRequest[]>({
    queryKey: ["/api/admin/contact-requests"],
    enabled: !!user?.isAdmin,
  });

  const { data: scripts, isLoading: scriptsLoading } = useQuery<Script[]>({
    queryKey: ["/api/scripts/all"],
    enabled: !!user?.isAdmin,
  });

  // Invoice queries and state
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<{ invoice: Invoice; items: InvoiceItem[] } | null>(null);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [newInvoice, setNewInvoice] = useState({
    userId: "",
    customerName: "",
    customerEmail: "",
    customerAddress: "",
    taxRate: 20,
    notes: "",
    dueDate: "",
    items: [] as Array<{ scriptId?: number; description: string; quantity: number; unitPriceCents: number }>
  });

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ["/api/admin/invoices"],
    enabled: !!user?.isAdmin,
  });
  const allInvoices = invoicesData?.invoices || [];

  const { data: usersListData } = useQuery<{ users: { id: string; firstName: string | null; lastName: string | null; email: string | null }[] }>({
    queryKey: ["/api/admin/users-list"],
    enabled: !!user?.isAdmin,
  });
  const usersList = usersListData?.users || [];

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

  // Scripts filtering and pagination - only show toolkits (bundles with bundledScriptIds)
  const filteredScripts = useMemo(() => {
    if (!scripts) return [];
    // Filter to only show toolkits (scripts that have bundledScriptIds)
    const toolkits = scripts.filter(s => s.bundledScriptIds && s.bundledScriptIds.length > 0);
    if (!scriptSearch.trim()) return toolkits;
    const search = scriptSearch.toLowerCase();
    return toolkits.filter(s => 
      s.name?.toLowerCase().includes(search) ||
      s.os?.toLowerCase().includes(search)
    );
  }, [scripts, scriptSearch]);

  const totalScriptPages = Math.ceil(filteredScripts.length / ITEMS_PER_PAGE);
  const paginatedScripts = useMemo(() => {
    const start = (scriptPage - 1) * ITEMS_PER_PAGE;
    return filteredScripts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredScripts, scriptPage]);

  // Invoices filtering and pagination
  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return allInvoices;
    const search = invoiceSearch.toLowerCase();
    return allInvoices.filter(inv => 
      inv.invoiceNumber?.toLowerCase().includes(search) ||
      inv.customerName?.toLowerCase().includes(search) ||
      inv.customerEmail?.toLowerCase().includes(search)
    );
  }, [allInvoices, invoiceSearch]);

  // Group invoices by user for the grouped display
  const invoicesByUser = useMemo(() => {
    const grouped: Record<string, { 
      userId: string; 
      customerName: string; 
      customerEmail: string;
      invoices: Invoice[];
      totalAmount: number;
      paidCount: number;
    }> = {};
    
    filteredInvoices.forEach(invoice => {
      const userId = invoice.userId || 'unknown';
      if (!grouped[userId]) {
        grouped[userId] = {
          userId,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          invoices: [],
          totalAmount: 0,
          paidCount: 0,
        };
      }
      grouped[userId].invoices.push(invoice);
      grouped[userId].totalAmount += invoice.totalCents;
      if (invoice.status === 'paid') {
        grouped[userId].paidCount++;
      }
    });
    
    // Sort by most recent invoice
    return Object.values(grouped).sort((a, b) => {
      const aLatest = Math.max(...a.invoices.map(i => new Date(i.createdAt).getTime()));
      const bLatest = Math.max(...b.invoices.map(i => new Date(i.createdAt).getTime()));
      return bLatest - aLatest;
    });
  }, [filteredInvoices]);

  const toggleUserExpanded = (userId: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Count by invoice status
  const toolkitCount = useMemo(() => {
    if (!scripts) return 0;
    return scripts.filter(s => s.bundledScriptIds && s.bundledScriptIds.length > 0).length;
  }, [scripts]);

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

  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiRequest("POST", `/api/admin/users/${userId}/reset-password`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(data.message || "Erreur lors de la reinitialisation");
      }
      return response.json();
    },
    onSuccess: (data: { newPassword: string; userEmail: string }) => {
      setResetPasswordResult({ email: data.userEmail, password: data.newPassword });
      toast({ title: "Mot de passe reinitialise" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/scripts/all"] });
      toast({ title: "Toolkit mis à jour" });
      setEditingScript(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le toolkit", variant: "destructive" });
    },
  });

  const syncStripeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/scripts/sync-stripe");
      return res.json();
    },
    onSuccess: (data) => {
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      toast({ title: "Synchronisation terminee", description: `${successCount} produit(s) synchronise(s) avec Stripe` });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de synchroniser avec Stripe", variant: "destructive" });
    },
  });

  const checkUpdatesMutation = useMutation({
    mutationFn: async (scriptId: number) => {
      setCheckingUpdatesFor(scriptId);
      const response = await apiRequest("GET", `/api/admin/scripts/${scriptId}/check-updates`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(errorData.message || "Erreur lors de la vérification");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data && data.toolkit) {
        setUpdateSuggestions(data);
        setSelectedSuggestions(new Set());
      } else {
        toast({ title: "Erreur", description: data?.message || "Données invalides reçues", variant: "destructive" });
      }
      setCheckingUpdatesFor(null);
    },
    onError: (error: Error) => {
      setCheckingUpdatesFor(null);
      toast({ title: "Erreur", description: error.message || "Impossible de vérifier les mises à jour", variant: "destructive" });
    },
  });

  const applyUpdatesMutation = useMutation({
    mutationFn: async ({ scriptId, controls }: { scriptId: number; controls: { id: string; name: string; description: string; category: string; severity: string; reference: string; implementationHint?: string }[] }) => {
      setApplyingUpdates(true);
      const response = await apiRequest("POST", `/api/admin/scripts/${scriptId}/apply-updates`, { controls });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(errorData.message || "Erreur lors de la mise à jour");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setApplyingUpdates(false);
      toast({ 
        title: "Controles ajoutes", 
        description: `${data.addedControls || 0} controle(s) ajoute(s) au script` 
      });
      setUpdateSuggestions(null);
      setSelectedSuggestions(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/scripts/all"] });
    },
    onError: (error: Error) => {
      setApplyingUpdates(false);
      toast({ title: "Erreur", description: error.message || "Impossible d'appliquer les mises à jour", variant: "destructive" });
    },
  });

  // Invoice mutations
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: typeof newInvoice) => {
      const response = await apiRequest("POST", "/api/admin/invoices", data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Erreur inconnue" }));
        throw new Error(errorData.message || "Erreur lors de la creation de la facture");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: "Facture creee", description: "La facture a ete creee avec succes" });
      setShowInvoiceDialog(false);
      setNewInvoice({
        userId: "",
        customerName: "",
        customerEmail: "",
        customerAddress: "",
        taxRate: 20,
        notes: "",
        dueDate: "",
        items: []
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/invoices/${id}`, { status });
      if (!response.ok) throw new Error("Erreur");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: "Statut mis a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de mettre a jour le statut", variant: "destructive" });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/admin/invoices/${id}`);
      if (!response.ok) throw new Error("Erreur");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      toast({ title: "Facture supprimee" });
      setViewingInvoice(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer la facture", variant: "destructive" });
    },
  });

  const viewInvoiceDetails = async (invoiceId: number) => {
    try {
      const response = await apiRequest("GET", `/api/admin/invoices/${invoiceId}`);
      if (response.ok) {
        const data = await response.json();
        setViewingInvoice(data);
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger la facture", variant: "destructive" });
    }
  };

  const addItemToNewInvoice = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: "", quantity: 1, unitPriceCents: 0 }]
    }));
  };

  const updateItemInNewInvoice = (index: number, field: string, value: string | number) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  const removeItemFromNewInvoice = (index: number) => {
    setNewInvoice(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const selectUserForInvoice = (userId: string) => {
    const selectedUser = usersList.find(u => u.id === userId);
    if (selectedUser) {
      setNewInvoice(prev => ({
        ...prev,
        userId,
        customerName: `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || 'Client',
        customerEmail: selectedUser.email || ''
      }));
    }
  };

  const selectScriptForItem = (index: number, scriptId: string) => {
    const script = scripts?.find(s => s.id === parseInt(scriptId));
    if (script) {
      setNewInvoice(prev => ({
        ...prev,
        items: prev.items.map((item, i) => i === index ? {
          ...item,
          scriptId: script.id,
          description: script.name,
          unitPriceCents: script.monthlyPriceCents
        } : item)
      }));
    }
  };

  const toggleSuggestionSelection = (id: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllSuggestions = () => {
    if (updateSuggestions) {
      setSelectedSuggestions(new Set(updateSuggestions.suggestions.map(s => s.id)));
    }
  };

  const deselectAllSuggestions = () => {
    setSelectedSuggestions(new Set());
  };

  const handleApplyUpdates = () => {
    if (!updateSuggestions || selectedSuggestions.size === 0) return;
    
    const selectedControls = updateSuggestions.suggestions.filter(s => selectedSuggestions.has(s.id));
    applyUpdatesMutation.mutate({
      scriptId: updateSuggestions.toolkit.id,
      controls: selectedControls
    });
  };

  const fetchScriptControls = async (scriptId: number) => {
    try {
      const response = await apiRequest("GET", `/api/admin/scripts/${scriptId}/controls`);
      const data = await response.json();
      setScriptControls(data.controls || []);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de charger les controles", variant: "destructive" });
    }
  };

  const toggleControlMutation = useMutation({
    mutationFn: async (controlId: number) => {
      const response = await apiRequest("PATCH", `/api/admin/controls/${controlId}/toggle`);
      return response.json();
    },
    onSuccess: () => {
      if (viewingControlsFor) {
        fetchScriptControls(viewingControlsFor.id);
      }
      toast({ title: "Controle mis a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le controle", variant: "destructive" });
    },
  });

  const deleteControlMutation = useMutation({
    mutationFn: async (controlId: number) => {
      await apiRequest("DELETE", `/api/admin/controls/${controlId}`);
    },
    onSuccess: () => {
      if (viewingControlsFor) {
        fetchScriptControls(viewingControlsFor.id);
      }
      toast({ title: "Controle supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer le controle", variant: "destructive" });
    },
  });

  const openControlsViewer = async (script: Script) => {
    setViewingControlsFor({ id: script.id, name: script.name });
    await fetchScriptControls(script.id);
  };

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
    { id: "toolkits" as AdminSection, label: "Gestion des toolkit", icon: Package, count: toolkitCount },
    { id: "invoices" as AdminSection, label: "Facturation", icon: FileText, count: allInvoices.length },
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
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => resetPasswordMutation.mutate(u.id)}
                              disabled={u.id === user.id || resetPasswordMutation.isPending}
                              title="Regenerer le mot de passe"
                              data-testid={`button-reset-password-${u.id}`}
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => deleteUserMutation.mutate(u.id)}
                              disabled={u.id === user.id || deleteUserMutation.isPending}
                              title="Supprimer l'utilisateur"
                              data-testid={`button-delete-user-${u.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
                        {filteredScripts.length} toolkit(s) configure(s)
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncStripeMutation.mutate()}
                        disabled={syncStripeMutation.isPending}
                        data-testid="button-sync-stripe"
                      >
                        {syncStripeMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sync Stripe
                      </Button>
                      <div className="relative w-full sm:w-48">
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
                                onClick={() => openControlsViewer(script)}
                                title="Voir les controles ajoutes"
                                data-testid={`button-view-controls-${script.id}`}
                              >
                                <List className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => checkUpdatesMutation.mutate(script.id)}
                                disabled={checkingUpdatesFor === script.id}
                                title="Verifier les mises a jour"
                                data-testid={`button-check-updates-${script.id}`}
                              >
                                {checkingUpdatesFor === script.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
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

          {/* Invoices Section */}
          {activeSection === "invoices" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <h2 className="text-2xl font-bold">Gestion des factures</h2>
                    <p className="text-muted-foreground">Creer et suivre les factures clients</p>
                  </div>
                </div>
                <Button onClick={() => setShowInvoiceDialog(true)} data-testid="button-new-invoice">
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle facture
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle>Liste des factures</CardTitle>
                      <CardDescription>
                        {filteredInvoices.length} facture(s) - {allInvoices.filter(i => i.status === "paid").length} payee(s)
                      </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher..."
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        className="pl-9"
                        data-testid="input-invoice-search"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {invoicesLoading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : invoicesByUser.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>{invoiceSearch ? "Aucune facture trouvee" : "Aucune facture"}</p>
                      <p className="text-sm">Creez votre premiere facture pour commencer.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {invoicesByUser.map((userGroup) => {
                        const isExpanded = expandedUsers.has(userGroup.userId);
                        return (
                          <div
                            key={userGroup.userId}
                            className="rounded-lg border bg-card overflow-hidden"
                            data-testid={`row-user-invoices-${userGroup.userId}`}
                          >
                            <div
                              className="flex items-center justify-between p-4 cursor-pointer hover-elevate"
                              onClick={() => toggleUserExpanded(userGroup.userId)}
                              data-testid={`button-expand-user-${userGroup.userId}`}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="p-2 rounded-lg bg-muted">
                                  <UserIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium" data-testid={`text-user-name-${userGroup.userId}`}>
                                      {userGroup.customerName}
                                    </span>
                                    <Badge variant="outline">{userGroup.invoices.length} facture(s)</Badge>
                                    <Badge variant="default">{userGroup.paidCount} payee(s)</Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {userGroup.customerEmail}
                                  </div>
                                </div>
                                <div className="text-right mr-4">
                                  <div className="font-bold text-lg" data-testid={`text-user-total-${userGroup.userId}`}>
                                    {formatPrice(userGroup.totalAmount)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Total factures
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                            
                            {isExpanded && (
                              <div className="border-t bg-muted/30 p-4 space-y-3">
                                {userGroup.invoices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((invoice) => {
                                  const statusInfo = invoiceStatusLabels[invoice.status as InvoiceStatus] || invoiceStatusLabels.draft;
                                  return (
                                    <div
                                      key={invoice.id}
                                      className="flex items-center justify-between p-3 rounded-lg bg-card border hover-elevate"
                                      data-testid={`row-invoice-${invoice.id}`}
                                    >
                                      <div className="flex items-center gap-3 flex-1">
                                        <div className="p-1.5 rounded bg-muted">
                                          <FileText className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium font-mono text-sm" data-testid={`text-invoice-number-${invoice.id}`}>
                                              {invoice.invoiceNumber}
                                            </span>
                                            <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-1">
                                            Cree le {new Date(invoice.createdAt).toLocaleDateString('fr-FR')}
                                            {invoice.dueDate && (
                                              <span className="ml-2">
                                                Echeance: {new Date(invoice.dueDate).toLocaleDateString('fr-FR')}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-bold" data-testid={`text-invoice-total-${invoice.id}`}>
                                            {formatPrice(invoice.totalCents)}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                            HT: {formatPrice(invoice.subtotalCents)} + TVA {invoice.taxRate}%
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 ml-4">
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          onClick={(e) => { e.stopPropagation(); viewInvoiceDetails(invoice.id); }}
                                          title="Voir details"
                                          data-testid={`button-view-invoice-${invoice.id}`}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        {invoice.status === "draft" && (
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={(e) => { e.stopPropagation(); updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "sent" }); }}
                                            title="Marquer comme envoyee"
                                            data-testid={`button-send-invoice-${invoice.id}`}
                                          >
                                            <Send className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {invoice.status === "sent" && (
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={(e) => { e.stopPropagation(); updateInvoiceStatusMutation.mutate({ id: invoice.id, status: "paid" }); }}
                                            title="Marquer comme payee"
                                            data-testid={`button-paid-invoice-${invoice.id}`}
                                          >
                                            <CreditCard className="h-4 w-4" />
                                          </Button>
                                        )}
                                        <Button
                                          variant="destructive"
                                          size="icon"
                                          onClick={(e) => { e.stopPropagation(); deleteInvoiceMutation.mutate(invoice.id); }}
                                          disabled={deleteInvoiceMutation.isPending}
                                          title="Supprimer"
                                          data-testid={`button-delete-invoice-${invoice.id}`}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {invoicesByUser.length > 10 && (
                    <div className="flex items-center justify-center mt-6 pt-4 border-t">
                      <p className="text-sm text-muted-foreground">{invoicesByUser.length} utilisateur(s) - {filteredInvoices.length} facture(s) au total</p>
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
                      Online
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
                      Maintenance
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

      {/* Update Suggestions Dialog */}
      <Dialog open={!!updateSuggestions} onOpenChange={(open) => !open && setUpdateSuggestions(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-update-suggestions">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Suggestions de mise à jour
            </DialogTitle>
            <DialogDescription>
              {updateSuggestions && (
                <span data-testid="text-toolkit-analysis">
                  Analyse du toolkit <strong>{updateSuggestions.toolkit.name}</strong> ({updateSuggestions.toolkit.os})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {updateSuggestions && (
            <div className="space-y-4 py-2">
              {/* Standards Reference */}
              <div className="p-3 rounded-lg bg-muted/50" data-testid="section-standards-reference">
                <div className="text-sm font-medium mb-2">Standards de référence</div>
                <div className="flex flex-wrap gap-2">
                  {updateSuggestions.standards.map((standard) => (
                    <Badge key={standard.id} variant="outline" data-testid={`badge-standard-${standard.id}`}>
                      {standard.name} v{standard.version}
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mt-2" data-testid="text-total-controls">
                  {updateSuggestions.totalReferenceControls} contrôles dans la base de référence
                </div>
              </div>

              {/* Current Status */}
              <div className="flex items-center justify-between p-3 rounded-lg border" data-testid="section-current-status">
                <div>
                  <div className="font-medium">Contrôles actuels</div>
                  <div className="text-sm text-muted-foreground" data-testid="text-current-controls">
                    ~{updateSuggestions.toolkit.currentControlCount} contrôles implémentés
                  </div>
                </div>
                <Badge variant="secondary" data-testid="badge-suggestions-count">
                  {updateSuggestions.suggestions.length} suggestions
                </Badge>
              </div>

              {/* Suggestions List */}
              {updateSuggestions.suggestions.length > 0 ? (
                <div className="space-y-2" data-testid="section-suggestions-list">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">Contrôles suggérés</div>
                    <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
                      {selectedSuggestions.size} sélectionné(s)
                    </span>
                  </div>
                  {updateSuggestions.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.id}
                      className={`p-3 rounded-lg border bg-card hover-elevate cursor-pointer ${selectedSuggestions.has(suggestion.id) ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => toggleSuggestionSelection(suggestion.id)}
                      data-testid={`card-suggestion-${suggestion.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedSuggestions.has(suggestion.id)}
                          onCheckedChange={() => toggleSuggestionSelection(suggestion.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                          data-testid={`checkbox-suggestion-${suggestion.id}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium" data-testid={`text-suggestion-name-${suggestion.id}`}>{suggestion.name}</span>
                            <Badge 
                              variant={
                                suggestion.severity === "critical" ? "destructive" : 
                                suggestion.severity === "high" ? "default" : 
                                "secondary"
                              }
                              className="text-xs"
                              data-testid={`badge-suggestion-severity-${suggestion.id}`}
                            >
                              {suggestion.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs" data-testid={`badge-suggestion-category-${suggestion.id}`}>
                              {suggestion.category}
                            </Badge>
                            {suggestion.recommended && (
                              <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-500/50" data-testid={`badge-suggestion-recommended-${suggestion.id}`}>
                                Recommandé
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1" data-testid={`text-suggestion-description-${suggestion.id}`}>
                            {suggestion.description}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1" data-testid={`text-suggestion-reference-${suggestion.id}`}>
                            <span className="font-medium">Ref:</span> {suggestion.reference}
                            {suggestion.implementationHint && (
                              <span className="ml-2">• {suggestion.implementationHint}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs font-mono" data-testid={`badge-suggestion-id-${suggestion.id}`}>
                            {suggestion.id}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground" data-testid="section-no-suggestions">
                  <Check className="h-8 w-8 mx-auto mb-2 text-green-500" data-testid="icon-no-suggestions" />
                  <p data-testid="text-no-suggestions-title">Aucune suggestion de mise à jour</p>
                  <p className="text-sm" data-testid="text-no-suggestions-message">Le toolkit est à jour avec les standards de référence.</p>
                </div>
              )}

              {/* Analysis Info */}
              <div className="text-xs text-muted-foreground text-center pt-2 border-t" data-testid="text-analysis-date">
                Analyse effectuée le {new Date(updateSuggestions.analysisDate).toLocaleString('fr-FR')}
              </div>
            </div>
          )}
          
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 mr-auto">
              {updateSuggestions && updateSuggestions.suggestions.length > 0 && (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAllSuggestions}
                    data-testid="button-select-all"
                  >
                    Tout sélectionner
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={deselectAllSuggestions}
                    data-testid="button-deselect-all"
                  >
                    Tout désélectionner
                  </Button>
                </>
              )}
            </div>
            <Button variant="outline" onClick={() => { setUpdateSuggestions(null); setSelectedSuggestions(new Set()); }} data-testid="button-close-suggestions">
              Fermer
            </Button>
            {updateSuggestions && updateSuggestions.suggestions.length > 0 && (
              <Button 
                onClick={handleApplyUpdates}
                disabled={selectedSuggestions.size === 0 || applyingUpdates}
                data-testid="button-apply-updates"
              >
                {applyingUpdates ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ajout en cours...
                  </>
                ) : (
                  <>
                    Ajouter au script ({selectedSuggestions.size})
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Controls Viewer Dialog */}
      <Dialog open={!!viewingControlsFor} onOpenChange={(open) => !open && setViewingControlsFor(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid="dialog-controls-title">Controles ajoutes - {viewingControlsFor?.name}</DialogTitle>
            <DialogDescription data-testid="dialog-controls-description">
              Liste des controles de securite ajoutes dynamiquement a ce toolkit
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-2 py-4" data-testid="section-controls-list">
            {scriptControls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="section-no-controls">
                <List className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun controle ajoute</p>
                <p className="text-sm">Utilisez le verificateur de mises a jour pour ajouter des controles.</p>
              </div>
            ) : (
              <>
                <div className="text-sm text-muted-foreground mb-4" data-testid="text-controls-count">
                  {scriptControls.length} controle(s) ajoute(s)
                </div>
                {scriptControls.map((control) => (
                  <div
                    key={control.id}
                    className={`p-3 rounded-lg border bg-card ${control.enabled ? '' : 'opacity-50'}`}
                    data-testid={`card-control-${control.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium" data-testid={`text-control-name-${control.id}`}>{control.name}</span>
                          <Badge variant="outline" className="text-xs font-mono">{control.controlId}</Badge>
                          <Badge 
                            variant={
                              control.severity === "critical" ? "destructive" : 
                              control.severity === "high" ? "default" : 
                              "secondary"
                            }
                            className="text-xs"
                          >
                            {control.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{control.category}</Badge>
                          {control.enabled === 0 && (
                            <Badge variant="secondary" className="text-xs">Desactive</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">{control.description}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Ref:</span> {control.reference}
                          <span className="ml-2">Ajoute le {new Date(control.addedAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleControlMutation.mutate(control.id)}
                          title={control.enabled ? "Desactiver" : "Activer"}
                          data-testid={`button-toggle-control-${control.id}`}
                        >
                          {control.enabled ? (
                            <ToggleRight className="h-4 w-4 text-green-500" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteControlMutation.mutate(control.id)}
                          title="Supprimer"
                          data-testid={`button-delete-control-${control.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingControlsFor(null)} data-testid="button-close-controls">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Invoice Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
            <DialogDescription>
              Creer une nouvelle facture pour un client
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={newInvoice.userId} onValueChange={selectUserForInvoice}>
                <SelectTrigger data-testid="select-invoice-customer">
                  <SelectValue placeholder="Selectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} - {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom du client</Label>
                <Input
                  value={newInvoice.customerName}
                  onChange={e => setNewInvoice(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Nom complet"
                  data-testid="input-invoice-customer-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newInvoice.customerEmail}
                  onChange={e => setNewInvoice(prev => ({ ...prev, customerEmail: e.target.value }))}
                  placeholder="email@example.com"
                  data-testid="input-invoice-customer-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Adresse (optionnel)</Label>
              <Textarea
                value={newInvoice.customerAddress}
                onChange={e => setNewInvoice(prev => ({ ...prev, customerAddress: e.target.value }))}
                placeholder="Adresse de facturation"
                rows={2}
                data-testid="input-invoice-address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Taux TVA (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={newInvoice.taxRate}
                  onChange={e => setNewInvoice(prev => ({ ...prev, taxRate: parseInt(e.target.value) || 0 }))}
                  data-testid="input-invoice-tax-rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Date d'echeance</Label>
                <Input
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={e => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                  data-testid="input-invoice-due-date"
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Articles</Label>
                <Button variant="outline" size="sm" onClick={addItemToNewInvoice} data-testid="button-add-item">
                  <Plus className="h-4 w-4 mr-1" />
                  Ajouter
                </Button>
              </div>
              
              {newInvoice.items.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
                  Aucun article. Ajoutez des articles a la facture.
                </div>
              ) : (
                <div className="space-y-2">
                  {newInvoice.items.map((item, index) => (
                    <div key={index} className="p-3 border rounded-lg space-y-2" data-testid={`invoice-item-${index}`}>
                      <div className="flex items-center gap-2">
                        <Select 
                          value={item.scriptId?.toString() || ""} 
                          onValueChange={(v) => selectScriptForItem(index, v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Choisir un toolkit (optionnel)" />
                          </SelectTrigger>
                          <SelectContent>
                            {scripts?.filter(s => s.bundledScriptIds && s.bundledScriptIds.length > 0).map(s => (
                              <SelectItem key={s.id} value={s.id.toString()}>
                                {s.name} - {formatPrice(s.monthlyPriceCents)}/mois
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItemFromNewInvoice(index)}
                          data-testid={`button-remove-item-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={e => updateItemInNewInvoice(index, 'description', e.target.value)}
                          className="col-span-1"
                        />
                        <Input
                          type="number"
                          min={1}
                          placeholder="Qte"
                          value={item.quantity}
                          onChange={e => updateItemInNewInvoice(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="Prix EUR"
                          value={item.unitPriceCents / 100}
                          onChange={e => updateItemInNewInvoice(index, 'unitPriceCents', Math.round(parseFloat(e.target.value) * 100) || 0)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            {newInvoice.items.length > 0 && (
              <div className="border-t pt-4 space-y-1">
                {(() => {
                  const subtotal = newInvoice.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
                  const tax = Math.round(subtotal * newInvoice.taxRate / 100);
                  const total = subtotal + tax;
                  return (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Sous-total HT:</span>
                        <span>{formatPrice(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>TVA ({newInvoice.taxRate}%):</span>
                        <span>{formatPrice(tax)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total TTC:</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                value={newInvoice.notes}
                onChange={e => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes ou conditions particulieres"
                rows={2}
                data-testid="input-invoice-notes"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => createInvoiceMutation.mutate(newInvoice)}
              disabled={!newInvoice.customerName || !newInvoice.customerEmail || newInvoice.items.length === 0 || createInvoiceMutation.isPending}
              data-testid="button-create-invoice"
            >
              {createInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creation...
                </>
              ) : (
                "Creer la facture"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="sm:max-w-2xl">
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
            <div className="space-y-4 py-4">
              {/* Status and dates */}
              <div className="flex items-center justify-between">
                <Badge variant={invoiceStatusLabels[viewingInvoice.invoice.status as InvoiceStatus]?.variant || "secondary"}>
                  {invoiceStatusLabels[viewingInvoice.invoice.status as InvoiceStatus]?.label || viewingInvoice.invoice.status}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  Creee le {new Date(viewingInvoice.invoice.createdAt).toLocaleDateString('fr-FR')}
                </div>
              </div>

              {/* Customer info */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="font-medium">{viewingInvoice.invoice.customerName}</div>
                <div className="text-sm text-muted-foreground">{viewingInvoice.invoice.customerEmail}</div>
                {viewingInvoice.invoice.customerAddress && (
                  <div className="text-sm text-muted-foreground mt-1">{viewingInvoice.invoice.customerAddress}</div>
                )}
              </div>

              {/* Items */}
              <div className="space-y-2">
                <Label>Articles</Label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2">Description</th>
                        <th className="text-center p-2">Qte</th>
                        <th className="text-right p-2">Prix unit.</th>
                        <th className="text-right p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingInvoice.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.description}</td>
                          <td className="p-2 text-center">{item.quantity}</td>
                          <td className="p-2 text-right">{formatPrice(item.unitPriceCents)}</td>
                          <td className="p-2 text-right">{formatPrice(item.totalCents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Sous-total HT:</span>
                  <span>{formatPrice(viewingInvoice.invoice.subtotalCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>TVA ({viewingInvoice.invoice.taxRate}%):</span>
                  <span>{formatPrice(viewingInvoice.invoice.taxCents)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span>Total TTC:</span>
                  <span>{formatPrice(viewingInvoice.invoice.totalCents)}</span>
                </div>
              </div>

              {viewingInvoice.invoice.notes && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <span className="font-medium">Notes:</span> {viewingInvoice.invoice.notes}
                </div>
              )}

              {/* Due date and payment info */}
              <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
                {viewingInvoice.invoice.dueDate && (
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    Echeance: {new Date(viewingInvoice.invoice.dueDate).toLocaleDateString('fr-FR')}
                  </div>
                )}
                {viewingInvoice.invoice.paidAt && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CreditCard className="h-4 w-4" />
                    Payee le {new Date(viewingInvoice.invoice.paidAt).toLocaleDateString('fr-FR')}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingInvoice(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Result Dialog */}
      <Dialog open={!!resetPasswordResult} onOpenChange={(open) => !open && setResetPasswordResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Nouveau mot de passe genere
            </DialogTitle>
            <DialogDescription>
              Communiquez ce mot de passe a l'utilisateur. Il ne sera plus visible apres la fermeture de cette fenetre.
            </DialogDescription>
          </DialogHeader>
          
          {resetPasswordResult && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Utilisateur</p>
                <p className="font-medium">{resetPasswordResult.email}</p>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Nouveau mot de passe</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-lg font-mono font-bold text-primary" data-testid="text-new-password">
                    {resetPasswordResult.password}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(resetPasswordResult.password);
                      toast({ title: "Mot de passe copie" });
                    }}
                    title="Copier le mot de passe"
                    data-testid="button-copy-password"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button onClick={() => setResetPasswordResult(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
