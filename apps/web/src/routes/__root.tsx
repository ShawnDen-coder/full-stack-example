import { Button } from "@full-stack-example/ui/components/button";
import { Toaster } from "@full-stack-example/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { SessionBoundary } from "@/components/session-boundary";
import { ThemeProvider } from "@/components/theme-provider";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	errorComponent: ({ reset }) => (
		<main
			id="content"
			tabIndex={-1}
			className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center"
		>
			<h1 className="font-bold text-3xl tracking-tight">
				Something went wrong
			</h1>
			<p>Please try again.</p>
			<Button type="button" onClick={reset}>
				Retry
			</Button>
		</main>
	),
	notFoundComponent: () => (
		<main
			id="content"
			tabIndex={-1}
			className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center"
		>
			<h1 className="font-bold text-3xl tracking-tight">Page not found</h1>
			<Button asChild>
				<Link to="/">Go home</Link>
			</Button>
		</main>
	),
	head: () => ({
		meta: [
			{
				title: "FullStack",
			},
			{
				name: "description",
				content: "Your personal workspace.",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.svg",
			},
		],
	}),
});

function RootComponent() {
	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="light"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				{/* biome-ignore lint/a11y/useValidAnchor: A skip link retains its section destination while moving focus without a router reload. */}
				<a
					href="#content"
					onClick={(event) => {
						const content = document.getElementById("content");
						if (content) {
							event.preventDefault();
							content.focus();
							content.scrollIntoView();
						}
					}}
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-background focus:p-3 focus:text-foreground focus:outline focus:outline-ring"
				>
					Skip to main content
				</a>
				<SessionBoundary>
					<Outlet />
				</SessionBoundary>
				<Toaster richColors />
			</ThemeProvider>
			{import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
			{import.meta.env.DEV && (
				<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
			)}
		</>
	);
}

declare module "@tanstack/react-router" {
	interface StaticDataRouteOption {
		layout?: "fixed" | "fluid";
		breadcrumb?: import("@/lib/breadcrumbs").BreadcrumbKey;
	}
}
