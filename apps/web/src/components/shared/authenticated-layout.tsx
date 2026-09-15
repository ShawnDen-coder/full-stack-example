import { Button } from "@mui/material";
import { Link, Outlet } from "@tanstack/react-router";
import { authClient } from "../../features/auth/client.js";
import { useSignOut } from "../../features/auth/use-sign-out.js";
import { AccountMenu } from "./account-menu.js";

export function AuthenticatedLayout() {
  const session = authClient.useSession();
  const organization = authClient.useActiveOrganization();
  const { signOut, signingOut, signOutError } = useSignOut();

  return (
    <div className="min-h-screen">
      <a
        className="sr-only z-50 rounded-md p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        href="#main-content"
      >
        跳到主要内容
      </a>
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link className="font-semibold tracking-tight" to="/">
            Full Stack Example
          </Link>
          <span className="hidden text-sm sm:inline">{organization.data?.name ?? "工作区"}</span>
          <nav aria-label="账户导航" className="ml-auto flex items-center gap-2">
            <Link search={{ returnTo: "/todos" }} to="/workspaces">
              <Button size="small" variant="text">
                工作区
              </Button>
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
