export function formatAgreementNumber(opts: {
  reservationNumber?: string | null;
  agreementSeq?: number | null;
}): string {
  const reservation = (opts.reservationNumber ?? "")
    .trim()
    .replace(/^#+/, "");
  const seq = opts.agreementSeq ?? null;
  if (!seq || seq <= 0) return "-";
  // Jeśli wycieczka nie ma nadanego reservation_number, nadal pokazuj numer kolejny umowy,
  // zamiast "—" (to realnie istniejący numer przypisany do rezerwacji).
  if (!reservation) return `#${String(seq).padStart(3, "0")}`;
  return `#${reservation.padStart(6, "0")}/${String(seq).padStart(3, "0")}`;
}

