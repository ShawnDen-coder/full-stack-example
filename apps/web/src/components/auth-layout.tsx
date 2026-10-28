import type { ReactNode } from "react";
import { Logo } from "@/assets/logo";
import { ModeToggle } from "./mode-toggle";
export function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<main
			id="content"
			tabIndex={-1}
			className="grid min-h-svh items-center justify-center px-6 py-12"
		>
			<div className="absolute end-6 top-6">
				<ModeToggle />
			</div>
			<div className="w-96 max-w-full space-y-6">
				<div className="flex items-center justify-center gap-2">
					<Logo />
					<span className="font-medium text-xl">FullStack</span>
				</div>
				<div className="w-full rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
					{children}
				</div>
			</div>
		</main>
	);
}
