// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, ThemeSelect } from "../../src/app/theme-provider.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  vi.unstubAllGlobals();
});

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, String(value)),
  } satisfies Pick<Storage, "clear" | "getItem" | "removeItem" | "setItem">);
});

describe("ThemeProvider", () => {
  it("loads the saved theme and persists user changes", async () => {
    localStorage.setItem("ui-theme", "dark");
    render(
      <ThemeProvider>
        <ThemeSelect />
      </ThemeProvider>,
    );

    await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true));
    expect((screen.getByLabelText("选择外观主题") as HTMLSelectElement).value).toBe("dark");

    fireEvent.change(screen.getByLabelText("选择外观主题"), { target: { value: "light" } });
    expect(localStorage.getItem("ui-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows system color changes when the system option is selected", async () => {
    const listeners: Array<(event: MediaQueryListEvent) => void> = [];
    let isDark = false;
    const media = {
      get matches() {
        return isDark;
      },
      addEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.push(listener);
      }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => media),
    );
    localStorage.setItem("ui-theme", "system");
    render(
      <ThemeProvider>
        <ThemeSelect />
      </ThemeProvider>,
    );

    await waitFor(() => expect(listeners.length).toBeGreaterThan(0));
    isDark = true;
    listeners.forEach((listener) => {
      listener({ matches: true } as MediaQueryListEvent);
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
