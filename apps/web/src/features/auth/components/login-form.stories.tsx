import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AuthCard } from "./auth-card.js";
import { LoginForm } from "./login-form.js";

const meta = {
  title: "Authentication/Login form",
  component: LoginForm,
  args: { onSubmit: fn() },
  decorators: [(Story) => <AuthCard description="登录以继续使用你的工作空间。" title="欢迎回来"><Story /></AuthCard>],
} satisfies Meta<typeof LoginForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const InvalidCredentials: Story = { args: { error: "邮箱或密码不正确，请重试。" } };
export const Submitting: Story = { args: { isSubmitting: true } };
