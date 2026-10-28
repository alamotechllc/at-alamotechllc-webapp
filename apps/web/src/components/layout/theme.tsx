import { useEffect, type ReactNode } from "react";

export function SystemTheme({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);
  return children;
}
