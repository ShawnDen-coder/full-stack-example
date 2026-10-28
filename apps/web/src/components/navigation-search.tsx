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
import { ListTodo, Palette, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
export function NavigationSearch() {
	const [open, setOpen] = useState(false);
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
	const items = [
		{ title: "Tasks", to: "/tasks", icon: ListTodo },
		{ title: "Profile", to: "/settings", icon: UserRound },
		{ title: "Appearance", to: "/settings/appearance", icon: Palette },
	] as const;
	return (
		<>
			<Button
				variant="outline"
				className="w-48 justify-start text-muted-foreground"
				onClick={() => setOpen(true)}
			>
				<Icon icon={Search} />
				Search pages<span className="ms-auto text-xs">⌘ K</span>
			</Button>
			<CommandDialog
				open={open}
				onOpenChange={setOpen}
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
