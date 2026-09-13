import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "../features/system/pages/home-page.js";

export const Route = createFileRoute("/")({ component: HomePage });
