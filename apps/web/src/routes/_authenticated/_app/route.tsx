import { createFileRoute } from "@tanstack/react-router";
import { AuthenticatedLayout } from "../../../components/shared/authenticated-layout.js";

export const Route = createFileRoute("/_authenticated/_app")({
  component: AuthenticatedLayout,
});
