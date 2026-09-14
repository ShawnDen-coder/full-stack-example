import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ThemeSelect } from "../../../app/theme-provider.js";
import { Alert } from "../../../components/ui/alert.js";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Skeleton } from "../../../components/ui/skeleton.js";
import { resolveApiBaseUrl } from "../../../lib/api-base-url.js";
import { authClient } from "../../auth/client.js";
import { getHealth } from "../api.js";

export function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const session = authClient.useSession();
  const isPlatformAdmin =
    (session.data?.user as { readonly role?: string } | undefined)?.role === "platform-admin";
  const jobsBoardUrl = `${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, globalThis.location.origin)}/admin/queues`;
  const primaryAction = session.data ? (
    <Link className={buttonVariants()} to="/todos">
      打开 Todo
    </Link>
  ) : (
    <Link className={buttonVariants()} to="/register" search={{ returnTo: "/todos" }}>
      注册
    </Link>
  );

  return (
    <main className="relative min-h-screen bg-background px-4 pb-8 pt-20 text-foreground sm:px-10 sm:pt-24">
      <ThemeSelect className="absolute right-4 top-4 sm:right-10 sm:top-6" />
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="text-3xl">Full Stack Example</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {health.isLoading ? (
            <div aria-label="正在检查服务" className="grid gap-2" role="status">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
          ) : null}
          {health.isError ? (
            <Alert className="border-destructive/40 text-destructive" role="alert">
              无法连接 API，请稍后重试。
            </Alert>
          ) : null}
          {health.data ? (
            <Alert
              className={
                health.data.status === "ok"
                  ? "border-primary/30 bg-accent text-accent-foreground"
                  : "border-destructive/40 text-destructive"
              }
              role="status"
            >
              <span>API：{health.data.status}</span>
              <span>PostgreSQL：{health.data.services.database.status}</span>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!session.data ? (
              <Link
                className={buttonVariants({ variant: "ghost" })}
                to="/login"
                search={{ returnTo: "/todos" }}
              >
                登录
              </Link>
            ) : null}
            <Button onClick={() => void health.refetch()} type="button" variant="ghost">
              重新检查
            </Button>
            {primaryAction}
            {isPlatformAdmin ? (
              <a className={buttonVariants({ variant: "ghost" })} href={jobsBoardUrl}>
                任务管理
              </a>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
