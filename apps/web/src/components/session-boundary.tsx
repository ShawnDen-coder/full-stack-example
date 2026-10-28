import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/return-to";
import {
	clearSessionData,
	setUnauthorizedHandler,
	synchronizeIdentity,
} from "@/utils/orpc";
import Loader from "./loader";

export function SessionBoundary({ children }: { children: ReactNode }) {
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const userId = session?.user.id ?? null;
	const [settledIdentity, setSettledIdentity] = useState<
		string | null | undefined
	>(undefined);
	useLayoutEffect(() => {
		setUnauthorizedHandler(() => {
			clearSessionData();
			void authClient.getSession({ query: { disableCookieCache: true } });
			void router.navigate({
				to: "/sign-in",
				search: {
					redirect: safeReturnTo(
						window.location.pathname + window.location.search,
					),
				},
			});
		});
		return () => setUnauthorizedHandler(() => {});
	}, [router]);
	useLayoutEffect(() => {
		if (isPending || settledIdentity === userId) return;
		synchronizeIdentity(userId);
		let active = true;
		void router.invalidate().then(() => {
			if (active) setSettledIdentity(userId);
		});
		return () => {
			active = false;
		};
	}, [isPending, userId, settledIdentity, router]);
	if (isPending || settledIdentity !== userId) return <Loader />;
	return children;
}
