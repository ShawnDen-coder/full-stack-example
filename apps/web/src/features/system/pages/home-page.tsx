import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { resolveApiBaseUrl } from "../../../lib/api-base-url.js";
import { authClient } from "../../auth/client.js";
import { Alert } from "../../../components/ui/alert.js";
import { Button, buttonVariants } from "../../../components/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { getHealth } from "../api.js";

export function HomePage() {
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });
  const session = authClient.useSession();
  const isPlatformAdmin =
    (session.data?.user as { readonly role?: string } | undefined)?.role === "platform-admin";
  const jobsBoardUrl = `${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, globalThis.location.origin)}/admin/queues`;
  const primaryAction = session.data ? (
    <Link className={buttonVariants()} to="/todos">打开 Todo</Link>
  ) : (
    <Link className={buttonVariants()} to="/register" search={{ returnTo: "/todos" }}>注册</Link>
  );

  return (
    <main className="min-h-screen bg-background p-4 text-foreground sm:p-10">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle className="text-3xl">Full Stack Example</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {health.isLoading ? (
            <span
              className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
              role="status"
              aria-label="正在检查服务"
            />
          ) : null}
          {health.isError ? (
            <Alert className="border-destructive/40 text-destructive" role="alert">
              无法连接 API，请稍后重试。
            </Alert>
          ) : null}
          {health.data ? (
            <Alert className={health.data.status === "ok" ? "border-primary/30 bg-accent text-accent-foreground" : "border-destructive/40 text-destructive"} role="status">
              <span>API：{health.data.status}</span>
              <span>PostgreSQL：{health.data.services.database.status}</span>
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!session.data ? (
              <Link className={buttonVariants({ variant: "ghost" })} to="/login" search={{ returnTo: "/todos" }}>
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
