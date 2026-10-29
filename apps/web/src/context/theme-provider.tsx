import { useTheme as useNextTheme } from "next-themes";
export function useTheme() {
	const { theme, setTheme, resolvedTheme } = useNextTheme();
	return {
		theme: theme ?? "light",
		setTheme,
		resolvedTheme: resolvedTheme ?? "light",
		defaultTheme: "light",
		resetTheme: () => setTheme("light"),
	};
}
