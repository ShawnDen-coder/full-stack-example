import { cn } from "@full-stack-example/ui/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "@/components/theme-provider";
import { ContentSection } from "@/features/settings/content-section";
export const Route = createFileRoute("/_auth/settings/appearance")({
	staticData: { breadcrumb: "appearance" },
	component: Appearance,
});
function Appearance() {
	const { theme, setTheme } = useTheme();
	return (
		<ContentSection
			title="Appearance"
			description="Customize the appearance of your workspace."
		>
			<fieldset>
				<legend className="font-medium text-sm">Theme</legend>
				<p className="mt-2 text-muted-foreground text-sm">
					Choose a theme, or follow your device settings. Changes apply
					immediately.
				</p>
				<div className="mt-4 grid grid-cols-3 gap-4">
					{(["light", "dark", "system"] as const).map((option) => (
						<label key={option} className="cursor-pointer">
							<input
								className="peer sr-only"
								type="radio"
								name="theme"
								value={option}
								checked={theme === option}
								onChange={() => setTheme(option)}
							/>
							<div
								className={cn(
									"overflow-hidden rounded-lg border-2 p-1 peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-4",
									theme === option ? "border-primary" : "border-muted",
								)}
							>
								<div
									aria-hidden="true"
									className={cn(
										"flex h-28 gap-2 rounded-md border p-2",
										option === "dark"
											? "border-slate-700 bg-slate-950"
											: option === "system"
												? "border-slate-300 bg-slate-200"
												: "border-slate-200 bg-white",
									)}
								>
									<div
										className={cn(
											"w-1/4 rounded-sm",
											option === "dark" ? "bg-slate-800" : "bg-slate-300",
										)}
									/>
									<div className="flex-1 space-y-2 pt-2">
										{[0, 1, 2].map((i) => (
											<div
												key={i}
												className={cn(
													"h-3 rounded-sm",
													option === "dark" || (option === "system" && i > 0)
														? "bg-slate-700"
														: "bg-slate-200",
													i === 0 && "w-2/3",
												)}
											/>
										))}
									</div>
								</div>
							</div>
							<span className="mt-2 block text-center font-medium text-sm capitalize">
								{option.charAt(0).toUpperCase() + option.slice(1)}
							</span>
						</label>
					))}
				</div>
			</fieldset>
		</ContentSection>
	);
}
