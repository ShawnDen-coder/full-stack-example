import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AuthCard } from "./auth-card.js";
import { RegisterForm } from "./register-form.js";

const meta = {
  title: "Authentication/Registration form",
  component: RegisterForm,
  args: { onSubmit: fn() },
  decorators: [(Story) => <AuthCard description="创建账号，开始管理你的工作空间。" title="创建账号"><Story /></AuthCard>],
} satisfies Meta<typeof RegisterForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ServiceError: Story = { args: { error: "无法完成注册，请检查输入后重试。" } };
export const Submitting: Story = { args: { isSubmitting: true } };
