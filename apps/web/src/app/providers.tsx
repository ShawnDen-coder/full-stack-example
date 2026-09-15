import GlobalStyles from "@mui/material/GlobalStyles";
import { StyledEngineProvider } from "@mui/material/styles";
import { QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { queryClient } from "../lib/query-client.js";
import { ThemeProvider } from "./theme.js";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <StyledEngineProvider enableCssLayer>
      {/* MUI layer 置于 Tailwind utilities 之前，保证布局工具可覆盖组件默认样式。 */}
      <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </StyledEngineProvider>
  );
}
