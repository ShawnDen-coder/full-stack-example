import { createFileRoute } from "@tanstack/react-router";
import { AdminUsers } from "@/features/access/admin-users";
export const Route = createFileRoute("/_auth/admin/users")({
	component: AdminUsers,
});
