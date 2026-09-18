import { createRoot } from "react-dom/client";
import { AppProviders } from "./app/providers.js";
import { AppRouter } from "./app/router.js";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element was not found");
createRoot(root).render(
  <AppProviders>
    <AppRouter />
  </AppProviders>,
);
