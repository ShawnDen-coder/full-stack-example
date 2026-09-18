import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "../components/system/home-page.js";

export const Route = createFileRoute("/")({ component: HomePage });
