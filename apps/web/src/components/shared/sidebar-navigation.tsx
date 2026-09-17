import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { appShellColors } from "../../app/theme.js";
import type {
  NavigationEntry,
  NavigationGroup,
  NavigationPage,
  NavigationSection,
} from "./app-navigation.js";
import { navigationIconRegistry } from "./app-navigation.js";

export function SidebarNavigation({
  sections,
}: {
  readonly sections: readonly NavigationSection[];
}) {
  const matchRoute = useMatchRoute();
  return (
    <Box component="nav" aria-label="主要导航">
      {sections.map((section) => (
        <List
          key={section.id}
          subheader={
            <ListSubheader
              component="div"
              sx={{
                bgcolor: "transparent",
                color: appShellColors.subtle,
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                lineHeight: 2.5,
                textTransform: "uppercase",
              }}
            >
              {section.label}
            </ListSubheader>
          }
          sx={{ px: "0.75rem" }}
        >
          {section.items.map((item) => (
            <SidebarEntry key={item.id} item={item} matchRoute={matchRoute} />
          ))}
        </List>
      ))}
    </Box>
  );
}

function SidebarEntry({
  item,
  matchRoute,
}: {
  readonly item: NavigationEntry;
  readonly matchRoute: ReturnType<typeof useMatchRoute>;
}) {
  if (item.kind === "page") return <SidebarPage page={item} />;
  return <SidebarGroup group={item} matchRoute={matchRoute} />;
}

function SidebarPage({
  page,
  nested = false,
}: {
  readonly page: NavigationPage;
  readonly nested?: boolean;
}) {
  const Icon = navigationIconRegistry[page.iconKey];
  return (
    <Link
      to={page.to}
      activeOptions={{ exact: page.exact ?? false }}
      activeProps={{ className: "active" }}
      style={{ color: "inherit", textDecoration: "none" }}
    >
      <ListItemButton
        component="span"
        sx={{
          minHeight: "2.75rem",
          borderRadius: "0.625rem",
          pl: nested ? "2.5rem" : "1rem",
          color: appShellColors.muted,
          ".active &": { bgcolor: appShellColors.selected, color: appShellColors.accent },
          ".active &:hover, &:hover": { bgcolor: appShellColors.surface },
        }}
      >
        {Icon ? (
          <ListItemIcon sx={{ minWidth: "2rem", color: "inherit" }}>
            <Icon fontSize="small" />
          </ListItemIcon>
        ) : null}
        <ListItemText
          primary={page.label}
          slotProps={{ primary: { noWrap: true, sx: { fontSize: "0.875rem", fontWeight: 600 } } }}
        />
      </ListItemButton>
    </Link>
  );
}

function SidebarGroup({
  group,
  matchRoute,
}: {
  readonly group: NavigationGroup;
  readonly matchRoute: ReturnType<typeof useMatchRoute>;
}) {
  const Icon = navigationIconRegistry[group.iconKey];
  const active = group.children.some((child) =>
    Boolean(matchRoute({ to: child.to, fuzzy: !(child.exact ?? false) })),
  );
  const [open, setOpen] = useState(active);
  const contentId = `navigation-group-${group.id}`;
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return (
    <>
      <ListItemButton
        aria-controls={contentId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        sx={{
          minHeight: "2.75rem",
          borderRadius: "0.625rem",
          color: active ? appShellColors.accent : appShellColors.muted,
          bgcolor: active ? "rgba(22,59,55,0.45)" : "transparent",
          "&:hover": { bgcolor: appShellColors.surface },
        }}
      >
        {Icon ? (
          <ListItemIcon sx={{ minWidth: "2rem", color: "inherit" }}>
            <Icon fontSize="small" />
          </ListItemIcon>
        ) : null}
        <ListItemText
          primary={group.label}
          slotProps={{ primary: { noWrap: true, sx: { fontSize: "0.875rem", fontWeight: 600 } } }}
        />
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
      <Collapse id={contentId} in={open} timeout="auto" unmountOnExit>
        <List disablePadding>
          {group.children.map((child) => (
            <SidebarPage key={child.id} page={child} nested />
          ))}
        </List>
      </Collapse>
    </>
  );
}

export function useActiveNavigationLabel(sections: readonly NavigationSection[]) {
  const matchRoute = useMatchRoute();
  return useMemo(() => {
    for (const section of sections) {
      for (const item of section.items) {
        const pages = item.kind === "page" ? [item] : item.children;
        const active = pages.find((page) =>
          Boolean(matchRoute({ to: page.to, fuzzy: !(page.exact ?? false) })),
        );
        if (active) return active.label;
      }
    }
    return undefined;
  }, [matchRoute, sections]);
}
