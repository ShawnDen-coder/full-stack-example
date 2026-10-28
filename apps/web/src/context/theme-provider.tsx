import { useTheme as useNextTheme } from "next-themes";
export function useTheme() {
	const { theme, setTheme, resolvedTheme } = useNextTheme();
	return {
		theme: theme ?? "dark",
		setTheme,
		resolvedTheme: resolvedTheme ?? "dark",
		defaultTheme: "dark",
		resetTheme: () => setTheme("dark"),
	};
}
