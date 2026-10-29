import { cn } from "@full-stack-example/ui/lib/utils";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { ComponentProps } from "react";
export function ToggleGroup({
	className,
	...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
	return (
		<ToggleGroupPrimitive.Root
			data-slot="toggle-group"
			className={cn("flex items-center gap-1", className)}
			{...props}
		/>
	);
}
export function ToggleGroupItem({
	className,
	...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
	return (
		<ToggleGroupPrimitive.Item
			data-slot="toggle-group-item"
			className={cn(
				"inline-flex min-h-11 shrink-0 items-center justify-center rounded-md px-3 font-medium text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-inset data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground motion-safe:transition-colors motion-safe:duration-150",
				className,
			)}
			{...props}
		/>
	);
}
