import { createFileRoute } from "@tanstack/react-router";
import { AppearanceScreen } from "@/features/settings/appearance-screen";

export const Route = createFileRoute("/_auth/settings/appearance")({
	staticData: { breadcrumb: "appearance" },
	component: AppearanceScreen,
});
