import { createBrowserRouter, type RouteObject, RouterProvider } from "react-router";
import { Home } from "../routes/home.js";
import { Todos } from "../routes/todos.js";

export const routes = [
  { path: "/", element: <Home /> },
  { path: "/todos", element: <Todos /> },
] satisfies RouteObject[];

const router = createBrowserRouter(routes);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
