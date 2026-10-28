export function safeReturnTo(value: unknown) {
	if (
		typeof value !== "string" ||
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\")
	)
		return "/tasks";
	const url = new URL(value, "https://local.invalid");
	if (
		url.origin !== "https://local.invalid" ||
		[
			"/login",
			"/register",
			"/sign-in",
			"/sign-in-2",
			"/sign-up",
			"/forgot-password",
			"/otp",
		].includes(url.pathname.replace(/\/+$/, ""))
	)
		return "/tasks";
	return `${url.pathname}${url.search}${url.hash}`;
}
