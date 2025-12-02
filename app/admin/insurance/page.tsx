"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { ReusableTable } from "@/components/reusable-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type InsuranceSubmission = {
  id: string;
  trip_id: string;
  booking_id: string | null;
  participants_count: number;
  submission_date: string;
  status: "pending" | "sent" | "accepted" | "error";
  error_message: string | null;
  policy_number: string | null;
  created_at: string;
  updated_at: string;
  trips: {
    id: string;
    title: string;
    start_date: string | null;
    end_date: string | null;
  } | null;
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Oczekujące",
    sent: "Wysłane",
    accepted: "Zaakceptowane",
    error: "Błąd",
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
  });
};

const formatTripDates = (startDate: string | null, endDate: string | null) => {
  if (!startDate && !endDate) return "-";
  const start = startDate ? formatDate(startDate) : "";
  const end = endDate ? formatDate(endDate) : "";
  return start && end ? `${start} - ${end}` : start || end;
};

export default function AdminInsurancePage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<InsuranceSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/insurance/submissions");
      if (!res.ok) {
        throw new Error("Nie udało się wczytać zgłoszeń");
      }
      const data = await res.json();
      setSubmissions(data);
    } catch (err) {
      toast.error("Nie udało się wczytać zgłoszeń ubezpieczeniowych");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<InsuranceSubmission>[]>(
    () => [
      {
        id: "trip",
        header: "Wycieczka / Termin",
        cell: ({ row }) => {
          const trip = row.original.trips;
          return (
            <div>
              <div className="font-medium">{trip?.title || "-"}</div>
              {trip && (
                <div className="text-sm text-muted-foreground">
                  {formatTripDates(trip.start_date, trip.end_date)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "participants_count",
        header: "Liczba uczestników",
        cell: ({ row }) => (
          <div className="text-center">{row.original.participants_count}</div>
        ),
      },
      {
        accessorKey: "submission_date",
        header: "Data zgłoszenia",
        cell: ({ row }) => formatDate(row.original.submission_date),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={getStatusBadgeVariant(row.original.status)}>
            {getStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "policy",
        header: "Numer polisy",
        cell: ({ row }) => (
          <div className="text-sm">{row.original.policy_number || "-"}</div>
        ),
      },
    ],
    []
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Ubezpieczenia</h1>
        <div>Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ubezpieczenia</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/admin/insurance/config")}
          >
            Konfiguracja
          </Button>
        </div>
      </div>

      <ReusableTable
        columns={columns}
        data={submissions}
        searchable={false}
        enableRowSelection={false}
        enablePagination={true}
        pageSize={10}
        emptyMessage="Brak zgłoszeń ubezpieczeniowych"
        onRowClick={(row) => router.push(`/admin/insurance/${row.id}`)}
      />
    </div>
  );
}

