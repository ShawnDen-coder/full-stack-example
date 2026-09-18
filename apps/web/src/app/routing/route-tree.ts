import { authenticatedRoute, newWorkspaceRoute, workspacesRoute } from "./protected-routes.js";
import { homeRoute, loginRoute, registerRoute } from "./public-routes.js";
import { rootRoute } from "./root-route.js";
import { todosRoute, workspaceRoute } from "./workspace-routes.js";

export const routeTree = rootRoute.addChildren({
  homeRoute,
  loginRoute,
  registerRoute,
  authenticatedRoute: authenticatedRoute.addChildren({
    workspacesRoute,
    newWorkspaceRoute,
    workspaceRoute: workspaceRoute.addChildren({ todosRoute }),
  }),
});
