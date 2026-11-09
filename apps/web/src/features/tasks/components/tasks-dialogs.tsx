import { ConfirmDialog } from "@/components/confirm-dialog";
import { showSubmittedData } from "@/lib/show-submitted-data";
import { TasksImportDialog } from "./tasks-import-dialog";
import { TasksMutateDrawer } from "./tasks-mutate-drawer";
import { useTasks } from "./tasks-provider";

export function TasksDialogs() {
	const { open, toggleDialog, currentRow, setCurrentRow } = useTasks();
	return (
		<>
			<TasksMutateDrawer
				key="task-create"
				open={open === "create"}
				onOpenChange={() => toggleDialog("create")}
			/>

			<TasksImportDialog
				key="tasks-import"
				open={open === "import"}
				onOpenChange={() => toggleDialog("import")}
			/>

			{currentRow && (
				<>
					<TasksMutateDrawer
						key={`task-update-${currentRow.id}`}
						open={open === "update"}
						onOpenChange={() => {
							toggleDialog("update");
							setTimeout(() => {
								setCurrentRow(null);
							}, 500);
						}}
						currentRow={currentRow}
					/>

					<ConfirmDialog
						key="task-delete"
						destructive
						open={open === "delete"}
						onOpenChange={() => {
							toggleDialog("delete");
							setTimeout(() => {
								setCurrentRow(null);
							}, 500);
						}}
						handleConfirm={() => {
							toggleDialog(null);
							setTimeout(() => {
								setCurrentRow(null);
							}, 500);
							showSubmittedData(
								currentRow,
								"Demo delete preview — no task was deleted:",
							);
						}}
						className="max-w-md"
						title={`Delete this task: ${currentRow.id} ?`}
						desc={
							<>
								You are about to delete a task with the ID{" "}
								<strong>{currentRow.id}</strong>. <br />
								This action cannot be undone.
							</>
						}
						confirmText="Delete"
					/>
				</>
			)}
		</>
	);
}
