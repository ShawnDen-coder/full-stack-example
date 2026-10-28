import { useRouter } from "@tanstack/react-router";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
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
	const recovery = useRef(false);
	const [recovering, setRecovering] = useState(false);
	const { data: session, isPending } = authClient.useSession();
	const userId = session?.user.id ?? null;
	const [settledIdentity, setSettledIdentity] = useState<
		string | null | undefined
	>(undefined);
	useLayoutEffect(() => {
		setUnauthorizedHandler(() => {
			if (recovery.current) return;
			recovery.current = true;
			setRecovering(true);
			const returnTo = safeReturnTo(
				window.location.pathname + window.location.search,
			);
			clearSessionData();
			void (async () => {
				try {
					// Finish refreshing the auth store before the sign-in route checks it.
					await authClient.getSession({ query: { disableCookieCache: true } });
				} finally {
					try {
						await router.navigate({
							to: "/sign-in",
							search: { redirect: returnTo },
						});
					} finally {
						recovery.current = false;
						setRecovering(false);
					}
				}
			})();
		});
		return () => setUnauthorizedHandler(() => {});
	}, [router]);
	useLayoutEffect(() => {
		if (recovering || isPending || settledIdentity === userId) return;
		synchronizeIdentity(userId);
		let active = true;
		void router.invalidate().then(() => {
			if (active) setSettledIdentity(userId);
		});
		return () => {
			active = false;
		};
	}, [recovering, isPending, userId, settledIdentity, router]);
	if (recovering || isPending || settledIdentity !== userId) return <Loader />;
	return children;
}
