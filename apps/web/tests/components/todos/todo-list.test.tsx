// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodoList } from "../../../src/components/todos/todo-list.js";

describe("TodoList", () => {
  it("hides deletion from members and allows owners to delete", () => {
    const onDelete = vi.fn();
    const todo = { id: 1, title: "Finish task", completed: false };
    const { rerender } = render(
      <TodoList
        canDelete={false}
        disabled={false}
        onDelete={onDelete}
        onToggle={vi.fn()}
        todos={[todo]}
      />,
    );
    expect(screen.queryByRole("button", { name: "删除 Finish task" })).toBeNull();

    rerender(
      <TodoList canDelete disabled={false} onDelete={onDelete} onToggle={vi.fn()} todos={[todo]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "删除 Finish task" }));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
