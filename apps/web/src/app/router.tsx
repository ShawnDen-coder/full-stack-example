import { createBrowserRouter, type RouteObject, RouterProvider } from "react-router";
import { RequireSession, RequireWorkspace } from "../components/auth/session-guard.js";
import { HomePage } from "../pages/home-page.js";
import { LoginPage } from "../pages/login-page.js";
import { RegisterPage } from "../pages/register-page.js";
import { TodosPage } from "../pages/todos-page.js";
import { WorkspacesPage } from "../pages/workspaces-page.js";

export const routes = [
  { path: "/", element: <HomePage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/workspaces",
    element: (
      <RequireSession>
        <WorkspacesPage />
      </RequireSession>
    ),
  },
  {
    path: "/todos",
    element: (
      <RequireSession>
        <RequireWorkspace>
          <TodosPage />
        </RequireWorkspace>
      </RequireSession>
    ),
  },
] satisfies RouteObject[];

const router = createBrowserRouter(routes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
