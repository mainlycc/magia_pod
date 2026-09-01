export const EMAIL_SENDER_NAME = "Magia podróżowania";

/** Dane do przelewu tradycyjnego w mailach potwierdzających rezerwację. */
export const EMAIL_PAYMENT_DETAILS = {
  recipient: "GRUPA DE-PL Szymon Kurkiewicz",
  address: "Szczepankowo 37, 61-311 Poznań",
  bankAccount: "36 1090 1274 0000 0001 3192 8094",
} as const;

/** Kolory marki w automatycznych mailach — główny odcień #2596be */
export const EMAIL_BRAND = {
  primary: "#2596be",
  primaryDark: "#1e7a9a",
  lightBg: "#e8f4f9",
  text: "#1a5f78",
  shadow: "rgba(37, 150, 190, 0.3)",
  gradient: "linear-gradient(135deg, #2596be 0%, #1e7a9a 100%)",
} as const;
