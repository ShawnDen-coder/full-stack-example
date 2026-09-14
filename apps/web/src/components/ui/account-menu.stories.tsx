import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountMenu } from "./account-menu.js";

const meta = {
  title: "Navigation/Account menu",
  component: AccountMenu,
  args: { email: "mei@example.com", onSignOut: fn(async () => true) },
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Expanded: Story = { args: { defaultOpen: true } };
export const SigningOut: Story = { args: { defaultOpen: true, signingOut: true } };
export const SignOutFailed: Story = { args: { defaultOpen: true, signOutError: true } };
