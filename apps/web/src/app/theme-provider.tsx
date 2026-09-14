import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "ui-theme";

function getStoredTheme(): ThemeMode {
  const value = globalThis.localStorage?.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function ThemeProvider({
  children,
  initialTheme = "system",
  persist = true,
}: PropsWithChildren<{
  readonly initialTheme?: ThemeMode;
  readonly persist?: boolean;
}>) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => setTheme(persist ? getStoredTheme() : initialTheme), [initialTheme, persist]);

  useEffect(() => {
    const media = globalThis.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && (media?.matches ?? false));
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };
    apply();
    media?.addEventListener("change", apply);
    return () => media?.removeEventListener("change", apply);
  }, [theme]);

  function changeTheme(value: string) {
    if (value !== "light" && value !== "dark" && value !== "system") return;
    if (persist) globalThis.localStorage?.setItem(STORAGE_KEY, value);
    setTheme(value);
  }

  return <ThemeContext.Provider value={{ theme, changeTheme }}>{children}</ThemeContext.Provider>;
}

const ThemeContext = createContext<{ theme: ThemeMode; changeTheme: (value: string) => void }>({
  theme: "system",
  changeTheme: () => undefined,
});

export function ThemeSelect({ className = "" }: { readonly className?: string }) {
  const { theme, changeTheme } = useContext(ThemeContext);
  return (
    <label className={`inline-flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <span>外观</span>
      <select
        aria-label="选择外观主题"
        className="h-9 rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        onChange={(event) => changeTheme(event.target.value)}
        value={theme}
      >
        <option value="system">跟随系统</option>
        <option value="light">浅色</option>
        <option value="dark">深色</option>
      </select>
    </label>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
