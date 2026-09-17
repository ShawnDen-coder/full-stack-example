import { Avatar, Button, List, ListItem, ListItemText } from "@mui/material";

export type WorkspaceListItem = {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
};

export function WorkspaceList({
  disabled,
  onSelect,
  organizations,
}: {
  readonly disabled: boolean;
  readonly onSelect: (organizationId: string) => void;
  readonly organizations: readonly WorkspaceListItem[];
}) {
  if (organizations.length === 0) return <p className="text-sm">还没有工作区。</p>;

  return (
    <List sx={{ display: "grid", gap: 1.5, p: 0 }}>
      {organizations.map((organization) => (
        <ListItem
          key={organization.id}
          sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, px: 2, py: 1.5, gap: 2 }}
        >
          <Avatar
            sx={{
              width: "1.75rem",
              height: "1.75rem",
              bgcolor: "action.selected",
              color: "primary.main",
              fontSize: "0.8125rem",
            }}
          >
            {organization.name.slice(0, 1).toUpperCase()}
          </Avatar>
          <ListItemText
            primary={organization.name}
            secondary={organization.slug}
            slotProps={{
              primary: { noWrap: true, sx: { fontWeight: 600 } },
              secondary: { noWrap: true, sx: { fontSize: "0.8125rem" } },
            }}
          />
          <Button
            aria-label={`选择工作区 ${organization.name}`}
            disabled={disabled}
            onClick={() => onSelect(organization.id)}
            type="button"
            size="small"
            variant="text"
          >
            ›
          </Button>
        </ListItem>
      ))}
    </List>
  );
}
