import MuiAlert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import { useEffect, useState } from "react";

export function AccountMenu({
  name,
  email,
  onSignOut,
  signingOut = false,
  signOutError = false,
}: {
  readonly name?: string | undefined;
  readonly email?: string | undefined;
  readonly defaultOpen?: boolean;
  readonly onSignOut: () => Promise<boolean>;
  readonly signingOut?: boolean;
  readonly signOutError?: boolean;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(signOutError);
  const initials = email?.slice(0, 1).toUpperCase() ?? "U";
  useEffect(() => {
    if (signOutError) {
      setAnchor(null);
      setSnackbarOpen(true);
    }
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
        {name && <MenuItem disabled>{name}</MenuItem>}
        {email && (
          <MenuItem disabled sx={{ fontSize: 12 }}>
            {email}
          </MenuItem>
        )}
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
      <Snackbar open={snackbarOpen} onClose={() => setSnackbarOpen(false)}>
        <MuiAlert onClose={() => setSnackbarOpen(false)} severity="error" variant="filled">
          退出失败，请重试。
        </MuiAlert>
      </Snackbar>
    </>
  );
}
