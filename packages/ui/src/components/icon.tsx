import { cn } from "@full-stack-example/ui/lib/utils";
import type { LucideIcon, LucideProps } from "lucide-react";

const iconSizes = {
	indicator: "size-3",
	default: "size-4",
	toolbar: "size-4.5",
	logo: "size-5.5",
	status: "size-6",
} as const;

type IconProps = Omit<
	LucideProps,
	| "size"
	| "strokeWidth"
	| "strokeLinecap"
	| "strokeLinejoin"
	| "absoluteStrokeWidth"
	| "nonScalingStroke"
> & {
	icon: LucideIcon;
	size?: keyof typeof iconSizes;
};

function Icon({
	icon: Glyph,
	size = "default",
	className,
	...props
}: IconProps) {
	const labelled = Boolean(props["aria-label"] || props["aria-labelledby"]);
	return (
		<Glyph
			aria-hidden={labelled ? undefined : true}
			focusable="false"
			{...props}
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			nonScalingStroke={false}
			className={cn("shrink-0", iconSizes[size], className)}
		/>
	);
}

export { Icon, type IconProps };
