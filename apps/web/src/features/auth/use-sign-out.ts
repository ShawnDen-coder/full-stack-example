import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "./client.js";
import { performSignOut } from "./sign-out.js";

export function useSignOut() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const session = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const signOut = async () => {
    setSigningOut(true);
    setSignOutError(false);
    const ok = await performSignOut({
      requestSignOut: () => authClient.signOut(),
      clearTenantQueries: async () => queryClient.removeQueries({ queryKey: ["todos"] }),
      refreshSession: () => session.refetch(),
      invalidateRouter: () => router.invalidate(),
      navigateToLogin: () => router.navigate({ to: "/login", search: { returnTo: "/todos" } }),
    });
    setSigningOut(false);
    setSignOutError(!ok);
    return ok;
  };
  return { signOut, signingOut, signOutError };
}
