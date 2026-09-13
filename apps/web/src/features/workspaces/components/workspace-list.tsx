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
  if (organizations.length === 0) return <p className="text-base-content/70">还没有工作区。</p>;

  return (
    <ul className="list rounded-box bg-base-200">
      {organizations.map((organization) => (
        <li className="list-row" key={organization.id}>
          <div className="list-col-grow">
            <p>{organization.name}</p>
            <p className="text-sm text-base-content/60">{organization.slug}</p>
          </div>
          <button
            aria-label={`选择工作区 ${organization.name}`}
            className="btn btn-outline btn-sm"
            disabled={disabled}
            onClick={() => onSelect(organization.id)}
            type="button"
          >
            选择
          </button>
        </li>
      ))}
    </ul>
  );
}
