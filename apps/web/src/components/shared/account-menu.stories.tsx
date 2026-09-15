import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { AccountMenu } from "./account-menu.js";

const meta = {
  title: "Navigation/Account menu",
  component: AccountMenu,
  args: { email: "mei@example.com", onSignOut: fn(async () => true) },
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
const openMenu = async ({ canvasElement }: { canvasElement: HTMLElement }) => userEvent.click(within(canvasElement).getByLabelText("打开账户菜单"));
export const Expanded: Story = { play: openMenu };
export const SigningOut: Story = { args: { signingOut: true }, play: openMenu };
export const SignOutFailed: Story = { args: { signOutError: true }, play: openMenu };








