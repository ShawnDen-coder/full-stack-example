import { Button } from "@full-stack-example/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@full-stack-example/ui/components/form";
import { Input } from "@full-stack-example/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { cn, sleep } from "@/lib/utils";

const formSchema = z.object({
	email: z.email({
		error: (iss) => (iss.input === "" ? "Please enter your email." : undefined),
	}),
});

export function ForgotPasswordForm({
	className,
	...props
}: React.HTMLAttributes<HTMLFormElement>) {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: { email: "" },
	});

	function onSubmit(data: z.infer<typeof formSchema>) {
		setIsLoading(true);

		toast.promise(sleep(2000), {
			loading: "Previewing password reset...",
			success: () => {
				setIsLoading(false);
				form.reset();
				navigate({ to: "/otp" });
				return `Demo only: no reset email was sent to ${data.email}`;
			},
			error: "Error",
		});
	}

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className={cn("grid gap-2", className)}
				{...props}
			>
				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email</FormLabel>
							<FormControl>
								<Input placeholder="name@example.com" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button className="mt-2" disabled={isLoading}>
					Continue
					{isLoading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
				</Button>
			</form>
		</Form>
	);
}
