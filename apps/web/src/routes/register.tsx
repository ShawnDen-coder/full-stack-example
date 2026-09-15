import { createFileRoute, redirect } from "@tanstack/react-router";
import { activeOrganizationId, validateReturnToSearch } from "../features/auth/navigation.js";
import { RegisterPage } from "../components/auth/register-page.js";

export const Route = createFileRoute("/register")({
  validateSearch: validateReturnToSearch,
  beforeLoad: ({ context, search }) => {
    if (context.session)
      throw redirect({
        to: activeOrganizationId(context.session) ? search.returnTo : "/workspaces",
        search: { returnTo: search.returnTo },
      });
  },
  component: RegisterRoutePage,
});

function RegisterRoutePage() {
  const { returnTo } = Route.useSearch();
  return <RegisterPage returnTo={returnTo} />;
}






