"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { TfgReportType } from "@/lib/reports/tfg-agreement-report";

const REPORT_OPTIONS: { value: TfgReportType; label: string }[] = [
  { value: "tfg_signed_detail", label: "Składki TFG – wykaz zawartych umów (szczegółowy)" },
  { value: "tfg_signed_summary", label: "Składki TFG – podsumowanie zawartych umów" },
  { value: "tfg_cancellations_detail", label: "Składki TFG – rezygnacje (szczegółowy)" },
  { value: "tfg_cancellations_summary", label: "Składki TFG – rezygnacje (podsumowanie)" },
];

const MONTHS = [
  { value: 1, label: "Styczeń" },
  { value: 2, label: "Luty" },
  { value: 3, label: "Marzec" },
  { value: 4, label: "Kwiecień" },
  { value: 5, label: "Maj" },
  { value: 6, label: "Czerwiec" },
  { value: 7, label: "Lipiec" },
  { value: 8, label: "Sierpień" },
  { value: 9, label: "Wrzesień" },
  { value: 10, label: "Październik" },
  { value: 11, label: "Listopad" },
  { value: 12, label: "Grudzień" },
];

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/filename="([^"]+)"/);
  return m?.[1] ?? null;
}

export function AgreementTfgReportClient() {
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reportType, setReportType] = useState<TfgReportType>("tfg_signed_detail");
  const [periodMode, setPeriodMode] = useState<"month" | "range">("month");
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dateFrom, setDateFrom] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
  );
  const [dateTo, setDateTo] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`,
  );
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile");
        if (!res.ok) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const data = (await res.json()) as { role?: string };
        if (!cancelled) setIsAdmin(data.role === "admin");
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const years = useMemo(() => {
    const y = now.getFullYear();
    return Array.from({ length: 7 }, (_, i) => y - 2 + i);
  }, [now]);

  async function downloadReport(format: "xlsx" | "pdf") {
    if (periodMode === "range" && dateFrom > dateTo) {
      toast.error("Data „od” nie może być późniejsza niż data „do”.");
      return;
    }

    const body: Record<string, unknown> = {
      reportType,
      period: periodMode,
      format,
    };
    if (periodMode === "month") {
      body.year = year;
      body.month = month;
    } else {
      body.dateFrom = dateFrom;
      body.dateTo = dateTo;
    }

    setExporting(format);
    try {
      const res = await fetch("/api/admin/reports/tfg-agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        toast.error(typeof errJson?.error === "string" ? errJson.error : "Nie udało się wygenerować raportu");
        return;
      }

      const blob = await res.blob();
      const filename =
        parseFilenameFromDisposition(res.headers.get("Content-Disposition")) ??
        (format === "xlsx" ? "raport-tfg.xlsx" : "raport-tfg.pdf");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Raport został pobrany");
    } catch (e) {
      console.error(e);
      toast.error("Błąd pobierania pliku");
    } finally {
      setExporting(null);
    }
  }

  if (profileLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Ładowanie uprawnień…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">
        Ta strona jest dostępna tylko dla administratorów.
      </p>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Generowanie raportu umów (TFG)</CardTitle>
          <CardDescription>
            Comiesięczne zestawienia na podstawie daty wygenerowania umowy (zawarte) lub daty anulacji
            rezerwacji (rezygnacje). Jedna linia szczegółów = jedna umowa lub jedna anulowana rezerwacja.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Typ raportu</Label>
            <Select
              value={reportType}
              onValueChange={(v) => setReportType(v as TfgReportType)}
            >
              <SelectTrigger className="w-full max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Okres</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={periodMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodMode("month")}
              >
                Wskazany miesiąc
              </Button>
              <Button
                type="button"
                variant={periodMode === "range" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodMode("range")}
              >
                Dowolny okres (od – do)
              </Button>
            </div>

            {periodMode === "month" ? (
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Rok</Label>
                  <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Miesiąc</Label>
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={String(m.value)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Od</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Do</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Format pliku</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={exporting !== null}
                onClick={() => downloadReport("xlsx")}
              >
                {exporting === "xlsx" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generowanie…
                  </>
                ) : (
                  "Pobierz XLSX"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={exporting !== null}
                onClick={() => downloadReport("pdf")}
              >
                {exporting === "pdf" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generowanie…
                  </>
                ) : (
                  "Pobierz PDF"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
