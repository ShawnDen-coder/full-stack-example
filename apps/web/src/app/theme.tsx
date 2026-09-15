import CssBaseline from "@mui/material/CssBaseline";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
  useColorScheme,
} from "@mui/material/styles";
import type { PropsWithChildren } from "react";
import { createContext, useContext } from "react";
export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "ui-theme";
const theme = createTheme({ colorSchemes: { dark: true } });
const ThemeContext = createContext<{ theme: ThemeMode; changeTheme: (value: string) => void }>({
  theme: "system",
  changeTheme: () => undefined,
});
function Inner({ children }: PropsWithChildren) {
  const { mode, setMode } = useColorScheme();
  const value = (mode ?? "system") as ThemeMode;
  return (
    <ThemeContext.Provider
      value={{
        theme: value,
        changeTheme: (v) => {
          if (v === "light" || v === "dark" || v === "system") {
            localStorage.setItem(STORAGE_KEY, v);
            setMode(v);
          }
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function ThemeProvider({
  children,
  initialTheme = "system",
  persist = true,
}: PropsWithChildren<{ readonly initialTheme?: ThemeMode; readonly persist?: boolean }>) {
  // 沿用旧的 ui-theme 存储键，升级后不丢失用户主题偏好。
  const stored =
    persist && typeof window !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as ThemeMode | null)
      : null;
  return (
    <MuiThemeProvider
      theme={theme}
      defaultMode={stored ?? initialTheme}
      modeStorageKey={STORAGE_KEY}
      storageManager={persist ? undefined : null}
      noSsr
    >
      <CssBaseline />
      <Inner>{children}</Inner>
    </MuiThemeProvider>
  );
}
export function ThemeSelect({
  className = "",
  sx,
}: {
  readonly className?: string;
  readonly sx?: SxProps<Theme>;
}) {
  const { theme, changeTheme } = useTheme();
  return (
    <FormControl size="small" className={className} sx={sx}>
      <Select
        aria-label="选择外观主题"
        value={theme}
        onChange={(e) => changeTheme(String(e.target.value))}
      >
        {(["system", "light", "dark"] as const).map((m) => (
          <MenuItem key={m} value={m}>
            {themeLabel(m)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
export function useTheme() {
  return useContext(ThemeContext);
}
function themeLabel(value: ThemeMode) {
  return { system: "跟随系统", light: "浅色", dark: "深色" }[value];
}
