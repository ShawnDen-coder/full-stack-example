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
    <ul className="divide-y rounded-lg border">
      {organizations.map((organization) => (
        <li className="flex items-center gap-4 p-4" key={organization.id}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{organization.name}</p>
            <p className="text-sm">{organization.slug}</p>
          </div>
          <Button
            aria-label={`选择工作区 ${organization.name}`}
            disabled={disabled}
            onClick={() => onSelect(organization.id)}
            type="button"
            size="small"
            variant="outlined"
          >
            选择
          </Button>
        </li>
      ))}
    </ul>
  );
}

import { Button } from "@mui/material";
