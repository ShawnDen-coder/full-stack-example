import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@full-stack-example/ui/components/card";
import { Link } from "@tanstack/react-router";
import { AuthLayout } from "../auth-layout";
import { ForgotPasswordForm } from "./components/forgot-password-form";

export function ForgotPassword() {
	return (
		<AuthLayout>
			<Card className="max-w-sm gap-4 sm:min-w-sm">
				<CardHeader>
					<CardTitle className="text-lg tracking-tight">
						Forgot Password
					</CardTitle>
					<CardDescription>
						Enter your registered email and <br /> we will send you a link to
						reset your password.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<ForgotPasswordForm />
				</CardContent>
				<CardFooter>
					<p className="mx-auto text-balance px-8 text-center text-muted-foreground text-sm">
						Don't have an account?{" "}
						<Link
							to="/sign-up"
							search={{ redirect: "/tasks" }}
							className="underline underline-offset-4 hover:text-primary"
						>
							Sign up
						</Link>
						.
					</p>
				</CardFooter>
			</Card>
		</AuthLayout>
	);
}
