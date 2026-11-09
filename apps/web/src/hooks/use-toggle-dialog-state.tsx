import { useState } from "react";

/**
 * Custom hook for confirm dialog
 * @param initialState string | null
 * @returns A stateful value, and a function to update it.
 * @example const [open, toggleDialog] = useToggleDialogState<"approve" | "reject">()
 */
export default function useToggleDialogState<T extends string | boolean>(
	initialState: T | null = null,
) {
	const [open, setState] = useState<T | null>(initialState);

	const toggleDialog = (str: T | null) =>
		setState((prev) => (prev === str ? null : str));

	return [open, toggleDialog] as const;
}
