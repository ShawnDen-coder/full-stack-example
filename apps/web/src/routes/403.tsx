import { createFileRoute } from "@tanstack/react-router";
import { ForbiddenError } from "@/features/errors/forbidden";

export const Route = createFileRoute("/403")({
	component: ForbiddenError,
});
