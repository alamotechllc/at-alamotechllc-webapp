import { useEffect, type ReactNode } from "react";

function applySystemTheme(): void {
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", dark);
}

export function SystemTheme({ children }: { children: ReactNode }) {
  useEffect(() => {
    applySystemTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applySystemTheme();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return children;
}
