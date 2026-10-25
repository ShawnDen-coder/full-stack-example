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
import Header from "@/components/header";
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
		<main className="p-8">
			<h1>Something went wrong</h1>
			<p>Please try again.</p>
			<button type="button" onClick={reset}>
				Retry
			</button>
		</main>
	),
	notFoundComponent: () => (
		<main className="p-8">
			<h1>Page not found</h1>
			<Link to="/">Go home</Link>
		</main>
	),
	head: () => ({
		meta: [
			{
				title: "full-stack-example",
			},
			{
				name: "description",
				content: "full-stack-example is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
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
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<div className="grid h-svh grid-rows-[auto_1fr]">
					<SessionBoundary>
						<Header />
						<Outlet />
					</SessionBoundary>
				</div>
				<Toaster richColors />
			</ThemeProvider>
			<TanStackRouterDevtools position="bottom-left" />
			<ReactQueryDevtools position="bottom" buttonPosition="bottom-right" />
		</>
	);
}
