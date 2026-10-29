import { createFileRoute } from "@tanstack/react-router";
import { Chats } from "@/features/chats";
export const Route = createFileRoute("/_auth/chats")({
	staticData: { layout: "fixed" },
	component: Chats,
});
