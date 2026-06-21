export type DevEmailAttachment = {
  filename: string;
  sizeBytes?: number;
};

export type DevEmailLogParams = {
  /** Krótka etykieta źródła, np. "booking-confirmation" */
  context: string;
  to: string;
  subject: string;
  attachments?: DevEmailAttachment[];
  ok: boolean;
  error?: string;
};

/** Włączone w development lub gdy DEV_LOG_EMAILS=true */
export function isDevEmailLogEnabled(): boolean {
  return process.env.NODE_ENV === "development" || process.env.DEV_LOG_EMAILS === "true";
}

export function attachmentSizeFromBase64(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function logDevEmail(params: DevEmailLogParams): void {
  if (!isDevEmailLogEnabled()) return;

  const status = params.ok ? "WYSŁANO" : "BŁĄD";
  const lines = [
    "",
    "────────────────────────────────────────",
    `[DEV EMAIL] ${params.context} — ${status}`,
    `  Do:    ${params.to}`,
    `  Temat: ${params.subject}`,
  ];

  const attachments = params.attachments ?? [];
  if (attachments.length > 0) {
    lines.push(`  Załączniki (${attachments.length}):`);
    for (const file of attachments) {
      const size = file.sizeBytes != null ? ` (${formatBytes(file.sizeBytes)})` : "";
      lines.push(`    - ${file.filename}${size}`);
    }
  } else {
    lines.push("  Załączniki: brak");
  }

  if (!params.ok && params.error) {
    lines.push(`  Błąd: ${params.error}`);
  }

  lines.push("────────────────────────────────────────");

  if (params.ok) {
    console.log(lines.join("\n"));
  } else {
    console.error(lines.join("\n"));
  }
}
