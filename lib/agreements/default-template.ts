export const DEFAULT_AGREEMENT_TEMPLATE_HTML = `<div style="text-align: center; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1rem;">
<p style="margin: 0;">ORGANIZATOR IMPREZY TURYSTYCZNEJ:</p>
<p style="margin: 0; font-weight: bold;">"GRUPA DE-PL" Szymon Kurkiewicz</p>
<p style="margin: 0;">ul. Szczepankowo 37, 61-311 Poznań, tel: 530 76 77 76, NIP: 6981710393, wpis do Rejestru Organizatorów Turystyki i Pośredników Turystyki Marszałka Województwa Wielkopolskiego, numer 605, Numer konta w Santander Bank: 36 1090 1274 0000 0001 3192 8094</p>
</div>

<h1>UMOWA O UDZIAŁ W IMPREZIE TURYSTYCZNEJ</h1>

<h2>Dane Zgłaszającego</h2>
<table>
  <tr>
    <td>Imię Nazwisko:</td>
    <td>{{contact_full_name}}</td>
  </tr>
  <tr>
    <td>Adres:</td>
    <td>{{contact_address}}</td>
  </tr>
  <tr>
    <td>PESEL:</td>
    <td>{{contact_pesel}}</td>
  </tr>
  <tr>
    <td>Telefon:</td>
    <td>{{contact_phone}}</td>
  </tr>
  <tr>
    <td>E-mail:</td>
    <td>{{contact_email}}</td>
  </tr>
</table>

<h2>Dane firmy</h2>
<table>
  <tr>
    <td>Nazwa firmy:</td>
    <td>{{company_name}}</td>
  </tr>
  <tr>
    <td>NIP/KRS:</td>
    <td>{{company_nip}}</td>
  </tr>
  <tr>
    <td>Adres firmy:</td>
    <td>{{company_address}}</td>
  </tr>
</table>

<h2>Dane uczestników</h2>
<table>
  <tr>
    <td>Liczba uczestników:</td>
    <td>{{participants_count}}</td>
  </tr>
  <tr>
    <td>Dane uczestników:</td>
    <td>{{participants_list}}</td>
  </tr>
</table>

<h2>Informacje o imprezie turystycznej</h2>
<table>
  <tr>
    <td>Nazwa imprezy turystycznej:</td>
    <td>{{trip_title}}</td>
  </tr>
  <tr>
    <td>Numer rezerwacji:</td>
    <td>{{reservation_number}}</td>
  </tr>
  <tr>
    <td>Trasa/miejsce pobytu:</td>
    <td>{{trip_location}}</td>
  </tr>
  <tr>
    <td>Data:</td>
    <td>{{trip_start_date}} - {{trip_end_date}}</td>
  </tr>
  <tr>
    <td>Czas trwania imprezy turystycznej:</td>
    <td>{{trip_duration}}</td>
  </tr>
  <tr>
    <td>Liczba noclegów:</td>
    <td>{{nights_count}}</td>
  </tr>
  <tr>
    <td>Lokalizacja, rodzaj, kategoria obiektu zakwaterowania:</td>
    <td>{{accommodation_location}}</td>
  </tr>
  <tr>
    <td>Rodzaj, typ pokoju:</td>
    <td>{{room_type}}</td>
  </tr>
  <tr>
    <td>Ilość, rodzaj posiłków:</td>
    <td>{{meals_info}}</td>
  </tr>
  <tr>
    <td>Rodzaj kategoria środka transportu:</td>
    <td>{{transport_type}}</td>
  </tr>
  <tr>
    <td>Przelot liniami na trasie:</td>
    <td>{{flight_info}}</td>
  </tr>
  <tr>
    <td>Bagaż:</td>
    <td>{{baggage_info}}</td>
  </tr>
</table>

<table>
  <tr>
    <td>Dodatkowe świadczenia:</td>
    <td>{{additional_services}}</td>
  </tr>
  <tr>
    <td>Usługi dodatkowe:</td>
    <td>{{selected_services}}</td>
  </tr>
  <tr>
    <td>Zakres ubezpieczenia:</td>
    <td>{{insurance_scope}}</td>
  </tr>
  <tr>
    <td>Cena imprezy turystycznej:</td>
    <td>{{trip_price_breakdown}}</td>
  </tr>
  <tr>
    <td>Dodatkowe koszty:</td>
    <td>{{additional_costs}}</td>
  </tr>
  <tr>
    <td>Zwyczajowe napiwki, wydatki własne i inne koszty nieobjęte programem</td>
    <td></td>
  </tr>
  <tr>
    <td>Przedpłata:</td>
    <td>{{trip_deposit_amount}} zł brutto łącznie płatne do {{trip_deposit_deadline}}</td>
  </tr>
  <tr>
    <td>Turystyczny Fundusz Gwarancyjny:</td>
    <td>Wliczony w cenę imprezy turystycznej</td>
  </tr>
  <tr>
    <td>Turystyczny Fundusz Pomocowy:</td>
    <td>Wliczony w cenę imprezy turystycznej</td>
  </tr>
  <tr>
    <td>Termin zapłaty całości:</td>
    <td>Płatne do {{trip_final_payment_deadline}}</td>
  </tr>
</table>

<p>Zgłaszający oświadcza w imieniu własnym oraz uczestników imprezy turystycznej, na rzecz których podpisuje umowę, iż:</p>
<ul>
  <li>Zapoznałem się z Umową o udział w imprezie turystycznej oraz stanowiącymi integralną jej część Warunkami Udziału w Imprezach Turystycznych GRUPY DE-PL oraz zobowiązuję się do ich przestrzegania i przyjmuję je do wiadomości.</li>
  <li>Zapoznałem się ze Standardowym Formularzem Informacyjnym do umów o udział w imprezie turystycznej</li>
</ul>

<p>................................<br/>Podpis Klienta</p>

<div style="page-break-before: always; margin-top: 2rem;">
<div style="text-align: center; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1rem;">
<p style="margin: 0;">ORGANIZATOR IMPREZY TURYSTYCZNEJ:</p>
<p style="margin: 0; font-weight: bold;">"GRUPA DE-PL" Szymon Kurkiewicz</p>
<p style="margin: 0;">ul. Szczepankowo 37, 61-311 Poznań, tel: 530 76 77 76, NIP: 6981710393, wpis do Rejestru Organizatorów Turystyki i Pośredników Turystyki Marszałka Województwa Wielkopolskiego, numer 605, Numer konta w Santander Bank: 36 1090 1274 0000 0001 3192 8094</p>
</div>

<h2>IMPREZY SAMOLOTOWE</h2>
<ul>
<li>W przypadku imprez samolotowych GRUPA DE-PL działa w charakterze pośrednika dokonującego w liniach lotniczych czynności faktycznych, związanych z realizacją i doręczeniem biletu zamówionego w liniach lotniczych ściśle według wskazań klienta na rzecz i w jego imieniu, a przekazywanych drogą e-mailową pod adresem: office@grupa-depl.com. Realizacja usługi, jak i rozpatrzenie procedury reklamacyjnej, podlega ogólnym warunkom linii lotniczych.</li>
<li>W przypadku imprez samolotowych, realizowanych rejsowymi liniami lotniczymi, tzw. „ Low Cost" tj. Ryanair, Wizz Air, Easy Jet, Sky Express
<ul>
<li>wszystkie rezerwacje tworzone są „na zapytanie/ do potwierdzenia", w celu zweryfikowania aktualnego stanu miejsc i ceny. Ważność oferty uzależniona jest od wybranej linii lotniczej. Każdorazowo klient zostanie poinformowany o warunkach wstępnej rezerwacji.</li>
<li>Brak możliwości zwrotu biletów</li>
<li>Konieczność podania listy uczestników z następującymi danymi: imiona, nazwiska, daty urodzenia oraz jeśli wymagane przez linię dane dokumentu podróży: dowód osobisty/paszport (seria, numer, data wydania, data ważności) każdego uczestnika przesłanej na adres mailowy: office@grupa-depl.com lub za pośrednictwem dedykowanej platformy online w terminie wskazanym w umowie</li>
<li>Koszt zmiany na liście uczestników podlega opłacenia wycenianej zgodnie z cennikiem danej linii</li>
<li>Ogólne warunki przewozu dostępne na stronie linii lotniczych - Ogólne Warunki Przewozu Pasażerów i Bagażu</li>
</ul>
</li>
</ul>
</div>`;

