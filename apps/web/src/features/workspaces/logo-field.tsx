import { Button } from "@full-stack-example/ui/components/button";
import { Input } from "@full-stack-example/ui/components/input";
import { Label } from "@full-stack-example/ui/components/label";
import { LogoPreview } from "./workspace-logo";

export function LogoField({
	id,
	label,
	name,
	logo,
	disabled,
	removeDisabled,
	compact,
	onFile,
	onRemove,
}: {
	id: string;
	label: string;
	name: string;
	logo: string | null;
	disabled: boolean;
	removeDisabled: boolean;
	compact?: boolean;
	onFile: (file: File) => void;
	onRemove: () => void;
}) {
	return (
		<>
			<Label htmlFor={id}>{label}</Label>
			<div
				className={
					compact
						? "flex items-center gap-2"
						: "flex flex-wrap items-center gap-2"
				}
			>
				<LogoPreview name={name} logo={logo} />
				<Input
					id={id}
					className={compact ? undefined : "max-w-64"}
					type="file"
					accept="image/png,image/jpeg,image/webp"
					disabled={disabled}
					onChange={(event) => {
						const file = event.target.files?.[0];
						event.target.value = "";
						if (file) onFile(file);
					}}
				/>
				<Button
					type="button"
					variant="ghost"
					disabled={removeDisabled}
					onClick={onRemove}
				>
					Remove
				</Button>
			</div>
		</>
	);
}
