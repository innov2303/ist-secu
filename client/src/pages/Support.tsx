import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  MessageSquare, Plus, Send, Clock, CheckCircle2, 
  AlertCircle, Loader2, User, Shield, Calendar, LogOut,
  ChevronRight, Inbox, FileText
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SEO } from "@/components/SEO";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TicketUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin?: boolean;
}

interface TicketMessage {
  id: number;
  ticketId: number;
  userId: string;
  content: string;
  isAdminReply: number;
  createdAt: string;
  user: TicketUser | null;
}

interface Ticket {
  id: number;
  userId: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  user?: TicketUser | null;
  messages?: TicketMessage[];
}

const navItems = [
  { id: "tickets", label: "My Tickets", icon: Inbox },
  { id: "new", label: "New Ticket", icon: Plus },
];

export default function Support() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState("tickets");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState("general");
  const [newTicketPriority, setNewTicketPriority] = useState("normal");
  const [replyMessage, setReplyMessage] = useState("");

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
    enabled: !!user,
  });

  const { data: ticketDetails, isLoading: detailsLoading } = useQuery<Ticket>({
    queryKey: ["/api/tickets", selectedTicket?.id],
    enabled: !!selectedTicket,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; category: string; priority: string }) => {
      const res = await apiRequest("POST", "/api/tickets", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Ticket created", description: "Our team will respond soon." });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setNewTicketSubject("");
      setNewTicketMessage("");
      setNewTicketCategory("general");
      setNewTicketPriority("normal");
      setActiveTab("tickets");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create ticket", variant: "destructive" });
    },
  });

  const addMessageMutation = useMutation({
    mutationFn: async (data: { ticketId: number; content: string }) => {
      const res = await apiRequest("POST", `/api/tickets/${data.ticketId}/messages`, { content: data.content });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Reply sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setReplyMessage("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send reply", variant: "destructive" });
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>Support</CardTitle>
            <CardDescription>Please log in to access support.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild>
              <Link href="/auth">Log In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><AlertCircle className="h-3 w-3 mr-1" /> Open</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600"><Clock className="h-3 w-3 mr-1" /> In Progress</Badge>;
      case "resolved":
        return <Badge variant="outline" className="border-green-500 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Resolved</Badge>;
      case "closed":
        return <Badge variant="secondary"><CheckCircle2 className="h-3 w-3 mr-1" /> Closed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "low":
        return <Badge variant="outline" className="text-muted-foreground">Low</Badge>;
      case "normal":
        return <Badge variant="outline">Normal</Badge>;
      case "high":
        return <Badge variant="outline" className="border-orange-500 text-orange-600">High</Badge>;
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newTicketMessage.trim()) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    createTicketMutation.mutate({
      subject: newTicketSubject,
      message: newTicketMessage,
      category: newTicketCategory,
      priority: newTicketPriority,
    });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;
    addMessageMutation.mutate({
      ticketId: selectedTicket.id,
      content: replyMessage,
    });
  };

  const openTickets = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;

  return (
    <>
      <SEO 
        title="Support - Infra Shield Tools"
        description="Get help with Infra Shield Tools"
      />
      <div className="min-h-screen bg-background flex">
        <aside className="w-64 border-r bg-card flex flex-col h-screen sticky top-0">
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="overflow-hidden">
                <h2 className="font-bold text-sm truncate">Support</h2>
                <p className="text-xs text-muted-foreground truncate">
                  {openTickets > 0 ? `${openTickets} open ticket${openTickets > 1 ? "s" : ""}` : "No open tickets"}
                </p>
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
                    onClick={() => {
                      setActiveTab(item.id);
                      setSelectedTicket(null);
                    }}
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
                  {activeTab === "tickets" && (selectedTicket ? `Ticket #${selectedTicket.id}` : "My Tickets")}
                  {activeTab === "new" && "New Ticket"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "tickets" && (selectedTicket ? selectedTicket.subject : "View and manage your support tickets")}
                  {activeTab === "new" && "Create a new support request"}
                </p>
              </div>
              {activeTab === "tickets" && !selectedTicket && (
                <Button onClick={() => setActiveTab("new")} data-testid="button-new-ticket">
                  <Plus className="h-4 w-4 mr-2" />
                  New Ticket
                </Button>
              )}
              {selectedTicket && (
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTicket(null)}
                  data-testid="button-back-to-list"
                >
                  Back to list
                </Button>
              )}
            </div>
          </header>

          <div className="p-6">
            {activeTab === "tickets" && !selectedTicket && (
              <>
                {ticketsLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : tickets.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No tickets yet</h3>
                      <p className="text-muted-foreground mb-4">Create your first support ticket to get help.</p>
                      <Button onClick={() => setActiveTab("new")}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Ticket
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((ticket) => (
                      <Card 
                        key={ticket.id} 
                        className="cursor-pointer hover-elevate transition-all"
                        onClick={() => setSelectedTicket(ticket)}
                        data-testid={`ticket-${ticket.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-muted-foreground">#{ticket.id}</span>
                                {getStatusBadge(ticket.status)}
                                {getPriorityBadge(ticket.priority)}
                              </div>
                              <h3 className="font-medium truncate">{ticket.subject}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                <Calendar className="h-3 w-3 inline mr-1" />
                                {formatDate(ticket.createdAt)}
                              </p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "tickets" && selectedTicket && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(selectedTicket.status)}
                    {getPriorityBadge(selectedTicket.priority)}
                    <Badge variant="outline">{selectedTicket.category}</Badge>
                    <span className="text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {formatDate(selectedTicket.createdAt)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {detailsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="h-[400px] pr-4 mb-4">
                        <div className="space-y-4">
                          {ticketDetails?.messages?.map((msg) => (
                            <div 
                              key={msg.id} 
                              className={`flex gap-3 ${msg.isAdminReply ? "flex-row-reverse" : ""}`}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={msg.isAdminReply ? "bg-primary text-primary-foreground" : ""}>
                                  {msg.isAdminReply ? <Shield className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                </AvatarFallback>
                              </Avatar>
                              <div className={`flex-1 max-w-[80%] ${msg.isAdminReply ? "text-right" : ""}`}>
                                <div className={`rounded-lg p-3 ${msg.isAdminReply ? "bg-primary/10 ml-auto" : "bg-muted"}`}>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium">
                                      {msg.isAdminReply ? "Support Team" : (msg.user?.firstName || msg.user?.email || "User")}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(msg.createdAt)}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {selectedTicket.status !== "closed" && (
                        <form onSubmit={handleSendReply} className="flex gap-2">
                          <Textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Type your reply..."
                            className="flex-1 min-h-[80px]"
                            data-testid="input-reply"
                          />
                          <Button 
                            type="submit" 
                            disabled={!replyMessage.trim() || addMessageMutation.isPending}
                            data-testid="button-send-reply"
                          >
                            {addMessageMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </form>
                      )}

                      {selectedTicket.status === "closed" && (
                        <div className="text-center py-4 text-muted-foreground">
                          This ticket is closed and cannot receive new replies.
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "new" && (
              <Card>
                <CardHeader>
                  <CardTitle>Create Support Ticket</CardTitle>
                  <CardDescription>Describe your issue and we'll get back to you as soon as possible.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={newTicketSubject}
                        onChange={(e) => setNewTicketSubject(e.target.value)}
                        placeholder="Brief description of your issue"
                        data-testid="input-subject"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={newTicketCategory} onValueChange={setNewTicketCategory}>
                          <SelectTrigger data-testid="select-category">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="technical">Technical</SelectItem>
                            <SelectItem value="billing">Billing</SelectItem>
                            <SelectItem value="feature_request">Feature Request</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={newTicketPriority} onValueChange={setNewTicketPriority}>
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        value={newTicketMessage}
                        onChange={(e) => setNewTicketMessage(e.target.value)}
                        placeholder="Describe your issue in detail..."
                        className="min-h-[150px]"
                        data-testid="input-message"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setActiveTab("tickets")}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createTicketMutation.isPending}
                        data-testid="button-submit-ticket"
                      >
                        {createTicketMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Ticket
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
