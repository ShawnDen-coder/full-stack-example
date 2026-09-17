import { Box, Divider, Link as MuiLink, Typography } from "@mui/material";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ThemeSelect } from "../../app/theme.js";
import { Brand } from "./brand.js";

export function WorkspaceFlowLayout({
  children,
  account,
}: {
  readonly children: ReactNode;
  readonly account?: string;
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        component="header"
        sx={{
          height: 64,
          display: "flex",
          alignItems: "center",
          px: { xs: 2, md: 10 },
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Brand />
        <Divider orientation="vertical" flexItem sx={{ mx: 4, my: 2 }} />
        <Typography variant="body2">工作区{account ? ` / ${account}` : ""}</Typography>
        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
          <ThemeSelect compact />
        </Box>
      </Box>
      <Box
        component="main"
        id="main-content"
        sx={{ flex: 1, display: "grid", placeItems: "start center", p: { xs: 2, md: 6 } }}
      >
        {children}
      </Box>
      <Box
        component="footer"
        sx={{
          minHeight: 56,
          px: { xs: 2, md: 10 },
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          color: "text.secondary",
          fontSize: 12,
        }}
      >
        <span>© 2026 Full Stack Example</span>
        <span>
          <MuiLink component={Link} to="/" color="inherit" underline="hover">
            隐私政策
          </MuiLink>
          　·　
          <MuiLink component={Link} to="/" color="inherit" underline="hover">
            服务条款
          </MuiLink>
        </span>
      </Box>
    </Box>
  );
}
