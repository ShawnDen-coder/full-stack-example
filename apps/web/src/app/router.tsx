import { BrowserRouter, Route, Routes } from "react-router";
import { Home } from "../routes/home.js";
import { Todos } from "../routes/todos.js";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/todos" element={<Todos />} />
      </Routes>
    </BrowserRouter>
  );
}
