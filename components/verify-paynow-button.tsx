"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

export type PaynowCheckDisplay =
  | "paid"
  | "unpaid"
  | "not_found"
  | "error"
  | "manual"
  | "none"

export type PaymentCheck = {
  paymentId: string
  localAmountCents: number | null
  localNotes: string | null
  paynowStatus: string | null
  paynowAmountCents: number | null
  verdict: string
}

export type BookingVerifyResult = {
  bookingId: string
  bookingRef: string
  localPaymentStatus: string
  paidAmountCents: number
  hasPaynowPayments: boolean
  hasOnlyManualOrNoPaynow: boolean
  hasManualPayments?: boolean
  suspiciousPaidWithoutPaynowConfirm?: boolean
  payments: PaymentCheck[]
  synced: boolean
}

export type VerifyPaynowResponse = {
  tripId: string
  sync: boolean
  environment?: "sandbox" | "production"
  summary: {
    bookingsTotal: number
    withPaynow: number
    onlyManualOrNoPaynow: number
    ok: number
    mismatches: number
    paynowErrors: number
    synced: number
  }
  bookings: BookingVerifyResult[]
  error?: string
  message?: string
}

export type PaynowCheckRow = {
  display: PaynowCheckDisplay
  confirmedAmountCents: number
  bookingRef: string
}

export function getPaynowCheckDisplay(b: BookingVerifyResult): PaynowCheckDisplay {
  if (b.payments.some((p) => p.paynowStatus === "CONFIRMED")) return "paid"
  if (b.hasPaynowPayments) {
    if (b.payments.some((p) => p.verdict === "paynow_error")) return "error"
    if (b.payments.every((p) => p.verdict === "paynow_not_found")) return "not_found"
    return "unpaid"
  }
  // Bez Paynow: „ręcznie” tylko przy realnych wpisach manual w historii
  if (b.hasOnlyManualOrNoPaynow || (b.hasManualPayments && isPaidLocally(b.localPaymentStatus))) {
    return "manual"
  }
  return "none"
}

function isPaidLocally(status: string): boolean {
  return status === "paid" || status === "partial" || status === "overpaid"
}

export function paynowConfirmedAmountCents(b: BookingVerifyResult): number {
  return b.payments
    .filter((p) => p.paynowStatus === "CONFIRMED")
    .reduce((sum, p) => sum + (p.paynowAmountCents ?? p.localAmountCents ?? 0), 0)
}

export function paynowCheckLabel(display: PaynowCheckDisplay): string {
  switch (display) {
    case "paid":
      return "Opłacone"
    case "unpaid":
      return "Nieopłacone"
    case "not_found":
      return "Nie znaleziono w Paynow"
    case "error":
      return "Błąd Paynow"
    case "manual":
      return "Opłacone ręcznie"
    case "none":
      return "Nieopłacone"
  }
}

export function paynowCheckBadgeClass(display: PaynowCheckDisplay): string {
  switch (display) {
    case "paid":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
    case "unpaid":
    case "none":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800"
    case "not_found":
      return "border-orange-500/40 bg-orange-500/10 text-orange-800"
    case "error":
      return "border-destructive/40 bg-destructive/10 text-destructive"
    case "manual":
      return "border-sky-500/40 bg-sky-500/10 text-sky-800"
  }
}

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—"
  return `${(cents / 100).toFixed(2)} zł`
}

function BookingRow({ booking }: { booking: BookingVerifyResult }) {
  const display = getPaynowCheckDisplay(booking)
  const amount = paynowConfirmedAmountCents(booking) || booking.paidAmountCents

  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-medium">{booking.bookingRef}</span>
        <Badge variant="outline" className={`text-xs ${paynowCheckBadgeClass(display)}`}>
          {paynowCheckLabel(display)}
        </Badge>
        <span className="text-xs text-muted-foreground">{formatCents(amount)}</span>
      </div>
    </div>
  )
}

