import { Icon } from "@full-stack-example/ui/components/icon";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { useState } from "react";
import { client } from "@/utils/orpc";

export function WorkspaceLogo({
	id,
	name,
	hasLogo,
}: {
	id: string;
	name: string;
	hasLogo: boolean;
}) {
	const [failedLogo, setFailedLogo] = useState<string | null>(null);
	const logo = useQuery({
		queryKey: ["workspaces", "logo", id],
		queryFn: () => client.access.workspaceLogo({ workspaceId: id }),
		enabled: hasLogo === true,
	});
	return (
		<LogoPreview
			name={name}
			logo={hasLogo && logo.data?.logo !== failedLogo ? logo.data?.logo : null}
			onError={() => setFailedLogo(logo.data?.logo ?? null)}
		/>
	);
}

export function LogoPreview({
	name,
	logo,
	onError,
}: {
	name: string;
	logo?: string | null;
	onError?: () => void;
}) {
	const safeLogo =
		logo &&
		logo.length <= 44_000 &&
		/^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logo)
			? logo
			: null;
	return (
		<span
			className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted font-medium"
			aria-hidden="true"
			title={name}
		>
			{safeLogo ? (
				<img
					src={safeLogo}
					alt=""
					className="size-full object-cover"
					onError={onError}
				/>
			) : (
				<Icon icon={Building2} />
			)}
		</span>
	);
}

export async function prepareLogo(file: File): Promise<string> {
	if (
		!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
		file.size > 5 * 1024 * 1024
	)
		throw new Error("Choose a PNG, JPEG or WebP image under 5 MB.");
	const bitmap = await createImageBitmap(file);
	try {
		const scale = Math.min(1, 256 / bitmap.width, 256 / bitmap.height);
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Image preview is unavailable.");
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const result = canvas.toDataURL("image/webp", 0.8);
		if (result.length > 43_700 || !result.startsWith("data:image/webp;base64,"))
			throw new Error("Image is too complex. Choose a smaller image.");
		return result;
	} finally {
		bitmap.close();
	}
}
