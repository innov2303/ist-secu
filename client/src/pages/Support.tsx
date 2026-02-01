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
  MessageSquare, Plus, Send, ArrowLeft, Clock, CheckCircle2, 
  AlertCircle, Loader2, User, Shield, Calendar 
} from "lucide-react";
import { Link } from "wouter";
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

export default function Support() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
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
      toast({ title: "Ticket created", description: "Your support request has been submitted." });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setShowNewTicketDialog(false);
      setNewTicketSubject("");
      setNewTicketMessage("");
      setNewTicketCategory("general");
      setNewTicketPriority("normal");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create ticket", variant: "destructive" });
    },
  });

  const addMessageMutation = useMutation({
    mutationFn: async ({ ticketId, content }: { ticketId: number; content: string }) => {
      const res = await apiRequest("POST", `/api/tickets/${ticketId}/messages`, { content });
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
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
            <CardDescription>Please log in to access support.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth">
              <Button>Log In</Button>
            </Link>
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
      toast({ title: "Error", description: "Subject and message are required", variant: "destructive" });
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

  return (
    <>
      <SEO 
        title="Support - Infra Shield Tools"
        description="Get help with Infra Shield Tools"
      />
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="mb-4">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Support</h1>
              <p className="text-muted-foreground">Get help with your questions</p>
            </div>
          </div>
          <Button onClick={() => setShowNewTicketDialog(true)} data-testid="button-new-ticket">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {selectedTicket ? (
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedTicket(null)}
                    data-testid="button-back-to-list"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                </div>
                <CardTitle className="text-lg">#{selectedTicket.id} - {selectedTicket.subject}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {getStatusBadge(selectedTicket.status)}
                  {getPriorityBadge(selectedTicket.priority)}
                  <Badge variant="outline">{selectedTicket.category}</Badge>
                  <span className="text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {formatDate(selectedTicket.createdAt)}
                  </span>
                </div>
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
                        placeholder="Type your reply..."
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        className="flex-1 min-h-[80px]"
                        data-testid="input-reply-message"
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
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Your Tickets</CardTitle>
              <CardDescription>
                {tickets.length === 0 
                  ? "You haven't created any support tickets yet." 
                  : `You have ${tickets.length} ticket${tickets.length > 1 ? 's' : ''}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No tickets yet</p>
                  <Button onClick={() => setShowNewTicketDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first ticket
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover-elevate"
                      onClick={() => setSelectedTicket(ticket)}
                      data-testid={`ticket-row-${ticket.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">#{ticket.id}</span>
                          <span className="text-sm">{ticket.subject}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusBadge(ticket.status)}
                          {getPriorityBadge(ticket.priority)}
                          <span className="text-xs text-muted-foreground">
                            Updated {formatDate(ticket.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
              <DialogDescription>
                Describe your issue and we'll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTicket}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={newTicketSubject}
                    onChange={(e) => setNewTicketSubject(e.target.value)}
                    data-testid="input-ticket-subject"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={newTicketCategory} onValueChange={setNewTicketCategory}>
                      <SelectTrigger data-testid="select-ticket-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="billing">Billing</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newTicketPriority} onValueChange={setNewTicketPriority}>
                      <SelectTrigger data-testid="select-ticket-priority">
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
                    placeholder="Describe your issue in detail..."
                    value={newTicketMessage}
                    onChange={(e) => setNewTicketMessage(e.target.value)}
                    className="min-h-[120px]"
                    data-testid="input-ticket-message"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowNewTicketDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createTicketMutation.isPending} data-testid="button-submit-ticket">
                  {createTicketMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Ticket"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
