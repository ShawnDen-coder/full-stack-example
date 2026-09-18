import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { authClient } from "../auth/client.js";

/** Coordinates the client-side part of an organization switch. */
export function useWorkspaceTransition() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const session = authClient.useSession();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string>();

  const activate = useCallback(
    async (organizationId: string): Promise<boolean> => {
      setError(undefined);
      setSwitching(true);
      try {
        await queryClient.cancelQueries({ queryKey: ["todos"] });
        const result = await authClient.organization.setActive({ organizationId });
        if (result.error) {
          setError("无法切换工作区，请重试。");
          return false;
        }
        try {
          await session.refetch();
        } catch {
          setError("工作区已切换，但登录状态同步失败，请重试。");
        }
        await queryClient.removeQueries({ queryKey: ["todos"] });
        await router.invalidate();
        return true;
      } catch {
        setError("无法切换工作区，请重试。");
        return false;
      } finally {
        setSwitching(false);
      }
    },
    [queryClient, router, session],
  );

  return { activate, switching, error, clearError: () => setError(undefined) };
}
