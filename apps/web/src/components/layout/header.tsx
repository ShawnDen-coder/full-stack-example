import { Separator } from "@full-stack-example/ui/components/separator";
import { SidebarTrigger } from "@full-stack-example/ui/components/sidebar";
import { cn } from "@full-stack-example/ui/lib/utils";

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
	ref?: React.Ref<HTMLElement>;
};

export function Header({ className, children, ...props }: HeaderProps) {
	return (
		<header
			className={cn(
				"sticky top-0 z-50 h-16 shrink-0 rounded-t-[inherit] border-b bg-background",
				className,
			)}
			{...props}
		>
			<div className="flex h-full items-center gap-3 ps-4 pe-7">
				<SidebarTrigger
					variant="ghost"
					className="relative -m-2 size-11 rounded-md border-0 p-2 before:absolute before:size-7 before:rounded-md before:border before:border-border md:m-0 md:size-7 md:p-0 [&>svg]:relative [&>svg]:z-10"
				/>
				<Separator orientation="vertical" className="h-6" />
				{children}
			</div>
		</header>
	);
}
