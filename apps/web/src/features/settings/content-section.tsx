import { Separator } from "@full-stack-example/ui/components/separator";
import type { ReactNode } from "react";
export function ContentSection({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<section>
			<h2 className="font-medium text-lg">{title}</h2>
			<p className="text-muted-foreground text-sm">{description}</p>
			<Separator className="my-4" />
			<div className="max-w-xl pb-12">{children}</div>
		</section>
	);
}
