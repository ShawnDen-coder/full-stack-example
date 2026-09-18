import { createRoute, redirect } from "@tanstack/react-router";
import { LoginPage } from "../../components/auth/login-page.js";
import { RegisterPage } from "../../components/auth/register-page.js";
import { HomePage } from "../../components/system/home-page.js";
import { activeOrganizationId, validateReturnToSearch } from "../../features/auth/navigation.js";
import { type RouterContext, rootRoute } from "./root-route.js";

export const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: validateReturnToSearch,
  beforeLoad: redirectAuthenticatedUser,
  component: LoginRoutePage,
});

export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  validateSearch: validateReturnToSearch,
  beforeLoad: redirectAuthenticatedUser,
  component: RegisterRoutePage,
});

function redirectAuthenticatedUser({
  context,
  search,
}: {
  readonly context: RouterContext;
  readonly search: { readonly returnTo: string };
}) {
  if (context.session) {
    throw redirect({
      to: activeOrganizationId(context.session) ? search.returnTo : "/workspaces",
      search: { returnTo: search.returnTo },
    });
  }
}

function LoginRoutePage() {
  const { returnTo } = loginRoute.useSearch();
  return <LoginPage returnTo={returnTo} />;
}

function RegisterRoutePage() {
  const { returnTo } = registerRoute.useSearch();
  return <RegisterPage returnTo={returnTo} />;
}
