"use client";

import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { azureClasses } from "./azure-theme";
import "./client-panel.css";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument-serif",
  weight: ["400"],
  style: ["italic"],
});

type ClientPanelShellProps = {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
};

export function ClientPanelShell({
  children,
  className,
  containerClassName,
}: ClientPanelShellProps) {
  return (
    <div
      className={cn(
        azureClasses.shell,
        dmSans.variable,
        jetbrainsMono.variable,
        instrumentSerif.variable,
        "font-[family-name:var(--font-dm-sans)]",
        className,
      )}
    >
      <div className={cn(azureClasses.container, containerClassName)}>{children}</div>
    </div>
  );
}
