"use client";

import type { CSSProperties, ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { azureClasses, azureCssVars } from "./azure-theme";
import "./client-panel.css";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
});

type ClientPanelShellProps = {
  children: ReactNode;
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
        "font-[family-name:var(--font-dm-sans)]",
        className,
      )}
      style={azureCssVars as CSSProperties}
    >
      <div className={cn(azureClasses.container, containerClassName)}>{children}</div>
    </div>
  );
}
