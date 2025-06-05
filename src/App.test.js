import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";

test("renders kanban columns", () => {
  render(<App />);
  expect(screen.getByText(/To Do/i)).toBeInTheDocument();
  expect(screen.getByText(/Em Progresso/i)).toBeInTheDocument();
  expect(screen.getByText(/Concluído/i)).toBeInTheDocument();
});

test("allows deleting only added columns", () => {
  render(<App />);
  expect(
    screen.queryByLabelText(/Remover coluna To Do/i),
  ).not.toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText(/Título da coluna/i), {
    target: { value: "Extra" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Adicionar Coluna/i }));

  expect(screen.getByText("Extra")).toBeInTheDocument();
  const removeBtn = screen.getByLabelText("Remover coluna Extra");
  fireEvent.click(removeBtn);
  expect(screen.queryByText("Extra")).not.toBeInTheDocument();
});