type Props = {
  tripId: string
  disabled?: boolean
  onResult?: (result: VerifyPaynowResponse) => void
  onSynced?: () => void
  size?: "sm" | "default"
  className?: string
}

export function VerifyPaynowButton({
  tripId,
  disabled,
  onResult,
  onSynced,
  size = "sm",
  className,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<VerifyPaynowResponse | null>(null)

  const groups = useMemo(() => {
    const bookings = result?.bookings ?? []
    return {
      paid: bookings.filter((b) => getPaynowCheckDisplay(b) === "paid"),
      unpaid: bookings.filter((b) => {
        const d = getPaynowCheckDisplay(b)
        return d === "unpaid" || d === "none"
      }),
      manual: bookings.filter((b) => getPaynowCheckDisplay(b) === "manual"),
      notFound: bookings.filter((b) => getPaynowCheckDisplay(b) === "not_found"),
    }
  }, [result])

  const runVerify = async () => {
    setLoading(true)

    try {
      // Zawsze sync: zapisuje CONFIRMED lokalnie i nie liczy PENDING do sumy
      const res = await fetch(`/api/trips/${tripId}/verify-paynow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sync: true }),
      })
      const data = (await res.json()) as VerifyPaynowResponse

      if (!res.ok) {
        if (data.error === "paynow_not_configured") {
          toast.error("Paynow nie jest skonfigurowane (brak kluczy API)")
        } else {
          toast.error(data.message || "Nie udało się sprawdzić płatności w Paynow")
        }
        return
      }

      setResult(data)
      setOpen(true)
      onResult?.(data)

      const paidCount = groupsFrom(data).paid
      const unpaidCount = groupsFrom(data).unpaid

      toast.success(
        `Paynow: ${paidCount} opłaconych, ${unpaidCount} nieopłaconych — Stan wpłaty zaktualizowany`,
      )
      onSynced?.()
    } catch (e) {
      console.error(e)
      toast.error("Nie udało się sprawdzić płatności w Paynow")
    } finally {
      setLoading(false)
    }
  }

  const envLabel = result?.environment === "production" ? "produkcja" : "sandbox"

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={className}
        disabled={disabled || loading}
        onClick={() => void runVerify()}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" />
        )}
        Sprawdź w Paynow
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Status w Paynow</DialogTitle>
            <DialogDescription>
              Środowisko: <strong>{envLabel}</strong>. Kolumna „Stan wpłaty” pokazuje ten sam wynik.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-xs text-emerald-800">Opłacone</div>
                  <div className="text-2xl font-semibold text-emerald-900">{groups.paid.length}</div>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="text-xs text-amber-800">Nieopłacone</div>
                  <div className="text-2xl font-semibold text-amber-900">{groups.unpaid.length}</div>
                </div>
              </div>

              {groups.paid.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-medium text-emerald-800">Opłacone ({groups.paid.length})</h3>
                  {groups.paid.map((b) => (
                    <BookingRow key={b.bookingId} booking={b} />
                  ))}
                </section>
              )}

              {groups.unpaid.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-medium text-amber-800">Nieopłacone ({groups.unpaid.length})</h3>
                  {groups.unpaid.map((b) => (
                    <BookingRow key={b.bookingId} booking={b} />
                  ))}
                </section>
              )}

              {groups.manual.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-medium text-sky-800">
                    Opłacone ręcznie ({groups.manual.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    W historii jest wpis „manual” / ręczna wpłata — nie przez Paynow.
                  </p>
                  {groups.manual.map((b) => (
                    <BookingRow key={b.bookingId} booking={b} />
                  ))}
                </section>
              )}

              {groups.notFound.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Nie znaleziono w Paynow: {groups.notFound.length}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function groupsFrom(data: VerifyPaynowResponse) {
  return {
    paid: data.bookings.filter((b) => getPaynowCheckDisplay(b) === "paid").length,
    unpaid: data.bookings.filter((b) => {
      const d = getPaynowCheckDisplay(b)
      return d === "unpaid" || d === "none"
    }).length,
  }
}
