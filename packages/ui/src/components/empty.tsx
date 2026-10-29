import { cn } from "@full-stack-example/ui/lib/utils";
import type { ComponentProps } from "react";
export function Empty({ className, ...props }: ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex flex-col gap-2 rounded-md border p-4 text-sm",
				className,
			)}
			{...props}
		/>
	);
}
export function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
	return (
		<p
			data-slot="empty-description"
			className={cn("text-muted-foreground", className)}
			{...props}
		/>
	);
}
