import { ApiReferenceReact } from "@scalar/api-reference-react";

export function OpenApiReference() {
  return (
    <ApiReferenceReact
      configuration={{
        url: "./generated/openapi.json",
        hideClientButton: true,
        hideModels: false,
        hideDownloadButton: false,
      }}
    />
  );
}
