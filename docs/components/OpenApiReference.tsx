import { useDark, withBase } from "@rspress/core/runtime";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useEffect, useState } from "react";

export function OpenApiReference() {
	const darkMode = useDark();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const url = withBase("/generated/openapi.json");
	return (
		<>
			<p>
				<a href={url} download="openapi.json">
					openapi.json
				</a>
			</p>
			{mounted && (
				<ApiReferenceReact
					configuration={{
						url,
						withDefaultFonts: false,
						darkMode,
						showDeveloperTools: "never",
						showSidebar: false,
						hiddenClients: true,
						hideClientButton: true,
						hideTestRequestButton: true,
						hideDarkModeToggle: true,
						layout: "classic",
					}}
				/>
			)}
		</>
	);
}
