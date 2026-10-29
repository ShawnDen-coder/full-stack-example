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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@full-stack-example/ui/components/tooltip";
import { useLocation, useRouter } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccess, visibleNavigation } from "@/lib/access";
import { useWorkspaceId } from "@/lib/workspace";

export function NavigationSearch() {
	const access = useAccess();
	const workspace = useWorkspaceId();
	const location = useLocation();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState("");
	const trigger = useRef<HTMLButtonElement>(null);
	const origin = useRef<HTMLElement | null>(null);
	const token = useRef(0);
	const destination = useRef<string | null>(null);
	const focusMain = useRef(false);
	const currentWorkspace = useRef(workspace);
	const currentLocation = useRef(location.href);
	if (
		currentWorkspace.current !== workspace ||
		(currentLocation.current !== location.href &&
			destination.current !== location.pathname)
	) {
		token.current++;
		destination.current = null;
		currentWorkspace.current = workspace;
	}
	currentLocation.current = location.href;
	const openSearch = useCallback(() => {
		origin.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		token.current++;
		focusMain.current = false;
		setPending(false);
		setError("");
		setOpen(true);
	}, []);
	useEffect(
		() => () => {
			token.current++;
		},
		[],
	);
	useEffect(() => {
		const listener = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				if (open) {
					token.current++;
					setOpen(false);
				} else openSearch();
			}
		};
		document.addEventListener("keydown", listener);
		return () => document.removeEventListener("keydown", listener);
	}, [open, openSearch]);
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
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						ref={trigger}
						variant="ghost"
						className="size-11 shrink-0"
						aria-label="Search pages"
						onClick={openSearch}
					>
						<Icon icon={Search} />
					</Button>
				</TooltipTrigger>
				<TooltipContent>Search pages (⌘ K / Ctrl K)</TooltipContent>
			</Tooltip>
			<CommandDialog
				open={open}
				onOpenChange={(value) => {
					if (!value) {
						token.current++;
						destination.current = null;
						setPending(false);
					}
					setOpen(value);
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (focusMain.current) {
						focusMain.current = false;
						const operation = token.current;
						requestAnimationFrame(() => {
							if (operation === token.current)
								document.getElementById("content")?.focus();
						});
					} else if (origin.current?.isConnected) origin.current.focus();
					else trigger.current?.focus();
				}}
				commandLabel="Search pages"
				title="Navigate"
				description="Find a page in FullStack."
			>
				<CommandInput placeholder="Search pages…" />
				{error && (
					<p role="alert" className="px-4 py-2 text-destructive text-sm">
						{error}
					</p>
				)}
				<CommandList>
					<CommandEmpty>No pages found.</CommandEmpty>
					<CommandGroup heading="Pages">
						{items.map((item) => (
							<CommandItem
								key={item.to}
								disabled={pending}
								onSelect={async () => {
									if (pending) return;
									const operation = ++token.current;
									destination.current = item.to;
									setPending(true);
									setError("");
									try {
										await router.navigate({
											to: item.to,
											search: { workspace },
										});
										if (operation !== token.current) return;
										if (
											router.state.resolvedLocation?.pathname !== item.to ||
											router.state.matches.some(
												(match) => match.status === "error",
											)
										)
											throw new Error(
												"Navigation did not reach the selected page.",
											);
										destination.current = null;
										focusMain.current = true;
										setOpen(false);
									} catch {
										if (operation === token.current) {
											destination.current = null;
											setError("Unable to open that page. Please try again.");
										}
									} finally {
										if (operation === token.current) setPending(false);
									}
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
