import { UsersActionDialog } from "./users-action-dialog";
import { UsersDeleteDialog } from "./users-delete-dialog";
import { UsersInviteDialog } from "./users-invite-dialog";
import { useUsers } from "./users-provider";

export function UsersDialogs() {
	const { open, toggleDialog, currentRow, setCurrentRow } = useUsers();
	return (
		<>
			<UsersActionDialog
				key="user-add"
				open={open === "add"}
				onOpenChange={() => toggleDialog("add")}
			/>

			<UsersInviteDialog
				key="user-invite"
				open={open === "invite"}
				onOpenChange={() => toggleDialog("invite")}
			/>

			{currentRow && (
				<>
					<UsersActionDialog
						key={`user-edit-${currentRow.id}`}
						open={open === "edit"}
						onOpenChange={() => {
							toggleDialog("edit");
							setTimeout(() => {
								setCurrentRow(null);
							}, 500);
						}}
						currentRow={currentRow}
					/>

					<UsersDeleteDialog
						key={`user-delete-${currentRow.id}`}
						open={open === "delete"}
						onOpenChange={() => {
							toggleDialog("delete");
							setTimeout(() => {
								setCurrentRow(null);
							}, 500);
						}}
						currentRow={currentRow}
					/>
				</>
			)}
		</>
	);
}
