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
import { OtpForm } from "./components/otp-form";

export function Otp() {
	return (
		<AuthLayout>
			<Card className="max-w-md gap-4">
				<CardHeader>
					<CardTitle className="text-base tracking-tight">
						Two-factor Authentication
					</CardTitle>
					<CardDescription>
						Preview the verification form. No authentication code has been sent.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<OtpForm />
				</CardContent>
				<CardFooter>
					<p className="px-8 text-center text-muted-foreground text-sm">
						Haven't received it?{" "}
						<Link
							to="/sign-in"
							search={{ redirect: "/tasks" }}
							className="underline underline-offset-4 hover:text-primary"
						>
							Back to sign in.
						</Link>
						.
					</p>
				</CardFooter>
			</Card>
		</AuthLayout>
	);
}
