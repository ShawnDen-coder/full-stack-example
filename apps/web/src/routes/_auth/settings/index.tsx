import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/features/settings/profile-screen";

export const Route = createFileRoute("/_auth/settings/")({
	staticData: { breadcrumb: "profile" },
	component: ProfileScreen,
});
