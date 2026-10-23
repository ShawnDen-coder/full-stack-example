export function safeReturnTo(value: unknown) {
	if (
		typeof value !== "string" ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\")
	)
		return "/dashboard";
	const url = new URL(value, "https://local.invalid");
	if (url.origin !== "https://local.invalid" || url.pathname === "/login")
		return "/dashboard";
	return `${url.pathname}${url.search}${url.hash}`;
}
