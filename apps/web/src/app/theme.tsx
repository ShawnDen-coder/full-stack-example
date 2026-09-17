import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import "@fontsource-variable/geist";
import CssBaseline from "@mui/material/CssBaseline";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
  useColorScheme,
} from "@mui/material/styles";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
const STORAGE_KEY = "ui-theme";
export const appShellColors = {
  background: "#111a22",
  surface: "#1d2a34",
  selected: "#163b37",
  selectedHover: "#1b4941",
  text: "#f4f7f8",
  muted: "#aab7c0",
  subtle: "#7e8d99",
  divider: "#2a3842",
  accent: "#52d7a3",
  workspace: "#3555d4",
} as const;
const theme = createTheme({
  defaultColorScheme: "light",
  colorSchemes: {
    light: {
      palette: {
        background: { default: "#f7f9fc", paper: "#ffffff" },
        primary: { main: "#1a5dd7", contrastText: "#ffffff" },
        text: { primary: "#182230", secondary: "#607089" },
        divider: "#dbe0e8",
      },
    },
    dark: {
      palette: {
        background: { default: "#0e111a", paper: "#1a1f2b" },
        primary: { main: "#69a0ff", contrastText: "#0e111a" },
        text: { primary: "#f3f6fb", secondary: "#a5afc0" },
        divider: "#30394b",
      },
    },
  },
  spacing: (factor: number) => `${factor * 0.5}rem`,
  shape: { borderRadius: "0.625rem" },
  typography: {
    fontFamily: '"Geist", "Inter", "Roboto", "Helvetica", Arial, sans-serif',
    h4: { fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" },
    h5: { fontWeight: 700, letterSpacing: "-0.02em" },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        html: { fontSize: "16px" },
        body: { WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" },
        "*:focus-visible": {
          outline: "2px solid",
          outlineColor: "currentColor",
          outlineOffset: "2px",
        },
        "::selection": { backgroundColor: "rgba(26, 93, 215, 0.22)" },
      },
    },
    MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none" } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiToolbar: { styleOverrides: { root: { minHeight: "4rem" } } },
    MuiListItemButton: {
      styleOverrides: { root: { borderRadius: "0.625rem", minHeight: "2.75rem" } },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 0.25rem 0.75rem rgba(15, 23, 42, 0.10)",
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: "0.625rem" } },
    },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: "0.625rem" } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiMenu: {
      styleOverrides: {
        paper: { border: "1px solid", borderColor: "divider", borderRadius: "0.75rem" },
      },
    },
    MuiAvatar: { styleOverrides: { root: { border: "1px solid", borderColor: "divider" } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: "0.625rem" } } },
    MuiSnackbarContent: { styleOverrides: { root: { borderRadius: "0.625rem" } } },
  },
});
const ThemeContext = createContext<{ theme: ThemeMode; changeTheme: (value: string) => void }>({
  theme: "system",
  changeTheme: () => undefined,
});
function Inner({ children }: PropsWithChildren) {
  const { mode, setMode } = useColorScheme();
  const value = (mode ?? "system") as ThemeMode;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const apply = () => {
      const resolved =
        value === "system" &&
        typeof matchMedia === "function" &&
        matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : value === "system"
            ? "light"
            : value;
      document.documentElement.setAttribute("data-mui-color-scheme", resolved);
    };
    apply();
    if (value !== "system" || typeof matchMedia !== "function") return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply();
    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, [value]);
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
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const legacy = media as unknown as {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    if (!legacy.addListener && media.addEventListener) {
      legacy.addListener = (listener) => media.addEventListener("change", listener);
      legacy.removeListener = (listener) => media.removeEventListener("change", listener);
    }
  }
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
  compact = false,
}: {
  readonly className?: string;
  readonly sx?: SxProps<Theme>;
  readonly compact?: boolean;
}) {
  const { theme, changeTheme } = useTheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  if (compact) {
    return (
      <>
        <IconButton
          aria-label="选择外观主题"
          onClick={(event) => setAnchor(event.currentTarget)}
          size="small"
          sx={{ border: 1, borderColor: "divider", borderRadius: 1, ...sx }}
          className={className}
        >
          <LightModeOutlinedIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
          {(["system", "light", "dark"] as const).map((mode) => (
            <MenuItem
              key={mode}
              selected={mode === theme}
              onClick={() => {
                changeTheme(mode);
                setAnchor(null);
              }}
            >
              {themeLabel(mode)}
            </MenuItem>
          ))}
        </Menu>
      </>
    );
  }
  return (
    <FormControl size="small" className={className} sx={sx}>
      <Select
        aria-label="选择外观主题"
        native
        value={theme}
        variant="outlined"
        onChange={(e) => changeTheme(String(e.target.value))}
      >
        {(["system", "light", "dark"] as const).map((m) => (
          <option key={m} value={m}>
            {themeLabel(m)}
          </option>
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
