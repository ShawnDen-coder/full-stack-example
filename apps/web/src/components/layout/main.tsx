import { cn } from "@full-stack-example/ui/lib/utils";

type MainProps = React.HTMLAttributes<HTMLElement> & {
	fixed?: boolean;
	fluid?: boolean;
	ref?: React.Ref<HTMLElement>;
};

export function Main({ fixed, className, fluid, ...props }: MainProps) {
	return (
		<main
			data-layout={fixed ? "fixed" : "auto"}
			className={cn(
				"w-full px-4 py-6 md:px-6",

				// If layout is fixed, make the main container flex and grow
				fixed && "flex min-h-0 grow flex-col",

				// If layout is not fluid, set the max-width
				!fluid && "mx-auto max-w-[1280px]",
				className,
			)}
			{...props}
		/>
	);
}
