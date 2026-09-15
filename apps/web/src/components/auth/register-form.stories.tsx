import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn, userEvent, within } from "storybook/test";
import { AuthCard } from "./auth-card.js";
import { RegisterForm } from "./register-form.js";

const meta = {
  title: "Authentication/Registration form",
  component: RegisterForm,
  args: { onSubmit: fn() },
  decorators: [
    (Story) => (
      <AuthCard description="创建账号，开始管理你的工作空间。" title="创建账号">
        <Story />
        <p className="text-center text-sm">
          已有账号？{" "}
          <a className="font-medium underline-offset-4 hover:underline" href="#login">
            登录
          </a>
        </p>
      </AuthCard>
    ),
  ],
} satisfies Meta<typeof RegisterForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ServiceError: Story = { args: { error: "无法完成注册，请检查输入后重试。" } };
export const FieldErrors: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "创建账号" }));
  },
};

export const PasswordMismatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("姓名"), "小明");
    await userEvent.type(canvas.getByLabelText("邮箱"), "xiaoming@example.com");
    await userEvent.type(canvas.getByLabelText("密码"), "correct-horse-battery");
    await userEvent.type(canvas.getByLabelText("确认密码"), "different-password");
    await userEvent.click(canvas.getByRole("button", { name: "创建账号" }));
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

