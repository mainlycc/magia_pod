Logika wystawiania faktur

Pierwsza płatność:
Zawsze musi być księgowana jako Faktura zaliczkowa (Procedura marży dla biur podróży).

Kolejne płatności (dopłaty):
Każda kolejna wpłata – niezależnie od ich liczby – musi być księgowana jako:
Faktura zaliczkowa do faktury zaliczkowej (czyli powiązana z poprzednią wpłatą),
z zachowaniem Procedury marży dla biur podróży.

Zautomatyzowany schemat działania (Flow płatności)
🔹 Płatność automatyczna (bramka)
Klient opłaca wyjazd lub dopłatę przez bramkę płatności.
System rejestruje status „udana”.
System automatycznie wysyła komunikat do fakturowania z prośbą o wystawienie odpowiedniej faktury:
faktura zaliczkowa
lub faktura zaliczkowa do zaliczkowej
System pobiera wystawioną fakturę z fakturowania i przypisuje ją do rezerwacji klienta.
System automatycznie wysyła fakturę na adres e-mail klienta.
🔹 Płatność ręczna
Administrator ręcznie dodaje płatność.
Po oznaczeniu płatności jako „udana”, system automatycznie:
wysyła żądanie do fakturowania,
pobiera wystawioną fakturę,
przypisuje ją do rezerwacji,
wysyła ją do klienta e-mailem.