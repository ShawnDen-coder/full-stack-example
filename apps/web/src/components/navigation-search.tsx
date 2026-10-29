import { Button } from "@full-stack-example/ui/components/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@full-stack-example/ui/components/command";
import { Icon } from "@full-stack-example/ui/components/icon";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAccess, visibleNavigation } from "@/lib/access";
export function NavigationSearch() {
	const access = useAccess();
	const [open, setOpen] = useState(false);
	const trigger = useRef<HTMLButtonElement>(null);
	const navigate = useNavigate();
	useEffect(() => {
		const listener = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen((v) => !v);
			}
		};
		document.addEventListener("keydown", listener);
		return () => document.removeEventListener("keydown", listener);
	}, []);
	const items = (access.data ? visibleNavigation(access.data) : []).flatMap(
		(group) =>
			group.items.map((item) => ({
				title: item.title,
				to: item.url,
				icon: item.icon,
			})),
	);
	return (
		<>
			<Button
				ref={trigger}
				variant="outline"
				className="w-10 justify-center px-0 text-muted-foreground sm:w-48 sm:justify-start sm:px-3"
				aria-label="Search pages"
				onClick={() => setOpen(true)}
			>
				<Icon icon={Search} />
				<span className="hidden sm:inline">Search pages</span>
				<span className="ms-auto hidden text-xs sm:inline">⌘ K</span>
			</Button>
			<CommandDialog
				open={open}
				onOpenChange={setOpen}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					trigger.current?.focus();
				}}
				commandLabel="Search pages"
				title="Navigate"
				description="Find a page in FullStack."
			>
				<CommandInput placeholder="Search pages…" />
				<CommandList>
					<CommandEmpty>No pages found.</CommandEmpty>
					<CommandGroup heading="Pages">
						{items.map((item) => (
							<CommandItem
								key={item.to}
								onSelect={() => {
									setOpen(false);
									void navigate({ to: item.to });
								}}
							>
								<Icon icon={item.icon} />
								{item.title}
							</CommandItem>
						))}
					</CommandGroup>
				</CommandList>
			</CommandDialog>
		</>
	);
}
