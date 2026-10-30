import { format } from "date-fns";

export function formatTime(value: number | null | undefined) {
	if (!value) return "—";
	return format(value, "yyyy-MM-dd HH:mm:ss");
}

export function formatCompactTime(value: number | null | undefined) {
	if (!value) return "—";
	return format(value, "MMM d, HH:mm");
}

export function shortId(value: string) {
	return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export function formatInterval(value: number) {
	const unit =
		value % 3_600_000 === 0
			? "hour"
			: value % 60_000 === 0
				? "minute"
				: value % 1000 === 0
					? "second"
					: "ms";
	const amount =
		value /
		(unit === "hour"
			? 3_600_000
			: unit === "minute"
				? 60_000
				: unit === "second"
					? 1000
					: 1);
	return `Every ${amount.toLocaleString()} ${unit}${unit !== "ms" && amount !== 1 ? "s" : ""}`;
}

export function failureSummary(reason: string | null | undefined) {
	if (!reason) return "—";
	try {
		const parsed: unknown = JSON.parse(reason);
		if (typeof parsed === "string") return parsed.split("\n")[0];
		if (parsed && typeof parsed === "object") {
			for (const key of ["message", "reason", "error"]) {
				const value = Reflect.get(parsed, key);
				if (typeof value === "string") return value.split("\n")[0];
			}
		}
		return "Structured error · Open job for details";
	} catch {
		return reason.split("\n")[0];
	}
}
