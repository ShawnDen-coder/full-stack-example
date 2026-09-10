import { createBrowserRouter, type RouteObject, RouterProvider } from "react-router";
import { Home } from "../routes/home.js";
import { Login } from "../routes/login.js";
import { Register } from "../routes/register.js";
import { RequireSession, RequireWorkspace } from "../routes/require-session.js";
import { Todos } from "../routes/todos.js";
import { Workspaces } from "../routes/workspaces.js";

export const routes = [
  { path: "/", element: <Home /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    path: "/workspaces",
    element: (
      <RequireSession>
        <Workspaces />
      </RequireSession>
    ),
  },
  {
    path: "/todos",
    element: (
      <RequireSession>
        <RequireWorkspace>
          <Todos />
        </RequireWorkspace>
      </RequireSession>
    ),
  },
] satisfies RouteObject[];

const router = createBrowserRouter(routes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
