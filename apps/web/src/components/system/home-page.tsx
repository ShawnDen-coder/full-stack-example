import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ThemeSelect } from "../../app/theme.js";
import { Alert } from "@mui/material";
import { Button } from "@mui/material";
import { Card, CardContent, CardHeader, Typography } from "@mui/material";
import { Skeleton } from "@mui/material";
import { resolveApiBaseUrl } from "../../lib/api-base-url.js";
import { authClient } from "../../features/auth/client.js";
import { getHealth } from "../../features/system/api.js";

export function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const session = authClient.useSession();
  const isPlatformAdmin =
    (session.data?.user as { readonly role?: string } | undefined)?.role === "platform-admin";
  const jobsBoardUrl = `${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, globalThis.location.origin)}/admin/queues`;
  const primaryAction = session.data ? (
    <Link to="/todos">
      <Button>打开 Todo</Button>
    </Link>
  ) : (
    <Link to="/register" search={{ returnTo: "/todos" }}>
      <Button>注册</Button>
    </Link>
  );

  return (
    <main className="relative min-h-screen px-4 pb-8 pt-20 sm:px-10 sm:pt-24">
      <ThemeSelect className="absolute right-4 top-4 sm:right-10 sm:top-6" />
      <Card className="mx-auto max-w-xl">
        <CardHeader title={<Typography variant="h4">Full Stack Example</Typography>} />
        <CardContent className="grid gap-5">
          {health.isLoading ? (
            <div aria-label="正在检查服务" className="grid gap-2" role="status">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : null}
          {health.isError ? (
            <Alert role="alert">
              无法连接 API，请稍后重试。
            </Alert>
          ) : null}
          {health.data ? (
            <Alert severity={health.data.status === "ok" ? "success" : "error"} role="status">
              <span>API：{health.data.status}</span>
              <span>PostgreSQL：{health.data.services.database.status}</span>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!session.data ? (
              <Link to="/login" search={{ returnTo: "/todos" }}>
                <Button variant="text">登录</Button>
              </Link>
            ) : null}
            <Button onClick={() => void health.refetch()} type="button" variant="text">
              重新检查
            </Button>
            {primaryAction}
            {isPlatformAdmin ? (
              <Button component="a" href={jobsBoardUrl} variant="text">
                任务管理
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}











