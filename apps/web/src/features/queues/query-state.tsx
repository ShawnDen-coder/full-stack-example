import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@full-stack-example/ui/components/alert";
import { Button } from "@full-stack-example/ui/components/button";
import { Skeleton } from "@full-stack-example/ui/components/skeleton";

export function isRpcCode(error: unknown, code: string) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === code
	);
}

export function QueueQueryState({
	isPending,
	error,
	onRetry,
	hasData = false,
	retryBusy = false,
	retryLabel = "Retry",
}: {
	isPending: boolean;
	error: unknown;
	onRetry: () => void;
	hasData?: boolean;
	retryBusy?: boolean;
	retryLabel?: string;
}) {
	if (isPending) {
		return (
			<div role="status">
				<Skeleton className="h-32 w-full" />
				<span className="sr-only">Loading queue data</span>
			</div>
		);
	}
	if (!error) return null;
	const invalid = isRpcCode(error, "BAD_REQUEST");
	const forbidden =
		isRpcCode(error, "FORBIDDEN") || isRpcCode(error, "UNAUTHORIZED");
	const missing = isRpcCode(error, "NOT_FOUND");
	return (
		<Alert variant={missing ? "default" : "destructive"}>
			<AlertTitle>
				{missing
					? "Not found"
					: invalid
						? "Invalid parameters"
						: forbidden
							? "Access denied"
							: "Queue data is unavailable"}
			</AlertTitle>
			<AlertDescription>
				{missing
					? "That queue or job is not registered, or BullMQ has already removed it."
					: invalid
						? "The request parameters are invalid or the page is out of range."
						: forbidden
							? "You do not have permission to view this queue."
							: "The queue service did not respond."}
				{hasData && " The results below are from the last successful request."}
				<Button
					variant="outline"
					className="mt-3 min-h-11 sm:min-h-9"
					onClick={onRetry}
					disabled={retryBusy}
					aria-busy={retryBusy}
				>
					{retryLabel}
				</Button>
			</AlertDescription>
		</Alert>
	);
}
