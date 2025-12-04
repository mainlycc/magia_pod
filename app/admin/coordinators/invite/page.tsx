"use client";
import { useEffect, useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { ReusableTable } from "@/components/reusable-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCw, Copy, Check, X } from "lucide-react";


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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Invitation[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/coordinators/invitations");
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
    loadInvitations();
  }, []);

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
        await loadInvitations();
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
        await loadInvitations();
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

  const handleBulkResend = async () => {
    if (selectedRows.length === 0) {
      toast.error("Wybierz przynajmniej jedno zaproszenie");
      return;
    }

    try {
      const promises = selectedRows.map((inv) =>
        fetch(`/api/coordinators/invitations/${inv.id}/resend`, { method: "POST" })
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

      await loadInvitations();
    } catch (err) {
      toast.error("Błąd podczas ponownego wysyłania zaproszeń");
    }
  };

  const handleBulkDelete = async (selectedRows: Invitation[]) => {
    try {
      const ids = selectedRows.map((inv) => inv.id);
      const res = await fetch("/api/coordinators/invitations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (res.ok) {
        toast.success(`Usunięto ${selectedRows.length} ${selectedRows.length === 1 ? "zaproszenie" : "zaproszeń"}`);
        setSelectedRows([]);
        await loadInvitations();
      } else {
        const error = await res.json();
        if (error.error === "unauthorized") {
          toast.error("Brak uprawnień do usuwania zaproszeń");
        } else {
          toast.error("Nie udało się usunąć zaproszeń");
        }
      }
    } catch (err) {
      toast.error("Błąd podczas usuwania zaproszeń");
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

  const columns = useMemo<ColumnDef<Invitation>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        enableSorting: true,
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => {
          const invitation = row.original;
          return getStatusBadge(invitation.status, invitation.expires_at);
        },
      },
      {
        accessorKey: "created_at",
        header: "Wysłano",
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.created_at),
      },
      {
        accessorKey: "expires_at",
        header: "Wygasa",
        enableSorting: true,
        cell: ({ row }) => formatDate(row.original.expires_at),
      },
      {
        accessorKey: "accepted_at",
        header: "Zaakceptowano",
        enableSorting: true,
        cell: ({ row }) =>
          row.original.accepted_at ? formatDate(row.original.accepted_at) : "-",
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const invitation = row.original;
          const canResend = invitation.status === "pending" || invitation.status === "expired";

          return (
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedRows([invitation]);
                  setDeleteDialogOpen(true);
                }}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Usuń
              </Button>
            </div>
          );
        },
      },
    ],
    [copiedToken]
  );


  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Zaproszenia koordynatorów</h1>
        <div className="text-center py-8 text-muted-foreground">Ładowanie zaproszeń...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Zaproszenia koordynatorów</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Wyślij zaproszenie do nowych koordynatorów, aby mogli utworzyć konto
        </p>
      </div>

      <ReusableTable
        columns={columns}
        data={invitations}
        searchable={true}
        searchPlaceholder="Szukaj po emailu..."
        searchColumn="email"
        enableRowSelection={true}
        enablePagination={true}
        pageSize={10}
        emptyMessage="Brak zaproszeń"
        onAdd={() => setInviteDialogOpen(true)}
        addButtonLabel="Wyślij zaproszenie"
        onSelectionChange={setSelectedRows}
        onDeleteSelected={() => {
          if (selectedRows.length > 0) {
            setDeleteDialogOpen(true);
          }
        }}
        deleteButtonLabel="Usuń wybrane"
        filters={
          selectedRows.length > 0 ? (
            <Button variant="outline" size="sm" onClick={handleBulkResend}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Wyślij ponownie wybrane
            </Button>
          ) : undefined
        }
      />

      {/* Dialog wysyłania zaproszenia */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
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

      {/* Dialog usuwania */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuń zaproszenia?</DialogTitle>
            <DialogDescription>
              Czy na pewno chcesz usunąć {selectedRows.length}{" "}
              {selectedRows.length === 1 ? "zaproszenie" : "zaproszeń"}? Ta operacja nie może być
              cofnięta - rekordy zostaną trwale usunięte z bazy danych.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleBulkDelete(selectedRows);
                setDeleteDialogOpen(false);
              }}
            >
              Tak, usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

