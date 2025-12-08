"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ReusableTable } from "@/components/reusable-table";
import { toast } from "sonner";

type InsuranceSubmissionDetail = {
  id: string;
  trip_id: string;
  booking_id: string | null;
  participants_count: number;
  submission_date: string;
  status: "pending" | "calculating" | "registered" | "sent" | "issued" | "accepted" | "error" | "cancelled" | "manual_check_required";
  error_message: string | null;
  api_payload: any;
  api_response: any;
  policy_number: string | null;
  external_offer_id: string | null;
  external_policy_id: string | null;
  external_policy_number: string | null;
  policy_status_code: string | null;
  sent_at: string | null;
  last_sync_at: string | null;
  sync_attempts: number;
  created_at: string;
  updated_at: string;
  trips: {
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
  } | null;
  participants: Array<{
    id: string;
    first_name: string;
    last_name: string;
    pesel: string | null;
    email: string | null;
    phone: string | null;
    document_type: string | null;
    document_number: string | null;
    hdi_required_data: any;
  }>;
};

type InsuranceLog = {
  id: string;
  operation_type: string;
  status: string;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Oczekujące",
    calculating: "Kalkulacja",
    registered: "Zarejestrowane",
    sent: "Wysłane",
    issued: "Wystawione",
    accepted: "Zaakceptowane",
    error: "Błąd",
    cancelled: "Anulowane",
    manual_check_required: "Wymaga kontroli",
  };
  return labels[status] || status;
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "accepted":
      return "default";
    case "sent":
      return "secondary";
    case "error":
      return "destructive";
    case "pending":
    default:
      return "outline";
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function InsuranceSubmissionDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;
  const [submission, setSubmission] = useState<InsuranceSubmissionDetail | null>(null);
  const [logs, setLogs] = useState<InsuranceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadSubmission();
    loadLogs();
  }, [submissionId]);

  const loadSubmission = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/insurance/submissions/${submissionId}`);
      if (!res.ok) {
        throw new Error("Nie udało się wczytać zgłoszenia");
      }
      const data = await res.json();
      setSubmission(data);
    } catch (err) {
      toast.error("Nie udało się wczytać zgłoszenia");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch(`/api/insurance/submissions/${submissionId}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch(`/api/insurance/submissions/${submissionId}/sync`, {
        method: "GET",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Status został zsynchronizowany");
        await loadSubmission();
        await loadLogs();
      } else {
        toast.error(data.message || "Błąd podczas synchronizacji");
      }
    } catch (err) {
      toast.error("Błąd podczas synchronizacji");
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Czy na pewno chcesz anulować to zgłoszenie?")) {
      return;
    }
    try {
      setCancelling(true);
      const res = await fetch(`/api/insurance/submissions/${submissionId}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Zgłoszenie zostało anulowane");
        await loadSubmission();
        await loadLogs();
      } else {
        toast.error(data.message || "Błąd podczas anulowania");
      }
    } catch (err) {
      toast.error("Błąd podczas anulowania");
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  const participantColumns = useMemo<ColumnDef<InsuranceSubmissionDetail["participants"][0]>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: "Imię",
      },
      {
        accessorKey: "last_name",
        header: "Nazwisko",
      },
      {
        accessorKey: "pesel",
        header: "PESEL",
        cell: ({ row }) => row.original.pesel || "-",
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email || "-",
      },
      {
        accessorKey: "phone",
        header: "Telefon",
        cell: ({ row }) => row.original.phone || "-",
      },
      {
        accessorKey: "document_number",
        header: "Dokument",
        cell: ({ row }) => {
          const docType = row.original.document_type || "";
          const docNumber = row.original.document_number || "-";
          return docType ? `${docType}: ${docNumber}` : "-";
        },
      },
    ],
    []
  );

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Skopiowano do schowka");
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>Ładowanie...</div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="space-y-4">
        <div>Nie znaleziono zgłoszenia</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Utworzone: {formatDate(submission.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          {submission.external_policy_number && (
            <Button
              variant="outline"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? "Synchronizowanie..." : "Synchronizuj status"}
            </Button>
          )}
          {["sent", "registered", "issued"].includes(submission.status) && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Anulowanie..." : "Anuluj zgłoszenie"}
            </Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            Wstecz
          </Button>
        </div>
      </div>

      {/* Informacje podstawowe */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4">Informacje podstawowe</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Wycieczka</Label>
            <div>{submission.trips?.title || "-"}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Termin</Label>
            <div>
              {submission.trips?.start_date
                ? formatDate(submission.trips.start_date)
                : "-"}{" "}
              {submission.trips?.end_date &&
                `— ${formatDate(submission.trips.end_date)}`}
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">Data zgłoszenia</Label>
            <div>{formatDate(submission.submission_date)}</div>
          </div>
          <div>
            <Label className="text-muted-foreground">Status</Label>
            <div>
              <Badge variant={getStatusBadgeVariant(submission.status)}>
                {getStatusLabel(submission.status)}
              </Badge>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground">Liczba uczestników</Label>
            <div>{submission.participants_count}</div>
          </div>
          {submission.external_policy_number && (
            <div>
              <Label className="text-muted-foreground">Numer polisy HDI</Label>
              <div className="font-medium">{submission.external_policy_number}</div>
            </div>
          )}
          {submission.policy_status_code && (
            <div>
              <Label className="text-muted-foreground">Status polisy HDI</Label>
              <div>
                <Badge variant="outline">{submission.policy_status_code}</Badge>
              </div>
            </div>
          )}
          {submission.last_sync_at && (
            <div>
              <Label className="text-muted-foreground">Ostatnia synchronizacja</Label>
              <div>{formatDate(submission.last_sync_at)}</div>
            </div>
          )}
          {submission.sync_attempts > 0 && (
            <div>
              <Label className="text-muted-foreground">Liczba prób synchronizacji</Label>
              <div>{submission.sync_attempts}</div>
            </div>
          )}
          {submission.error_message && (
            <div className="col-span-2">
              <Label className="text-muted-foreground">Komunikat błędu</Label>
              <div className="text-red-600">{submission.error_message}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Lista uczestników */}
      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Lista uczestników</h2>
        <ReusableTable
          columns={participantColumns}
          data={submission.participants}
          searchable={false}
          enablePagination={submission.participants.length > 10}
          pageSize={10}
          emptyMessage="Brak uczestników"
        />
      </Card>

      {/* Payload API */}
      {submission.api_payload && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Payload API (dla supportu)</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(submission.api_payload, null, 2))}
            >
              Kopiuj JSON
            </Button>
          </div>
          <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
            <pre className="text-xs">
              {JSON.stringify(submission.api_payload, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Odpowiedź API */}
      {submission.api_response && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Odpowiedź z API</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(JSON.stringify(submission.api_response, null, 2))}
            >
              Kopiuj JSON
            </Button>
          </div>
          <div className="bg-muted p-4 rounded-lg overflow-auto max-h-96">
            <pre className="text-xs">
              {JSON.stringify(submission.api_response, null, 2)}
            </pre>
          </div>
        </Card>
      )}

      {/* Historia operacji */}
      {logs.length > 0 && (
        <Card className="p-4 space-y-4">
          <h2 className="text-lg font-semibold">Historia operacji</h2>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-4">
                  <Badge variant={log.status === "success" ? "default" : "destructive"}>
                    {log.status === "success" ? "Sukces" : "Błąd"}
                  </Badge>
                  <span className="text-sm font-medium">{log.operation_type}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(log.created_at)}
                  </span>
                </div>
                {log.error_message && (
                  <div className="text-sm text-red-600">{log.error_message}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

