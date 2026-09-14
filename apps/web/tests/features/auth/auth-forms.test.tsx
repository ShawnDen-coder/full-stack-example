// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../../../src/features/auth/components/login-form.js";
import { RegisterForm } from "../../../src/features/auth/components/register-form.js";

describe("authentication forms", () => {
  afterEach(cleanup);

  it("shows linked field errors for missing login credentials", async () => {
    const user = userEvent.setup();
    render(<LoginForm onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "登录" }));

    const email = screen.getByLabelText("邮箱");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")).toBe("login-email-error");
    expect(screen.getByText("请输入邮箱")).toBeTruthy();
  });

  it("validates password confirmation without calling the submit callback", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("姓名"), "小明");
    await user.type(screen.getByLabelText("邮箱"), "xiaoming@example.com");
    await user.type(screen.getByLabelText("密码"), "correct-horse-battery");
    await user.type(screen.getByLabelText("确认密码"), "different-password");
    await user.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByText("两次输入的密码不一致。")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("announces server errors accessibly", () => {
    render(<RegisterForm error="无法完成注册，请稍后重试。" onSubmit={vi.fn()} />);

    expect(screen.getByRole("alert").textContent).toBe("无法完成注册，请稍后重试。");
  });

  it("submits normalized form values and disables the submit action while pending", async () => {
    const user = userEvent.setup();
    let resolveSubmit!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText("邮箱"), "mei@example.com");
    await user.type(screen.getByLabelText("密码"), "secret");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: "mei@example.com",
        password: "secret",
      }),
    );
    expect(screen.getByRole("button", { name: "正在登录…" }).hasAttribute("disabled")).toBe(true);
    resolveSubmit();
  });

  it("submits all registration values", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<RegisterForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("姓名"), "小明");
    await user.type(screen.getByLabelText("邮箱"), "xiaoming@example.com");
    await user.type(screen.getByLabelText("密码"), "correct-horse-battery");
    await user.type(screen.getByLabelText("确认密码"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "创建账号" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: "小明",
        email: "xiaoming@example.com",
        password: "correct-horse-battery",
        confirmation: "correct-horse-battery",
      }),
    );
  });
});
