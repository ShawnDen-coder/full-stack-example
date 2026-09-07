// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Todos } from "../src/routes/todos.js";

interface TodoRecord {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
}

function renderTodos() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installTodoFetch(records: TodoRecord[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const request = input instanceof Request ? input : undefined;
      const url = new URL(request ? request.url : input.toString());
      const method = init?.method ?? request?.method ?? "GET";
      const id = Number(url.pathname.split("/").at(-1));
      if (method === "GET") return jsonResponse({ todos: records });
      if (method === "POST") {
        const body = init?.body;
        if (typeof body !== "string") return jsonResponse({ error: "Invalid request" }, 400);
        const parsed: unknown = JSON.parse(body);
        if (typeof parsed !== "object" || parsed === null || !("title" in parsed))
          return jsonResponse({ error: "Invalid request" }, 400);
        const title = parsed.title;
        if (typeof title !== "string") return jsonResponse({ error: "Invalid request" }, 400);
        const todo = { id: records.length + 1, title, completed: false };
        records.unshift(todo);
        return jsonResponse(todo, 201);
      }
      if (method === "PATCH") {
        const todo = records.find((record) => record.id === id);
        if (!todo) return jsonResponse({ error: "Todo not found" }, 404);
        const body = init?.body;
        if (typeof body !== "string") return jsonResponse({ error: "Invalid request" }, 400);
        const parsed: unknown = JSON.parse(body);
        if (typeof parsed !== "object" || parsed === null || !("completed" in parsed))
          return jsonResponse({ error: "Invalid request" }, 400);
        if (typeof parsed.completed !== "boolean")
          return jsonResponse({ error: "Invalid request" }, 400);
        const updated = { ...todo, completed: parsed.completed };
        const index = records.indexOf(todo);
        records.splice(index, 1, updated);
        return jsonResponse(updated);
      }
      if (method === "DELETE") {
        const index = records.findIndex((record) => record.id === id);
        if (index === -1) return jsonResponse({ error: "Todo not found" }, 404);
        records.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ error: "Not found" }, 404);
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Todos page", () => {
  it("shows the empty state and creates a todo", async () => {
    const records: TodoRecord[] = [];
    installTodoFetch(records);
    renderTodos();

    expect(await screen.findByText("还没有待办事项。")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("添加一个待办事项"), {
      target: { value: "Write tests" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));

    expect(await screen.findByText("Write tests")).toBeTruthy();
  });

  it("updates completion and deletes a todo", async () => {
    const records: TodoRecord[] = [{ id: 1, title: "Finish task", completed: false }];
    installTodoFetch(records);
    renderTodos();

    const checkbox = await screen.findByRole("checkbox", { name: "完成 Finish task" });
    fireEvent.click(checkbox);
    await waitFor(() =>
      expect(checkbox instanceof HTMLInputElement && checkbox.checked).toBe(true),
    );

    fireEvent.click(screen.getByRole("button", { name: "删除 Finish task" }));
    expect(await screen.findByText("还没有待办事项。")).toBeTruthy();
  });

  it("shows an error when the Todo request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (): Promise<Response> => jsonResponse({ error: "Failed" }, 500)),
    );
    renderTodos();

    expect(await screen.findByText("无法加载待办事项。")).toBeTruthy();
  });
});
