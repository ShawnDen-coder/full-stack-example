import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { appShellColors, ThemeSelect } from "../../app/theme.js";
import { authClient } from "../../features/auth/client.js";
import { useSignOut } from "../../features/auth/use-sign-out.js";
import { AccountMenu } from "./account-menu.js";
import { appNavigation, filterNavigation, normalizeNavigationRole } from "./app-navigation.js";
import { Brand } from "./brand.js";
import { SidebarNavigation, useActiveNavigationLabel } from "./sidebar-navigation.js";

const drawerWidth = "15rem";

export function AuthenticatedLayout() {
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();
  const memberRole = authClient.useActiveMemberRole();
  const organizations = authClient.useListOrganizations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut, signingOut, signOutError } = useSignOut();
  const [workspaceAnchor, setWorkspaceAnchor] = useState<HTMLElement | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string>();
  const navigation = filterNavigation(
    appNavigation,
    normalizeNavigationRole(memberRole.data?.role),
  );
  const activeNavigationLabel = useActiveNavigationLabel(navigation) ?? "工作台";

  async function selectWorkspace(organizationId: string) {
    if (organizationId === organization.data?.id) {
      setWorkspaceAnchor(null);
      return;
    }
    setWorkspaceError(undefined);
    const result = await authClient.organization.setActive({ organizationId });
    if (result.error) {
      setWorkspaceError("无法切换工作区，请重试。");
      return;
    }
    await session.refetch();
    await queryClient.removeQueries({ queryKey: ["todos"] });
    await router.invalidate();
    setWorkspaceAnchor(null);
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <a
        className="sr-only z-50 rounded-md p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#main-content"
      >
        跳到主要内容
      </a>
      <Drawer
        slotProps={{ paper: { component: "aside" } }}
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            border: 0,
            bgcolor: appShellColors.background,
            color: appShellColors.text,
          },
        }}
      >
        <Box sx={{ px: "1.25rem", py: "1.25rem" }}>
          <Brand dark />
        </Box>
        <Box sx={{ px: "0.75rem" }}>
          <ListItemButton
            aria-haspopup="dialog"
            aria-expanded={Boolean(workspaceAnchor)}
            onClick={(event) => setWorkspaceAnchor(event.currentTarget)}
            sx={{
              minHeight: "3rem",
              borderRadius: "0.625rem",
              color: "inherit",
              "&:hover": { bgcolor: appShellColors.surface },
            }}
          >
            <Avatar
              sx={{
                width: "1.75rem",
                height: "1.75rem",
                mr: "0.625rem",
                bgcolor: appShellColors.workspace,
                fontSize: "0.75rem",
              }}
            >
              {(organization.data?.name ?? "工").slice(0, 1).toUpperCase()}
            </Avatar>
            <ListItemText
              primary={organization.data?.name ?? "选择工作区"}
              slotProps={{
                primary: { noWrap: true, sx: { fontSize: "0.875rem", fontWeight: 650 } },
              }}
            />
            <ExpandMoreIcon fontSize="small" sx={{ color: appShellColors.subtle }} />
          </ListItemButton>
        </Box>
        <Divider sx={{ mx: "1.25rem", my: "1.25rem", borderColor: appShellColors.divider }} />
        <SidebarNavigation sections={navigation} />
      </Drawer>

      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: `calc(100% - ${drawerWidth})`,
          ml: drawerWidth,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Toolbar sx={{ minHeight: "4rem !important", px: { xs: "1.5rem", lg: "2.5rem" } }}>
          <Typography component="h1" variant="body2" color="text.secondary">
            产品平台{" "}
            <Box component="span" sx={{ px: "0.375rem", color: "divider" }}>
              {" "}
              /{" "}
            </Box>
            <Box component="strong" sx={{ color: "text.primary", fontWeight: 650 }}>
              {activeNavigationLabel}
            </Box>
          </Typography>
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ThemeSelect compact />
            <AccountMenu
              name={session.data?.user?.name ?? undefined}
              email={session.data?.user?.email ?? undefined}
              onSignOut={signOut}
              signingOut={signingOut}
              signOutError={signOutError}
            />
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        id="main-content"
        sx={{ minWidth: 0, minHeight: "100vh", ml: drawerWidth, pt: "4rem" }}
      >
        <Box
          sx={{
            px: { xs: "1.5rem", lg: "2.5rem" },
            py: { xs: "1.5rem", lg: "2.5rem" },
            maxWidth: "90rem",
            mx: "auto",
          }}
        >
          <Outlet />
        </Box>
      </Box>

      <Popover
        anchorEl={workspaceAnchor}
        open={Boolean(workspaceAnchor)}
        onClose={() => setWorkspaceAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { mt: "0.5rem", width: "15rem", p: "0.5rem" } } }}
      >
        <Typography
          sx={{
            px: "0.75rem",
            pt: "0.5rem",
            pb: "0.375rem",
            color: "text.secondary",
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          工作区
        </Typography>
        {organizations.data?.map((item) => (
          <ListItemButton
            key={item.id}
            selected={item.id === organization.data?.id}
            onClick={() => void selectWorkspace(item.id)}
            sx={{ borderRadius: "0.5rem", minHeight: "2.5rem" }}
          >
            <Avatar
              sx={{
                width: "1.5rem",
                height: "1.5rem",
                mr: "0.625rem",
                bgcolor: "primary.main",
                fontSize: "0.6875rem",
              }}
            >
              {item.name.slice(0, 1).toUpperCase()}
            </Avatar>
            <ListItemText
              primary={item.name}
              secondary={item.slug}
              slotProps={{
                primary: { noWrap: true, sx: { fontSize: "0.875rem" } },
                secondary: { noWrap: true, sx: { fontSize: "0.6875rem" } },
              }}
            />
            {item.id === organization.data?.id ? (
              <CheckIcon fontSize="small" color="primary" />
            ) : null}
          </ListItemButton>
        ))}
        {workspaceError ? (
          <Typography
            role="alert"
            sx={{ px: "0.75rem", py: "0.5rem", color: "error.main", fontSize: "0.75rem" }}
          >
            {workspaceError}
          </Typography>
        ) : null}
        <Divider sx={{ my: "0.375rem" }} />
        <Link
          to="/workspaces/new"
          search={{ returnTo: "/todos" }}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          <ListItemButton sx={{ borderRadius: "0.5rem", minHeight: "2.5rem" }}>
            <ListItemIcon sx={{ minWidth: "2rem" }}>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="创建工作区"
              slotProps={{ primary: { sx: { fontSize: "0.875rem", fontWeight: 600 } } }}
            />
          </ListItemButton>
        </Link>
      </Popover>
    </Box>
  );
}
