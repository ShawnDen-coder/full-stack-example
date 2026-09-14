import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { AuthCard } from "./auth-card.js";
import { LoginForm } from "./login-form.js";

const meta = {
  title: "Authentication/Login form",
  component: LoginForm,
  args: { onSubmit: fn() },
  decorators: [
    (Story) => (
      <AuthCard description="登录以继续使用你的工作空间。" title="欢迎回来">
        <Story />
        <p className="text-center text-sm text-muted-foreground">
          还没有账号？{" "}
          <a
            className="font-medium text-primary underline-offset-4 hover:underline"
            href="#register"
          >
            注册
          </a>
        </p>
      </AuthCard>
    ),
  ],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const InvalidCredentials: Story = { args: { error: "邮箱或密码不正确，请重试。" } };
export const FieldErrors: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "登录" }));
  },
};
export const Submitting: Story = { args: { status: "submitting" } };

export const Mobile390: Story = {
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ width: 390, minHeight: 844 }}>
        <Story />
      </div>
    ),
  ],
};

export const Desktop1440: Story = {
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ width: 1440, minHeight: 900 }}>
        <Story />
      </div>
    ),
  ],
};
