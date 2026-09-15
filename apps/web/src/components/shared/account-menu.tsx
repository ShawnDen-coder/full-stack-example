import MuiAlert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import { useEffect, useState } from "react";
import { useTheme } from "../../app/theme.js";

export function AccountMenu({
  email,
  onSignOut,
  signingOut = false,
  signOutError = false,
}: {
  readonly email?: string | undefined;
  readonly defaultOpen?: boolean;
  readonly onSignOut: () => Promise<boolean>;
  readonly signingOut?: boolean;
  readonly signOutError?: boolean;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [themeAnchor, setThemeAnchor] = useState<null | HTMLElement>(null);
  const { theme, changeTheme } = useTheme();
  const initials = email?.slice(0, 1).toUpperCase() ?? "U";
  useEffect(() => {
    if (signOutError) setAnchor(null);
  }, [signOutError]);
  async function handleSignOut() {
    if (await onSignOut()) setAnchor(null);
  }
  return (
    <>
      <IconButton aria-label="打开账户菜单" onClick={(e) => setAnchor(e.currentTarget)}>
        <Avatar sx={{ width: 32, height: 32 }}>{initials}</Avatar>
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {email && <MenuItem disabled>{email}</MenuItem>}
        <Divider />
        <MenuItem onClick={(e) => setThemeAnchor(e.currentTarget)}>
          外观：{themeLabel(theme)}
        </MenuItem>
        <MenuItem disabled={signingOut} onClick={() => void handleSignOut()}>
          {signingOut ? (
            <>
              <CircularProgress size={18} sx={{ mr: 1 }} />
              正在退出…
            </>
          ) : (
            "退出登录"
          )}
        </MenuItem>
      </Menu>
      <Menu anchorEl={themeAnchor} open={Boolean(themeAnchor)} onClose={() => setThemeAnchor(null)}>
        {(["system", "light", "dark"] as const).map((mode) => (
          <MenuItem
            selected={mode === theme}
            key={mode}
            onClick={() => {
              changeTheme(mode);
              setThemeAnchor(null);
            }}
          >
            {themeLabel(mode)}
          </MenuItem>
        ))}
      </Menu>
      <Snackbar open={signOutError} autoHideDuration={5000}>
        <MuiAlert severity="error" variant="filled">
          退出失败，请重试。
        </MuiAlert>
      </Snackbar>
    </>
  );
}
function themeLabel(theme: "system" | "light" | "dark") {
  return { system: "跟随系统", light: "浅色", dark: "深色" }[theme];
}








