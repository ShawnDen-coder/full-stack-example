import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "../components/auth/login-page.js";
import { activeOrganizationId, validateReturnToSearch } from "../features/auth/navigation.js";

export const Route = createFileRoute("/login")({
  validateSearch: validateReturnToSearch,
  beforeLoad: ({ context, search }) => {
    if (context.session)
      throw redirect({
        to: activeOrganizationId(context.session) ? search.returnTo : "/workspaces",
        search: { returnTo: search.returnTo },
      });
  },
  component: LoginRoutePage,
});

function LoginRoutePage() {
  const { returnTo } = Route.useSearch();
  return <LoginPage returnTo={returnTo} />;
}
