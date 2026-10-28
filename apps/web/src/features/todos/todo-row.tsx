import { Button } from "@full-stack-example/ui/components/button";
import { Checkbox } from "@full-stack-example/ui/components/checkbox";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { client } from "@/utils/orpc";

type Todo = Awaited<ReturnType<typeof client.todo.create>>;
type TodoRowProps = {
	todo: Todo;
	busy: boolean;
	editing: boolean;
	editingAnother: boolean;
	onEdit: () => void;
	onClose: () => void;
	onRename: (text: string) => Promise<void>;
	onCompleted: () => void;
	onDelete: () => void;
};

export function TodoRow({
	todo,
	busy,
	editing,
	editingAnother,
	onEdit,
	onClose,
	onRename,
	onCompleted,
	onDelete,
}: TodoRowProps) {
	const editButton = useRef<HTMLButtonElement>(null);
	const close = () => {
		onClose();
		requestAnimationFrame(() => editButton.current?.focus());
	};
	return (
		<li className="rounded-md border p-2">
			{editing ? (
				<TodoEditor todo={todo} busy={busy} onSave={onRename} onClose={close} />
			) : (
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<Checkbox
							id={`todo-${todo.id}`}
							checked={todo.completed}
							disabled={busy || editingAnother}
							onCheckedChange={onCompleted}
						/>
						<label
							htmlFor={`todo-${todo.id}`}
							className={`min-w-0 break-words ${todo.completed ? "line-through" : ""}`}
						>
							{todo.text}
						</label>
					</div>
					<div className="flex shrink-0 gap-1">
						<Button
							ref={editButton}
							variant="ghost"
							size="icon"
							aria-label={`Edit ${todo.text}`}
							disabled={busy || editingAnother}
							onClick={onEdit}
						>
							<Pencil aria-hidden="true" className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							aria-label={`Delete ${todo.text}`}
							disabled={busy || editingAnother}
							onClick={onDelete}
						>
							<Trash2 aria-hidden="true" className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</li>
	);
}

const editSchema = z.object({
	text: z
		.string()
		.trim()
		.min(1, "Enter a task name.")
		.max(500, "Use 500 characters or fewer."),
});

function TodoEditor({
	todo,
	busy,
	onSave,
	onClose,
}: {
	todo: Todo;
	busy: boolean;
	onSave: (text: string) => Promise<void>;
	onClose: () => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [saveError, setSaveError] = useState(false);
	const form = useForm({
		defaultValues: { text: todo.text },
		validators: { onChange: editSchema, onSubmit: editSchema },
		onSubmit: async ({ value }) => {
			setSaveError(false);
			try {
				await onSave(value.text.trim());
				onClose();
			} catch {
				setSaveError(true);
			}
		},
	});
	useEffect(() => {
		input.current?.focus();
		input.current?.select();
	}, []);
	return (
		<form
			className="space-y-3"
			noValidate
			onSubmit={(event) => {
				event.preventDefault();
				if (!busy && !form.state.isSubmitting) void form.handleSubmit();
			}}
			onKeyDown={(event) => {
				if (event.key === "Escape" && !busy && !form.state.isSubmitting) {
					event.preventDefault();
					onClose();
				}
			}}
		>
			<form.Field name="text">
				{(field) => (
					<div className="space-y-2">
						<Label htmlFor={`edit-todo-${todo.id}`}>Task name</Label>
						<Input
							ref={input}
							id={`edit-todo-${todo.id}`}
							value={field.state.value}
							disabled={busy}
							aria-invalid={field.state.meta.errors.length > 0}
							aria-describedby={
								field.state.meta.errors.length
									? `edit-error-${todo.id}`
									: undefined
							}
							onChange={(event) => {
								setSaveError(false);
								field.handleChange(event.target.value);
							}}
							onBlur={field.handleBlur}
						/>
						{field.state.meta.errors.length > 0 && (
							<p
								id={`edit-error-${todo.id}`}
								role="alert"
								className="text-destructive text-sm"
							>
								{field.state.meta.errors
									.map((error) => error?.message)
									.join(" ")}
							</p>
						)}
					</div>
				)}
			</form.Field>
			{saveError && (
				<p role="alert" className="text-sm">
					Unable to save this task. Your changes are still here. Try again.
				</p>
			)}
			<form.Subscribe
				selector={(state) => ({
					canSubmit: state.canSubmit,
					isSubmitting: state.isSubmitting,
				})}
			>
				{({ canSubmit, isSubmitting }) => (
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							disabled={busy || isSubmitting}
							onClick={onClose}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={busy || isSubmitting || !canSubmit}
							aria-busy={isSubmitting}
						>
							{isSubmitting ? "Saving..." : "Save"}
						</Button>
					</div>
				)}
			</form.Subscribe>
		</form>
	);
}
