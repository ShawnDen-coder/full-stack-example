import { useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AccountMenu } from "../components/ui/account-menu.js";
import { buttonVariants } from "../components/ui/button.js";
import { authClient } from "../features/auth/client.js";
import { performSignOut } from "../features/auth/sign-out.js";

export function AuthenticatedLayout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  async function signOut() {
    setSigningOut(true);
    setSignOutError(false);
    const succeeded = await performSignOut({
      requestSignOut: () => authClient.signOut(),
      clearTenantQueries: async () => queryClient.removeQueries({ queryKey: ["todos"] }),
      refreshSession: () => session.refetch(),
      invalidateRouter: async () => router.invalidate(),
      navigateToLogin: () => router.navigate({ to: "/login", search: { returnTo: "/todos" } }),
    });
    setSigningOut(false);
    setSignOutError(!succeeded);
    return succeeded;
  }

  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <a
        className="sr-only z-50 rounded-md bg-background p-3 text-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#main-content"
      >
        跳到主要内容
      </a>
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link className="font-semibold tracking-tight" to="/">
            Full Stack Example
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {organization.data?.name ?? "工作区"}
          </span>
          <nav aria-label="账户导航" className="ml-auto flex items-center gap-2">
            <Link
              className={buttonVariants({ size: "sm", variant: "ghost" })}
              search={{ returnTo: "/todos" }}
              to="/workspaces"
            >
              工作区
            </Link>
            <AccountMenu
              email={session.data?.user?.email ?? undefined}
              onSignOut={signOut}
              signingOut={signingOut}
              signOutError={signOutError}
            />
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
