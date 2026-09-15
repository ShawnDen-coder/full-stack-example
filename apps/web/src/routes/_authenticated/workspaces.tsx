import { createFileRoute } from "@tanstack/react-router";
import { validateReturnToSearch } from "../../features/auth/navigation.js";
import { WorkspacesPage } from "../../components/workspaces/workspaces-page.js";

export const Route = createFileRoute("/_authenticated/workspaces")({
  validateSearch: validateReturnToSearch,
  component: WorkspacesRoutePage,
});

function WorkspacesRoutePage() {
  const { returnTo } = Route.useSearch();
  return <WorkspacesPage returnTo={returnTo} />;
}






