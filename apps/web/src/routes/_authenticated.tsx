import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthenticatedLayout } from "../app/authenticated-layout.js";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.session) throw redirect({ to: "/login", search: { returnTo: location.href } });
  },
  component: AuthenticatedLayout,
});
