import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { appShellColors } from "../../../app/theme.js";
import { authClient } from "../../auth/client.js";
import { useCreateTodo, useDeleteTodo, useTodos, useUpdateTodo } from "../api.js";
import { TodoComposer } from "./todo-composer.js";
import { TodoList } from "./todo-list.js";

export function TodosPage({ organizationId }: { readonly organizationId: string }) {
  const memberRole = authClient.useActiveMemberRole();
  const todos = useTodos(organizationId);
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const isMutating = createTodo.isPending || updateTodo.isPending || deleteTodo.isPending;
  const canDelete = memberRole.data?.role === "owner" || memberRole.data?.role === "admin";
  const todoItems = todos.data?.todos ?? [];
  const completedCount = todoItems.filter((todo) => todo.completed).length;
  const pendingCount = todoItems.length - completedCount;

  function handleSubmit(title: string, reset: () => void) {
    createTodo.mutate(title, { onSuccess: reset });
  }

  return (
    <Stack spacing={3}>
      <Card
        sx={{
          overflow: "hidden",
          background: `linear-gradient(110deg, ${appShellColors.background} 0%, ${appShellColors.selectedHover} 100%)`,
          color: appShellColors.text,
        }}
      >
        <CardContent sx={{ p: { xs: 3, lg: 4 } }}>
          <Typography
            variant="overline"
            sx={{ color: appShellColors.accent, letterSpacing: "0.08em" }}
          >
            当前工作区
          </Typography>
          <Typography variant="h4" sx={{ mt: 0.5, mb: 1, color: "inherit" }}>
            把今天的任务向前推进
          </Typography>
          <Typography sx={{ maxWidth: "38rem", color: "rgba(244,247,248,0.72)" }}>
            集中查看、创建和完成当前工作区的待办事项。
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {[
          ["全部任务", todoItems.length],
          ["待完成", pendingCount],
          ["已完成", completedCount],
        ].map(([label, count]) => (
          <Grid key={label} size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">
                  {label}
                </Typography>
                {todos.isLoading ? (
                  <Skeleton width="4rem" height="3rem" />
                ) : (
                  <Typography variant="h4" sx={{ mt: 1, fontVariantNumeric: "tabular-nums" }}>
                    {count}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardHeader title="快速添加" subheader="记录一个需要推进的任务。" />
            <CardContent>
              <TodoComposer disabled={isMutating} onSubmit={handleSubmit} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardHeader title="任务列表" subheader="创建、完成或删除当前工作区的待办事项。" />
            <CardContent sx={{ display: "grid", gap: 2 }}>
              {createTodo.isError || updateTodo.isError || deleteTodo.isError ? (
                <Alert role="alert">操作失败，请重试。</Alert>
              ) : null}
              {todos.isLoading ? (
                <Box aria-label="正在加载待办事项" role="status" sx={{ display: "grid", gap: 1.5 }}>
                  <Skeleton variant="rounded" height={56} />
                  <Skeleton variant="rounded" height={56} />
                  <Skeleton variant="rounded" height={56} />
                </Box>
              ) : null}
              {todos.isError ? (
                <Alert
                  action={
                    <Button size="small" onClick={() => void todos.refetch()}>
                      重试
                    </Button>
                  }
                  role="alert"
                >
                  无法加载待办事项。
                </Alert>
              ) : null}
              {todos.data ? (
                <TodoList
                  canDelete={canDelete}
                  disabled={isMutating}
                  onDelete={(id) => deleteTodo.mutate(id)}
                  onToggle={(todo, completed) => updateTodo.mutate({ id: todo.id, completed })}
                  todos={todoItems}
                />
              ) : null}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
