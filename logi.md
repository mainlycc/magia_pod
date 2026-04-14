 GET /api/bookings/b19fa934-d356-454b-a983-6688e9f223ee/payments 200 in 573ms (compile: 34ms, proxy.ts: 208ms, render: 332ms)
[InvoiceService] Invoice type determination: {
  invoiceType: 'advance_to_advance',
  existingInvoicesCount: 1,
  parentInvoiceId: '08f6fec1-06a2-4e43-b3a3-9e9b701b29f7'
}
[InvoiceService] Sending invoice to Fakturownia: {
  invoiceType: 'advance_to_advance',
  buyerName: 'Piotr Wiśniewski',
  buyerNip: undefined,
  marginProcedure: undefined
}
[Fakturownia Client] Creating invoice: {
  kind: 'advance',
  number: 'FZal/2026/173612',
  buyerName: 'Piotr Wiśniewski',
  positions: 1,
  marginProcedure: undefined
}
(node:15532) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
[Fakturownia] Raw error response: {
  "code": "error",
  "message": {
    "positions.total_price_gross": [
      "- nie może być puste"
    ],
    "base": [
      "Zaliczka musi być podpięta do jednego zamówienia - w związku z wymogami KSeF do systemu została wprowadzona zmiana. Obecnie przed wystawieniem faktury zaliczkowej, należy najpierw utworzyć zamówienie – <a href='https://pomoc.fakturownia.pl/431820-Tworzenie-faktury-zaliczkowej-do-zamowienia' target='_blank'><b>INSTRUKCJA</b></a>"
    ],
    "positions": [
      {
        "total_price_gross": [
          "- nie może być puste"
        ]
      },
      {}
    ]
  }
}
[InvoiceService] Fakturownia response: {
  success: false,
  invoiceId: undefined,
  invoiceNumber: undefined,
  error: 'HTTP 422: [object Object]'
}
[InvoiceService] Invoice saved: {
  invoiceId: 'aaf78799-d8fa-4ad5-9fc5-482c0e67390d',
  invoiceNumber: 'FZal/2026/025',
  invoiceType: 'advance_to_advance',
  fakturowniaInvoiceId: undefined
}
[InvoiceService] Starting invoice process: {
  bookingId: 'b19fa934-d356-454b-a983-6688e9f223ee',
  paymentHistoryId: '1661b83c-608d-4529-ad03-38b1b79d29be',
  amountCents: 142400
}
[InvoiceService] Invoice already exists for payment_history_id: 1661b83c-608d-4529-ad03-38b1b79d29be
 POST /api/fakturownia/invoice/create 200 in 1052ms (compile: 8ms, proxy.ts: 209ms, render: 835ms)
 GET /api/bookings/b19fa934-d356-454b-a983-6688e9f223ee/payments 200 in 638ms (compile: 27ms, proxy.ts: 353ms, render: 257ms)
 GET /trip-dashboard/faktury/aaf78799-d8fa-4ad5-9fc5-482c0e67390d 200 in 374ms (compile: 61ms, proxy.ts: 234ms, render: 79ms)
(node:2412) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
