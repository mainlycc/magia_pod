/**
 * Azure design tokens — wariant mockupu Panel Klienta.
 *
 * Jedyny punkt zmiany koloru niebieskiego akcentu: `AZURE_ACCENT`.
 * Ciemniejszy / miękki / lodowy wariant liczą się automatycznie
 * i trafiają do CSS variables przez `azureCssVars` (ClientPanelShell).
 *
 * Klasy Tailwind używają `var(--client-accent*)`, żeby:
 * 1) Tailwinda skanował pełne stringi klas
 * 2) zmiana hex w `AZURE_ACCENT` odświeżała UI bez edycji klas
 */

/** Zmień tylko tę wartość, żeby przestawić cały niebieski akcent w panelu klienta. */
export const AZURE_ACCENT = "#2596BE";

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((v) => clampByte(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** `amount` 0 = base, 1 = target */
function mixHex(base: string, target: string, amount: number): string {
  const [br, bg, bb] = hexToRgb(base);
  const [tr, tg, tb] = hexToRgb(target);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex(
    br + (tr - br) * t,
    bg + (tg - bg) * t,
    bb + (tb - bb) * t,
  );
}

function buildAccentPalette(accent: string) {
  return {
    accent,
    /** Hover / ciemniejszy tekst na tle ice */
    accentDark: mixHex(accent, "#000000", 0.18),
    /** Obramowania, ring focus */
    accentSoft: mixHex(accent, "#ffffff", 0.72),
    /** Tła alertów / chipów */
    accentIce: mixHex(accent, "#ffffff", 0.88),
  } as const;
}

const accentPalette = buildAccentPalette(AZURE_ACCENT);

export const azureColors = {
  bg: "#eef0f5",
  paper: "#ffffff",
  paperAlt: "#f7f8fb",
  ink: "#0a0a0a",
  inkSoft: "#3f3f46",
  inkMute: "#a1a1aa",
  line: "#dadce3",
  lineSoft: "#eceef3",
  ...accentPalette,
  /** Alias — ten sam kolor co accent (wcześniej osobny vivid). */
  accentVivid: accentPalette.accent,
  black: "#0a0a0a",
  blackSoft: "#1c1c1f",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  success: "#16a34a",
} as const;

/** CSS custom properties — wstrzykiwane w ClientPanelShell (jedno źródło z `azureColors`). */
export const azureCssVars = {
  "--client-bg": azureColors.bg,
  "--client-paper": azureColors.paper,
  "--client-ink": azureColors.ink,
  "--client-ink-soft": azureColors.inkSoft,
  "--client-ink-mute": azureColors.inkMute,
  "--client-line": azureColors.line,
  "--client-line-soft": azureColors.lineSoft,
  "--client-accent": azureColors.accent,
  "--client-accent-dark": azureColors.accentDark,
  "--client-accent-soft": azureColors.accentSoft,
  "--client-accent-ice": azureColors.accentIce,
  "--client-success": azureColors.success,
  "--client-danger": azureColors.danger,
} as const;

/** Tailwind-friendly class bundles scoped under .client-panel */
export const azureClasses = {
  shell: "client-panel light min-h-screen bg-[#eef0f5] text-[#0a0a0a]",
  container: "mx-auto w-full max-w-[1240px] px-6 py-12 sm:px-[52px]",
  card: "overflow-hidden rounded-[18px] border border-[#dadce3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.12)]",
  cardAccentBlue: "h-1 bg-[var(--client-accent)]",
  cardAccentBlack: "h-1 bg-[#0a0a0a]",
  cardAccentSuccess: "h-1 bg-[#16a34a]",
  cardAccentDanger: "h-1 bg-[#dc2626]",
  cardInner: "px-6 py-8 sm:px-[38px] sm:py-[34px]",
  kicker:
    "inline-flex items-center gap-2 rounded-full border border-[var(--client-accent-soft)] bg-[var(--client-accent-ice)] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[var(--client-accent)]",
  kickerDot: "h-1.5 w-1.5 rounded-full bg-[var(--client-accent)]",
  cardTitle: "text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a] sm:text-[30px]",
  cardSub: "mt-1.5 text-sm font-normal text-[#3f3f46]",
  sectionLabel:
    "mb-3 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-[#3f3f46]",
  sectionLabelDot: "h-1 w-1 rounded-full bg-[var(--client-accent)]",
  sectionDesc: "text-sm leading-relaxed text-[#3f3f46]",
  additionalServiceSections: "space-y-8 divide-y divide-[#dadce3] [&>div]:pt-6 [&>div:first-child]:pt-0",
  btnPrimary:
    "rounded-xl bg-[var(--client-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_-10px_var(--client-accent)] hover:bg-[var(--client-accent-dark)] focus-visible:ring-[var(--client-accent-soft)]",
  btnOutline:
    "rounded-xl border border-[#dadce3] bg-white px-5 py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#f7f8fb]",
  btnGhost: "rounded-xl px-4 py-2.5 text-sm font-semibold text-[#3f3f46] hover:bg-[#eceef3]",
  btnSecondary:
    "rounded-xl bg-[#0a0a0a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1c1c1f]",
  input:
    "h-auto rounded-[14px] border-[#dadce3] bg-white px-[18px] py-3 text-[15px] text-[#0a0a0a] placeholder:text-[#a1a1aa] shadow-none focus-visible:border-[var(--client-accent)] focus-visible:ring-[var(--client-accent-soft)]",
  label: "text-[11px] font-semibold uppercase tracking-wide text-[#3f3f46]",
  mono: "tabular-nums tracking-tight",
  badgeSuccess:
    "inline-flex items-center gap-2 rounded-full border border-[#dadce3] bg-white px-3.5 py-2 text-xs font-medium text-[#3f3f46]",
  badgeSuccessDot: "h-1.5 w-1.5 rounded-full bg-[#16a34a] shadow-[0_0_0_3px_rgba(22,163,74,0.13)]",
  pricePanel:
    "relative overflow-hidden rounded-[22px] border border-[var(--client-accent-dark)] bg-[var(--client-accent)] text-white shadow-[0_20px_50px_-24px_var(--client-accent)]",
  pricePanelBar: "h-1 bg-white/35",
  participantCard:
    "relative mb-3 rounded-2xl border border-[#dadce3] bg-white p-5 shadow-[0_1px_0_#eceef3] sm:p-[22px_26px]",
  typeToggleActive:
    "relative overflow-hidden rounded-[14px] border-none bg-[var(--client-accent)] p-5 text-white shadow-[0_8px_18px_-8px_var(--client-accent)]",
  typeToggleInactive:
    "relative overflow-hidden rounded-[14px] border border-[#dadce3] bg-white p-5 text-[#0a0a0a]",
  typeToggleBar: "absolute left-0 right-0 top-0 h-[3px] bg-[#0a0a0a]",
  serviceOption:
    "rounded-xl border border-[#dadce3] bg-white p-4 transition-colors hover:border-[var(--client-accent-soft)]",
  serviceOptionSelected: "border-[#bbf7d0] bg-[#f0fdf4] hover:border-[#bbf7d0]",
  serviceGroup:
    "rounded-2xl border border-[#dadce3] bg-white p-5 shadow-[0_1px_0_#eceef3]",
  serviceTitle: "text-sm font-semibold text-[#0a0a0a]",
  serviceDesc: "text-xs leading-relaxed text-[#3f3f46]",
  servicePrice: "text-xs font-semibold text-[var(--client-accent)]",
  serviceEmpty: "text-sm font-medium text-[#3f3f46]",

  /** Wspólne utility — używaj zamiast hardcodów hex w komponentach */
  textAccent: "text-[var(--client-accent)]",
  textAccentDark: "text-[var(--client-accent-dark)]",
  bgAccent: "bg-[var(--client-accent)]",
  bgAccentSoft: "bg-[var(--client-accent-soft)]",
  bgAccentIce: "bg-[var(--client-accent-ice)]",
  borderAccentSoft: "border-[var(--client-accent-soft)]",
  shadowAccentSm: "shadow-[0_6px_14px_-6px_var(--client-accent)]",
  avatarAccent:
    "bg-[var(--client-accent)] text-white shadow-[0_6px_14px_-6px_var(--client-accent)]",
  linkAccent: "text-xs font-medium text-[var(--client-accent)] hover:underline",
  infoBanner: "rounded-[14px] border border-[var(--client-accent-soft)] bg-[var(--client-accent-ice)]",
  sectionTitleDot: "h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--client-accent)]",
} as const;
