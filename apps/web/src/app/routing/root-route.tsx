import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { QueryClient } from "@tanstack/react-query";
import type { ErrorComponentProps, NotFoundRouteProps } from "@tanstack/react-router";
import { createRootRouteWithContext, Link, Outlet, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AppSession } from "../../features/auth/client.js";

export type RouterContext = {
  readonly session: AppSession | null;
  readonly queryClient: QueryClient;
};

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

export function RoutePending() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <Typography color="text.secondary">正在加载页面</Typography>
    </main>
  );
}

export function RouteNotFound(_props: NotFoundRouteProps) {
  return (
    <RouteFeedback
      title="页面不存在"
      description="你访问的页面不存在，或者已经被移动。"
      action={
        <Button component={Link} to="/" startIcon={<ArrowBackIcon />}>
          返回首页
        </Button>
      }
    />
  );
}

export function RouteError({ reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <RouteFeedback
      title="页面加载失败"
      description="页面暂时无法加载，请重试；如果问题持续存在，请稍后再试。"
      action={
        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            重试
          </Button>
          <Button component={Link} to="/" variant="outlined">
            返回首页
          </Button>
        </Stack>
      }
    />
  );
}

function RouteFeedback({
  title,
  description,
  action,
}: {
  readonly title: string;
  readonly description: string;
  readonly action: ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <Paper elevation={0} sx={{ maxWidth: "28rem", p: "2rem", textAlign: "center" }}>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: "0.75rem" }}>
          {description}
        </Typography>
        <Stack direction="row" sx={{ mt: "1.5rem", justifyContent: "center" }}>
          {action}
        </Stack>
      </Paper>
    </main>
  );
}
