import React, { useState } from "react";
import useToggleDialogState from "@/hooks/use-toggle-dialog-state";
import type { Task } from "../data/schema";

type TasksDialogType = "create" | "update" | "delete" | "import";

type TasksContextType = {
	open: TasksDialogType | null;
	toggleDialog: (str: TasksDialogType | null) => void;
	currentRow: Task | null;
	setCurrentRow: React.Dispatch<React.SetStateAction<Task | null>>;
};

const TasksContext = React.createContext<TasksContextType | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
	const [open, toggleDialog] = useToggleDialogState<TasksDialogType>(null);
	const [currentRow, setCurrentRow] = useState<Task | null>(null);

	return (
		<TasksContext value={{ open, toggleDialog, currentRow, setCurrentRow }}>
			{children}
		</TasksContext>
	);
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTasks = () => {
	const tasksContext = React.useContext(TasksContext);

	if (!tasksContext) {
		throw new Error("useTasks has to be used within <TasksContext>");
	}

	return tasksContext;
};
