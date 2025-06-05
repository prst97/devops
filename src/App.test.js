import { render, screen } from '@testing-library/react';
import App from './App';

test('renders kanban columns', () => {
  render(<App />);
  expect(screen.getByText(/To Do/i)).toBeInTheDocument();
  expect(screen.getByText(/Em Progresso/i)).toBeInTheDocument();
  expect(screen.getByText(/Concluído/i)).toBeInTheDocument();
});
