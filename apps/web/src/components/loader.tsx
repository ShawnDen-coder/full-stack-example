import { Icon } from "@full-stack-example/ui/components/icon";
import { Loader2 } from "lucide-react";

export default function Loader() {
	return (
		<div role="status" className="flex h-full items-center justify-center pt-8">
			<Icon
				icon={Loader2}
				size="status"
				aria-hidden="true"
				className="animate-spin motion-reduce:animate-none"
			/>
			<span className="sr-only">Loading</span>
		</div>
	);
}
