import { Button } from "@full-stack-example/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@full-stack-example/ui/components/dialog";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { client } from "@/utils/orpc";

export function AddMemberDialog({
	active,
	workspaceId,
	onAdded,
}: {
	active: boolean;
	workspaceId: string;
	onAdded: () => void;
}) {
	const [email, setEmail] = useState("");
	const [addOpen, setAddOpen] = useState(false);
	const addMember = useMutation({
		mutationFn: () => client.access.addMember({ workspaceId, email }),
		onError: () => {},
		onSuccess: () => {
			setEmail("");
			setAddOpen(false);
			onAdded();
		},
	});
	if (!active) return null;
	return (
		<Dialog
			open={addOpen}
			onOpenChange={(next) => {
				if (!addMember.isPending) {
					setAddOpen(next);
					if (next) addMember.reset();
				}
			}}
		>
			<DialogTrigger asChild>
				<Button>Add member</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add member</DialogTitle>
					<DialogDescription>
						Add an existing account by exact email. New members receive member
						and standard roles.
					</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!addMember.isPending) addMember.mutate();
					}}
				>
					<div className="space-y-2">
						<Label htmlFor="member-email">Member email</Label>
						<Input
							id="member-email"
							disabled={addMember.isPending}
							type="email"
							required
							placeholder="Existing account email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>
					{addMember.isError && (
						<p role="alert" className="text-destructive text-sm">
							{addMember.error.message ||
								"Unable to add member. Please try again."}
						</p>
					)}
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={addMember.isPending}
							onClick={() => setAddOpen(false)}
						>
							Cancel
						</Button>
						<Button disabled={addMember.isPending || !email}>
							{addMember.isPending ? "Adding…" : "Add member"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
