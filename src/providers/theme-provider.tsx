"use client";

import { useEffect } from "react";
import { useStore, useHasHydrated } from "@/lib/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useStore((s) => s.settings.theme);
  const hydrated = useHasHydrated();

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("light");
    } else {
      root.classList.remove("light");
    }
  }, [theme, hydrated]);

  return <>{children}</>;
}
