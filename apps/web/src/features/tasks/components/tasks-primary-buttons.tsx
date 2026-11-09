import { Button } from "@full-stack-example/ui/components/button";
import { Download, Plus } from "lucide-react";
import { useTasks } from "./tasks-provider";

export function TasksPrimaryButtons() {
	const { toggleDialog } = useTasks();
	return (
		<div className="flex gap-2">
			<Button
				variant="outline"
				className="space-x-1"
				onClick={() => toggleDialog("import")}
			>
				<span>Import</span> <Download size={18} />
			</Button>
			<Button className="space-x-1" onClick={() => toggleDialog("create")}>
				<span>Create</span> <Plus size={18} />
			</Button>
		</div>
	);
}
