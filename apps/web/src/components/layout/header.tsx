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
			<div className="flex h-full items-center gap-3 px-4">
				<SidebarTrigger variant="outline" />
				<Separator orientation="vertical" className="h-6" />
				{children}
			</div>
		</header>
	);
}
