"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { X, Mail, RefreshCw, Copy, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

function CancelDialog({ invitationEmail, onConfirm }: { invitationEmail: string; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);

  const handleConfirm = () => {
    onConfirm();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <X className="h-4 w-4 mr-1" />
          Anuluj
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anuluj zaproszenie?</DialogTitle>
          <DialogDescription>
            Czy na pewno chcesz anulować zaproszenie dla <strong>{invitationEmail}</strong>? Ta operacja nie może być cofnięta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Nie
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Tak, anuluj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Invitation = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "expired";
  token?: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by_email: string | null;
};

export default function CoordinatorsInvitePage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedInvitations, setSelectedInvitations] = useState<Set<string>>(new Set());
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadInvitations = async (status?: string) => {
    try {
      setLoading(true);
      const url = status && status !== "all" ? `/api/coordinators/invitations?status=${status}` : "/api/coordinators/invitations";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvitations(data);
      } else {
        toast.error("Nie udało się wczytać zaproszeń");
      }
    } catch (err) {
      toast.error("Błąd podczas ładowania zaproszeń");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations(statusFilter !== "all" ? statusFilter : undefined);
  }, [statusFilter]);

  const sendInvitation = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Podaj prawidłowy adres email");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/coordinators/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        toast.success("Zaproszenie zostało wysłane");
        setEmail("");
        setInviteDialogOpen(false);
        await loadInvitations(statusFilter !== "all" ? statusFilter : undefined);
      } else {
        const error = await res.json();
        if (error.error === "user_already_exists") {
          toast.error("Użytkownik z tym emailem już istnieje");
        } else if (error.error === "invitation_already_exists") {
          toast.error("Aktywne zaproszenie dla tego emaila już istnieje");
        } else {
          toast.error("Nie udało się wysłać zaproszenia");
        }
      }
    } catch (err) {
      toast.error("Błąd podczas wysyłania zaproszenia");
    } finally {
      setSending(false);
    }
  };

  const resendInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/coordinators/invitations/${invitationId}/resend`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Zaproszenie zostało wysłane ponownie");
        await loadInvitations(statusFilter !== "all" ? statusFilter : undefined);
      } else {
        const error = await res.json();
        if (error.error === "user_already_exists") {
          toast.error("Użytkownik z tym emailem już istnieje");
        } else {
          toast.error("Nie udało się wysłać zaproszenia ponownie");
        }
      }
    } catch (err) {
      toast.error("Błąd podczas ponownego wysyłania zaproszenia");
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/coordinators/invitations/${invitationId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Zaproszenie zostało anulowane");
        setSelectedInvitations(new Set());
        await loadInvitations(statusFilter !== "all" ? statusFilter : undefined);
      } else {
        toast.error("Nie udało się anulować zaproszenia");
      }
    } catch (err) {
      toast.error("Błąd podczas anulowania zaproszenia");
    }
  };

  const toggleSelectInvitation = (invitationId: string) => {
    setSelectedInvitations((prev) => {
      const next = new Set(prev);
      if (next.has(invitationId)) {
        next.delete(invitationId);
      } else {
        next.add(invitationId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedInvitations.size === invitations.length) {
      setSelectedInvitations(new Set());
    } else {
      setSelectedInvitations(new Set(invitations.map((inv) => inv.id)));
    }
  };

  const copyInvitationLink = async (token: string) => {
    if (!token) {
      toast.error("Brak tokenu zaproszenia");
      return;
    }

    const baseUrl = window.location.origin;
    const invitationLink = `${baseUrl}/register?token=${token}`;

    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopiedToken(token);
      toast.success("Link zaproszenia skopiowany do schowka");
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      toast.error("Nie udało się skopiować linku");
    }
  };

  const bulkResend = async () => {
    if (selectedInvitations.size === 0) {
      toast.error("Wybierz przynajmniej jedno zaproszenie");
      return;
    }

    try {
      const promises = Array.from(selectedInvitations).map((id) =>
        fetch(`/api/coordinators/invitations/${id}/resend`, { method: "POST" })
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      const failed = results.length - successful;

      if (successful > 0) {
        toast.success(`Wysłano ponownie ${successful} zaproszeń`);
      }
      if (failed > 0) {
        toast.error(`Nie udało się wysłać ${failed} zaproszeń`);
      }

      setSelectedInvitations(new Set());
      await loadInvitations(statusFilter !== "all" ? statusFilter : undefined);
    } catch (err) {
      toast.error("Błąd podczas ponownego wysyłania zaproszeń");
    }
  };

  const bulkDelete = async () => {
    if (selectedInvitations.size === 0) {
      toast.error("Wybierz przynajmniej jedno zaproszenie");
      return;
    }

    if (!confirm(`Czy na pewno chcesz anulować ${selectedInvitations.size} zaproszeń?`)) {
      return;
    }

    try {
      const promises = Array.from(selectedInvitations).map((id) =>
        fetch(`/api/coordinators/invitations/${id}`, { method: "DELETE" })
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      const failed = results.length - successful;

      if (successful > 0) {
        toast.success(`Anulowano ${successful} zaproszeń`);
      }
      if (failed > 0) {
        toast.error(`Nie udało się anulować ${failed} zaproszeń`);
      }

      setSelectedInvitations(new Set());
      await loadInvitations(statusFilter !== "all" ? statusFilter : undefined);
    } catch (err) {
      toast.error("Błąd podczas anulowania zaproszeń");
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date() && status === "pending";
    const actualStatus = isExpired ? "expired" : status;

    switch (actualStatus) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Oczekujące</Badge>;
      case "accepted":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Zaakceptowane</Badge>;
      case "expired":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Wygasłe</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pl-PL", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Zaproszenia koordynatorów</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Wyślij zaproszenie do nowych koordynatorów, aby mogli utworzyć konto
          </p>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Mail className="h-4 w-4 mr-2" />
              Wyślij zaproszenie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wyślij zaproszenie</DialogTitle>
              <DialogDescription>
                Wprowadź adres email koordynatora, który otrzyma zaproszenie do utworzenia konta.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Adres email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="koordynator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !sending && email) {
                      sendInvitation();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setInviteDialogOpen(false);
                  setEmail("");
                }}
              >
                Anuluj
              </Button>
              <Button disabled={sending || !email || !email.includes("@")} onClick={sendInvitation}>
                {sending ? "Wysyłanie..." : "Wyślij"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Lista zaproszeń</h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="status-filter" className="text-sm">Status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger id="status-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="pending">Oczekujące</SelectItem>
                <SelectItem value="accepted">Zaakceptowane</SelectItem>
                <SelectItem value="expired">Wygasłe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {selectedInvitations.size > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              Wybrano: {selectedInvitations.size}
            </span>
            <Button variant="outline" size="sm" onClick={bulkResend}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Wyślij ponownie wybrane
            </Button>
            <Button variant="outline" size="sm" onClick={bulkDelete}>
              <X className="h-4 w-4 mr-1" />
              Anuluj wybrane
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={invitations.length > 0 && selectedInvitations.size === invitations.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Wybierz wszystkie"
                />
              </TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Wysłano</TableHead>
              <TableHead>Wygasa</TableHead>
              <TableHead>Zaakceptowano</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Ładowanie zaproszeń...
                </TableCell>
              </TableRow>
            ) : invitations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Brak zaproszeń
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((invitation) => {
                const canResend = invitation.status === "pending" || invitation.status === "expired";
                const canCancel = invitation.status === "pending";
                const isSelected = selectedInvitations.has(invitation.id);

                return (
                  <TableRow key={invitation.id} data-state={isSelected ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectInvitation(invitation.id)}
                        aria-label={`Wybierz ${invitation.email}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{invitation.email}</TableCell>
                    <TableCell>{getStatusBadge(invitation.status, invitation.expires_at)}</TableCell>
                    <TableCell>{formatDate(invitation.created_at)}</TableCell>
                    <TableCell>{formatDate(invitation.expires_at)}</TableCell>
                    <TableCell>
                      {invitation.accepted_at ? formatDate(invitation.accepted_at) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {invitation.token && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInvitationLink(invitation.token!)}
                            title="Kopiuj link zaproszenia"
                          >
                            {copiedToken === invitation.token ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {canResend && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resendInvitation(invitation.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Wyślij ponownie
                          </Button>
                        )}
                        {canCancel && (
                          <CancelDialog
                            invitationEmail={invitation.email}
                            onConfirm={() => cancelInvitation(invitation.id)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

