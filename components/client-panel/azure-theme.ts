/** Azure design tokens — wariant mockupu Panel Klienta */
export const azureColors = {
  bg: "#eef0f5",
  paper: "#ffffff",
  paperAlt: "#f7f8fb",
  ink: "#0a0a0a",
  inkSoft: "#3f3f46",
  inkMute: "#a1a1aa",
  line: "#dadce3",
  lineSoft: "#eceef3",
  accent: "#1e90ff",
  accentDark: "#1574d6",
  accentSoft: "#cee4fc",
  accentIce: "#e8f2fe",
  accentVivid: "#0078ff",
  black: "#0a0a0a",
  blackSoft: "#1c1c1f",
  danger: "#dc2626",
  dangerSoft: "#fee2e2",
  success: "#16a34a",
} as const;

/** Tailwind-friendly class bundles scoped under .client-panel */
export const azureClasses = {
  shell: "client-panel light min-h-screen bg-[#eef0f5] text-[#0a0a0a]",
  container: "mx-auto w-full max-w-[1240px] px-6 py-12 sm:px-[52px]",
  card: "overflow-hidden rounded-[18px] border border-[#dadce3] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-16px_rgba(15,23,42,0.12)]",
  cardAccentBlue: "h-1 bg-[#1e90ff]",
  cardAccentBlack: "h-1 bg-[#0a0a0a]",
  cardAccentSuccess: "h-1 bg-[#16a34a]",
  cardAccentDanger: "h-1 bg-[#dc2626]",
  cardInner: "px-6 py-8 sm:px-[38px] sm:py-[34px]",
  kicker:
    "inline-flex items-center gap-2 rounded-full border border-[#cee4fc] bg-[#e8f2fe] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-[#1e90ff]",
  kickerDot: "h-1.5 w-1.5 rounded-full bg-[#1e90ff]",
  cardTitle: "text-[26px] font-semibold leading-tight tracking-tight text-[#0a0a0a] sm:text-[30px]",
  cardSub: "mt-1.5 text-sm font-normal text-[#3f3f46]",
  sectionLabel:
    "mb-3 flex items-center gap-2 text-[11.5px] font-semibold tracking-wide text-[#3f3f46]",
  sectionLabelDot: "h-1 w-1 rounded-full bg-[#1e90ff]",
  btnPrimary:
    "rounded-xl bg-[#1e90ff] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_22px_-10px_#1e90ff] hover:bg-[#1574d6] focus-visible:ring-[#cee4fc]",
  btnOutline:
    "rounded-xl border border-[#dadce3] bg-white px-5 py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#f7f8fb]",
  btnGhost: "rounded-xl px-4 py-2.5 text-sm font-semibold text-[#3f3f46] hover:bg-[#eceef3]",
  btnSecondary:
    "rounded-xl bg-[#0a0a0a] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1c1c1f]",
  input:
    "h-auto rounded-[14px] border-[#dadce3] bg-white px-[18px] py-3 text-[15px] shadow-none focus-visible:border-[#1e90ff] focus-visible:ring-[#cee4fc]",
  label: "text-[11px] font-semibold uppercase tracking-wide text-[#3f3f46]",
  mono: "font-mono tabular-nums tracking-tight",
  badgeSuccess:
    "inline-flex items-center gap-2 rounded-full border border-[#dadce3] bg-white px-3.5 py-2 text-xs font-medium text-[#3f3f46]",
  badgeSuccessDot: "h-1.5 w-1.5 rounded-full bg-[#16a34a] shadow-[0_0_0_3px_rgba(22,163,74,0.13)]",
  pricePanel:
    "relative overflow-hidden rounded-[22px] border border-[#1e90ff] bg-[#1e90ff] text-white shadow-[0_20px_50px_-24px_#1e90ff]",
  pricePanelBar: "h-1 bg-[#0a0a0a]",
  participantCard:
    "relative mb-3 rounded-2xl border border-[#dadce3] bg-white p-5 shadow-[0_1px_0_#eceef3] sm:p-[22px_26px]",
  typeToggleActive:
    "relative overflow-hidden rounded-[14px] border-none bg-[#1e90ff] p-5 text-white shadow-[0_8px_18px_-8px_#1e90ff]",
  typeToggleInactive:
    "relative overflow-hidden rounded-[14px] border border-[#dadce3] bg-white p-5 text-[#0a0a0a]",
  typeToggleBar: "absolute left-0 right-0 top-0 h-[3px] bg-[#0a0a0a]",
  serviceOption:
    "rounded-xl border border-[#dadce3] bg-white p-4 transition-colors hover:border-[#cee4fc]",
  serviceOptionSelected: "border-[#bbf7d0] bg-[#f0fdf4] hover:border-[#bbf7d0]",
  serviceGroup:
    "rounded-2xl border border-[#dadce3] bg-white p-5 shadow-[0_1px_0_#eceef3]",
  serviceTitle: "text-sm font-semibold text-[#0a0a0a]",
  serviceDesc: "text-xs leading-relaxed text-[#3f3f46]",
  servicePrice: "text-xs font-semibold text-[#1e90ff]",
  serviceEmpty: "text-sm font-medium text-[#3f3f46]",
} as const;
