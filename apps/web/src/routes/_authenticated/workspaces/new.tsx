import { createFileRoute } from "@tanstack/react-router";
import { CreateWorkspacePage } from "../../../components/workspaces/create-workspace-page.js";
import { validateReturnToSearch } from "../../../features/auth/navigation.js";

export const Route = createFileRoute("/_authenticated/workspaces/new")({
  validateSearch: validateReturnToSearch,
  component: CreateWorkspaceRoutePage,
});

function CreateWorkspaceRoutePage() {
  const { returnTo } = Route.useSearch();
  return <CreateWorkspacePage returnTo={returnTo} />;
}
