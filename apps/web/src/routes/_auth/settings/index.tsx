import { Button } from "@full-stack-example/ui/components/button";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { focusFirstInvalidAuthFormControl } from "@/components/auth/auth-form";
import { ContentSection } from "@/features/settings/content-section";
import { authClient } from "@/lib/auth-client";
export const Route = createFileRoute("/_auth/settings/")({
	component: Profile,
});
function Profile() {
	const { data: session } = authClient.useSession();
	const [error, setError] = useState("");
	const form = useForm({
		defaultValues: { name: session?.user.name ?? "" },
		validators: {
			onSubmit: z.object({
				name: z
					.string()
					.trim()
					.min(2, "Use at least 2 characters.")
					.max(100, "Use 100 characters or fewer."),
			}),
		},
		onSubmit: async ({ value }) => {
			setError("");
			try {
				const result = await authClient.updateUser({ name: value.name.trim() });
				if (result.error)
					throw new Error(
						result.error.message ?? "Unable to save your profile.",
					);
				await authClient.getSession({ query: { disableCookieCache: true } });
				toast.success("Profile updated");
			} catch {
				setError(
					"Unable to save your profile. Your changes are still here. Try again.",
				);
			}
		},
	});
	return (
		<ContentSection
			title="Profile"
			description="Update the name displayed in your account."
		>
			<form
				className="space-y-8"
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					if (!form.state.isSubmitting) {
						const element = e.currentTarget;
						void form.handleSubmit().then(() => {
							if (!form.state.isValid)
								focusFirstInvalidAuthFormControl(element);
						});
					}
				}}
			>
				<form.Field name="name">
					{(field) => (
						<div className="space-y-2">
							<Label htmlFor="profile-name">Name</Label>
							<Input
								id="profile-name"
								autoComplete="name"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0}
								aria-describedby="profile-name-help"
							/>
							<p
								id="profile-name-help"
								className={
									field.state.meta.errors.length
										? "text-destructive text-sm"
										: "text-muted-foreground text-sm"
								}
							>
								{field.state.meta.errors.length
									? field.state.meta.errors.map((e) => e?.message).join(" ")
									: "This is the name shown in your workspace."}
							</p>
						</div>
					)}
				</form.Field>
				<div className="space-y-2">
					<Label htmlFor="profile-email">Email</Label>
					<Input
						id="profile-email"
						value={session?.user.email ?? ""}
						readOnly
						aria-describedby="profile-email-help"
					/>
					<p id="profile-email-help" className="text-muted-foreground text-sm">
						Your sign-in email. Email changes are currently unavailable.
					</p>
				</div>
				{error && (
					<p role="alert" className="text-destructive text-sm">
						{error}
					</p>
				)}
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(pending) => (
						<Button type="submit" disabled={pending} aria-busy={pending}>
							{pending ? "Saving…" : "Update profile"}
						</Button>
					)}
				</form.Subscribe>
			</form>
		</ContentSection>
	);
}
