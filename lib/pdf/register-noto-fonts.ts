import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { jsPDF } from "jspdf";

const VFS_REGULAR = "NotoSans-Regular.ttf";
const VFS_BOLD = "NotoSans-Bold.ttf";

let cached: { regular: string; bold: string } | null = null;

/** Odrzuca HTML (zły URL pobrania) i pliki bez nagłówka TTF/OTF — inaczej jsPDF/autotable się wywalają. */
function assertLikelyTtfOrOtf(buf: Buffer, label: string): void {
  if (buf.length < 4096) {
    throw new Error(
      `${label}: plik zbyt mały (${buf.length} B). Uruchom: pnpm run download-fonts`,
    );
  }
  const head = buf.subarray(0, Math.min(256, buf.length)).toString("utf8").trimStart();
  if (head.startsWith("<!") || head.startsWith("<html") || head.startsWith("<?xml")) {
    throw new Error(
      `${label}: to nie TTF (wygląda na HTML). Uruchom: pnpm run download-fonts`,
    );
  }
  const sig = buf.subarray(0, 4);
  const ascii = sig.toString("ascii");
  const isTtfScalar = sig[0] === 0 && sig[1] === 1 && sig[2] === 0 && sig[3] === 0;
  const ok = isTtfScalar || ascii === "OTTO" || ascii === "true" || ascii === "ttcf";
  if (!ok) {
    throw new Error(`${label}: nie rozpoznano nagłówka TTF/OTF. Uruchom: pnpm run download-fonts`);
  }
}

function readFontBase64(): { regular: string; bold: string } {
  if (cached) return cached;
  const dir = join(process.cwd(), "public", "fonts");
  const regPath = join(dir, VFS_REGULAR);
  const boldPath = join(dir, VFS_BOLD);
  if (!existsSync(regPath) || !existsSync(boldPath)) {
    throw new Error(
      `Brak czcionek Noto Sans w ${dir}. Uruchom: pnpm run download-fonts`,
    );
  }
  const regBuf = readFileSync(regPath);
  const boldBuf = readFileSync(boldPath);
  assertLikelyTtfOrOtf(regBuf, VFS_REGULAR);
  assertLikelyTtfOrOtf(boldBuf, VFS_BOLD);
  cached = {
    regular: regBuf.toString("base64"),
    bold: boldBuf.toString("base64"),
  };
  return cached;
}

/**
 * Osadza Noto Sans w jsPDF (UTF-8, polskie znaki). Wywołaj zaraz po `new jsPDF(...)`.
 */
export function registerNotoFonts(doc: jsPDF): void {
  const { regular, bold } = readFontBase64();
  doc.addFileToVFS(VFS_REGULAR, regular);
  doc.addFont(VFS_REGULAR, "NotoSans", "normal", undefined, "Identity-H");
  doc.addFileToVFS(VFS_BOLD, bold);
  doc.addFont(VFS_BOLD, "NotoSans", "bold", undefined, "Identity-H");
}

/** Nazwa rodziny po rejestracji — do `setFont` / jspdf-autotable */
export const NOTO_SANS_FAMILY = "NotoSans" as const;
