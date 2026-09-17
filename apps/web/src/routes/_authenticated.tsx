import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    // 路由守卫只负责 UX，API 仍由服务端会话校验保护。
    if (!context.session) throw redirect({ to: "/login", search: { returnTo: location.href } });
  },
  component: () => <Outlet />,
});
