import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ to: "/", label: "Home" },
		{ to: "/dashboard", label: "Dashboard" },
		{ to: "/todos", label: "Todos" },
	] as const;

	return (
		<header>
			<a
				href="#content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:p-3 focus:text-foreground focus:outline focus:outline-ring"
			>
				Skip to main content
			</a>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<nav aria-label="Main navigation" className="flex gap-4 text-lg">
					{links.map(({ to, label }) => {
						return (
							<Link
								key={to}
								to={to}
								activeOptions={{ exact: true }}
								activeProps={{
									className: "font-semibold underline underline-offset-4",
									"aria-current": "page",
								}}
							>
								{label}
							</Link>
						);
					})}
				</nav>
				<div className="flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
			<hr />
		</header>
	);
}
