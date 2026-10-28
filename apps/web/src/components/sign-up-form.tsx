import { Button } from "@full-stack-example/ui/components/button";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/lib/auth-client";
import { clearSessionData } from "@/utils/orpc";

import Loader from "./loader";

export default function SignUpForm({
	onSwitchToSignIn,
	returnTo,
}: {
	onSwitchToSignIn: () => void;
	returnTo: string;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					name: value.name,
				},
				{
					onSuccess: () => {
						clearSessionData();
						navigate({
							to: returnTo,
						});
						toast.success("Sign up successful");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto mt-10 w-full max-w-md p-6">
			<h1 className="mb-6 text-center font-bold text-3xl">Create Account</h1>

			<form
				noValidate
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					const element = e.currentTarget;
					void form.handleSubmit().then(() => {
						element
							.querySelector<HTMLInputElement>('[aria-invalid="true"]')
							?.focus();
					});
				}}
				className="space-y-4"
			>
				<div>
					<form.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Name</Label>
								<Input
									id={field.name}
									name={field.name}
									aria-invalid={field.state.meta.errors.length > 0}
									aria-describedby={
										field.state.meta.errors.length > 0
											? `${field.name}-errors`
											: undefined
									}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.length > 0 && (
									<div id={`${field.name}-errors`} role="alert">
										{field.state.meta.errors.map((error) => (
											<p
												key={error?.message}
												className="text-destructive text-sm"
											>
												{error?.message}
											</p>
										))}
									</div>
								)}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="email">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Email</Label>
								<Input
									id={field.name}
									name={field.name}
									aria-invalid={field.state.meta.errors.length > 0}
									aria-describedby={
										field.state.meta.errors.length > 0
											? `${field.name}-errors`
											: undefined
									}
									type="email"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.length > 0 && (
									<div id={`${field.name}-errors`} role="alert">
										{field.state.meta.errors.map((error) => (
											<p
												key={error?.message}
												className="text-destructive text-sm"
											>
												{error?.message}
											</p>
										))}
									</div>
								)}
							</div>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<div className="space-y-2">
								<Label htmlFor={field.name}>Password</Label>
								<Input
									id={field.name}
									name={field.name}
									aria-invalid={field.state.meta.errors.length > 0}
									aria-describedby={
										field.state.meta.errors.length > 0
											? `${field.name}-errors`
											: undefined
									}
									type="password"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.length > 0 && (
									<div id={`${field.name}-errors`} role="alert">
										{field.state.meta.errors.map((error) => (
											<p
												key={error?.message}
												className="text-destructive text-sm"
											>
												{error?.message}
											</p>
										))}
									</div>
								)}
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							type="submit"
							className="w-full"
							disabled={!canSubmit || isSubmitting}
						>
							{isSubmitting ? "Submitting..." : "Sign Up"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Button variant="link" onClick={onSwitchToSignIn}>
					Already have an account? Sign In
				</Button>
			</div>
		</div>
	);
}
