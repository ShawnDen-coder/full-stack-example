import type { Preview } from "@storybook/react-vite";
import { ThemeProvider } from "../src/app/theme-provider.js";
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
        <div className="min-h-screen bg-background text-foreground">
          <Story />
        </div>
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
