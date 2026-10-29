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

function samePath(left: string | undefined, right: string | null): boolean {
	if (left == null || right == null) return false;
	const normalize = (path: string) =>
		path === "/" ? path : path.replace(/\/+$/, "");
	return normalize(left) === normalize(right);
}

export function NavigationSearch() {
	const access = useAccess();
	const workspace = useWorkspaceId();
	const location = useLocation();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const pendingRef = useRef(false);
	const [error, setError] = useState("");
	const trigger = useRef<HTMLButtonElement>(null);
	const origin = useRef<HTMLElement | null>(null);
	const token = useRef(0);
	const destination = useRef<string | null>(null);
	const focusMain = useRef(false);
	const skipFocus = useRef(false);
	const currentWorkspace = useRef(workspace);
	const currentLocation = useRef(location.href);
	const invalidated =
		currentWorkspace.current !== workspace ||
		(currentLocation.current !== location.href &&
			!samePath(location.pathname, destination.current));
	if (invalidated) {
		token.current++;
		destination.current = null;
		skipFocus.current = true;
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
		skipFocus.current = false;
		pendingRef.current = false;
		setPending(false);
		setError("");
		setOpen(true);
	}, []);
	useEffect(() => {
		if (invalidated) {
			pendingRef.current = false;
			setPending(false);
			setOpen(false);
		}
	}, [invalidated]);
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
						pendingRef.current = false;
						setPending(false);
					}
					setOpen(value);
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault();
					if (skipFocus.current) {
						skipFocus.current = false;
						return;
					}
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
									if (pendingRef.current) return;
									pendingRef.current = true;
									const operation = ++token.current;
									destination.current = item.to;
									setPending(true);
									setError("");
									try {
										const prepared = await router.preloadRoute({
											to: item.to,
											search: { workspace },
										});
										if (operation !== token.current) return;
										if (
											!prepared ||
											prepared.some((match) => match.status === "error") ||
											!samePath(prepared.at(-1)?.pathname, item.to)
										)
											throw new Error("Unable to prepare navigation.");
										await router.navigate({
											to: item.to,
											search: { workspace },
										});
										if (operation !== token.current) return;
										if (
											!samePath(
												router.state.resolvedLocation?.pathname,
												item.to,
											) ||
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
										if (operation === token.current) {
											pendingRef.current = false;
											setPending(false);
										}
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
