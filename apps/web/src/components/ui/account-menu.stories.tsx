import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountMenu } from "./account-menu.js";

const meta = {
  title: "Navigation/Account menu",
  component: AccountMenu,
  args: { email: "mei@example.com", onSignOut: fn() },
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const SigningOut: Story = { args: { disabled: true } };
