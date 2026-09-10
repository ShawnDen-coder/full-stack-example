import type { FormEvent } from "react";

export function WorkspaceForm({
  disabled,
  error,
  name,
  onNameChange,
  onSlugChange,
  onSubmit,
  slug,
}: {
  readonly disabled: boolean;
  readonly error?: string;
  readonly name: string;
  readonly onNameChange: (value: string) => void;
  readonly onSlugChange: (value: string) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly slug: string;
}) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <fieldset className="fieldset gap-3">
        <legend className="fieldset-legend">创建工作区</legend>
        <label className="label" htmlFor="workspace-name">
          名称
        </label>
        <input
          className="input w-full"
          disabled={disabled}
          id="workspace-name"
          onChange={(event) => onNameChange(event.target.value)}
          required
          value={name}
        />
        <label className="label" htmlFor="workspace-slug">
          标识
        </label>
        <input
          className="input w-full"
          disabled={disabled}
          id="workspace-slug"
          onChange={(event) => onSlugChange(event.target.value.toLowerCase())}
          pattern="[a-z0-9-]+"
          required
          value={slug}
        />
      </fieldset>
      {error ? (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="card-actions">
        <button className="btn btn-primary w-full" disabled={disabled} type="submit">
          创建并继续
        </button>
      </div>
    </form>
  );
}
