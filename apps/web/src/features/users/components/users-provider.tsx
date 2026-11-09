import React, { useState } from "react";
import useToggleDialogState from "@/hooks/use-toggle-dialog-state";
import type { User } from "../data/schema";

type UsersDialogType = "invite" | "add" | "edit" | "delete";

type UsersContextType = {
	open: UsersDialogType | null;
	toggleDialog: (str: UsersDialogType | null) => void;
	currentRow: User | null;
	setCurrentRow: React.Dispatch<React.SetStateAction<User | null>>;
};

const UsersContext = React.createContext<UsersContextType | null>(null);

export function UsersProvider({ children }: { children: React.ReactNode }) {
	const [open, toggleDialog] = useToggleDialogState<UsersDialogType>(null);
	const [currentRow, setCurrentRow] = useState<User | null>(null);

	return (
		<UsersContext value={{ open, toggleDialog, currentRow, setCurrentRow }}>
			{children}
		</UsersContext>
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUsers = () => {
	const usersContext = React.useContext(UsersContext);

	if (!usersContext) {
		throw new Error("useUsers has to be used within <UsersContext>");
	}

	return usersContext;
};
