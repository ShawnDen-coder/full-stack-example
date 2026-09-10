import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.session) throw redirect({ to: "/login", search: { returnTo: location.href } });
  },
  component: () => <Outlet />,
});
