import type { Preview } from "@storybook/react-vite";
import { ThemeProvider } from "../src/app/theme.js";
import { StyledEngineProvider } from "@mui/material/styles";
import GlobalStyles from "@mui/material/GlobalStyles";
import CssBaseline from "@mui/material/CssBaseline";
import "../src/styles/index.css";

const preview: Preview = {
  globalTypes: {
    colorMode: {
      description: "Color theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => (
      <ThemeProvider
        initialTheme={context.globals.colorMode === "dark" ? "dark" : "light"}
        persist={false}
      >
        <StyledEngineProvider enableCssLayer>
          <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
          <CssBaseline />
          <Story />
        </StyledEngineProvider>
      </ThemeProvider>
    ),
  ],
  parameters: {
    a11y: { test: "todo" },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    layout: "centered",
  },
};

export default preview;

