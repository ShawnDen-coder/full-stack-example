import { createFileRoute } from "@tanstack/react-router";
import { MaintenanceError } from "@/features/errors/maintenance-error";

export const Route = createFileRoute("/503")({
	component: MaintenanceError,
});
