import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import KanbanBoard from './KanbanBoard';
import { apiFetch } from '../utils/api';

jest.mock('../utils/api', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }) => children,
  Droppable: ({ children }) => children({
    innerRef: jest.fn(),
    droppableProps: {},
    placeholder: null
  }, {}),
  Draggable: ({ children }) => children({
    innerRef: jest.fn(),
    draggableProps: { style: {} },
    dragHandleProps: {}
  }, {})
}));

describe('KanbanBoard', () => {
  const mockColumns = [
    { id: 1, title: 'To Do', slug: 'todo', color: '#e6f4ff', ord: 1 },
    { id: 2, title: 'Em Progresso', slug: 'doing', color: '#fff8e6', ord: 2 },
    { id: 3, title: 'Concluído', slug: 'done', color: '#e6ffe6', ord: 3 }
  ];

  const mockTasks = [
    { id: 1, title: 'Configurar projeto', column_id: 1, ord: 1 },
    { id: 2, title: 'Criar componentes', column_id: 2, ord: 1 },
    { id: 3, title: 'Testar aplicação', column_id: 3, ord: 1 }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/columns' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockColumns)
        });
      }
      if (url === '/api/tasks' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTasks)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  test('renderiza colunas e tarefas iniciais', async () => {
    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('Em Progresso')).toBeInTheDocument();
      expect(screen.getByText('Concluído')).toBeInTheDocument();
    });

    expect(screen.getByText('Configurar projeto')).toBeInTheDocument();
    expect(screen.getByText('Criar componentes')).toBeInTheDocument();
    expect(screen.getByText('Testar aplicação')).toBeInTheDocument();
  });

  test('adiciona uma nova tarefa temporária', async () => {
    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByLabelText('Adicionar tarefa');
    fireEvent.click(addButtons[0]);

    expect(screen.getByDisplayValue('Nova Tarefa')).toBeInTheDocument();
  });

  test('salva nova tarefa ao pressionar Enter', async () => {
    const mockNewTask = { id: 4, title: 'Nova tarefa teste', column_id: 1, ord: 2 };
    
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/columns' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockColumns)
        });
      }
      if (url === '/api/tasks' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTasks)
        });
      }
      if (url === '/api/tasks' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNewTask)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByLabelText('Adicionar tarefa');
    fireEvent.click(addButtons[0]);

    const input = screen.getByDisplayValue('Nova Tarefa');
    fireEvent.change(input, { target: { value: 'Nova tarefa teste' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Nova tarefa teste',
          column_id: 1
        })
      });
    });
  });

  test('cancela edição ao pressionar Escape', async () => {
    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    const addButtons = screen.getAllByLabelText('Adicionar tarefa');
    fireEvent.click(addButtons[0]);

    const input = screen.getByDisplayValue('Nova Tarefa');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByDisplayValue('Nova Tarefa')).not.toBeInTheDocument();
  });

  test('edita tarefa existente', async () => {
    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('Configurar projeto')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Configurar projeto'));

    const input = screen.getByDisplayValue('Configurar projeto');
    fireEvent.change(input, { target: { value: 'Projeto configurado' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/tasks/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Projeto configurado' })
      });
    });
  });

  test('deleta tarefa existente', async () => {
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/columns' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockColumns)
        });
      }
      if (url === '/api/tasks' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTasks)
        });
      }
      if (url === '/api/tasks/1' && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, status: 204 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('Configurar projeto')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('Excluir tarefa');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/tasks/1', { method: 'DELETE' });
    });
  });

  test('adiciona nova coluna', async () => {
    const mockNewColumn = { id: 4, title: 'Nova Coluna', slug: 'nova-coluna', color: '#f0f0f0', ord: 4 };
    
    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/columns' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockColumns)
        });
      }
      if (url === '/api/tasks' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTasks)
        });
      }
      if (url === '/api/columns' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNewColumn)
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText('Título da coluna');
    const colorInput = screen.getByDisplayValue('#eef2f7');
    const submitButton = screen.getByText('Adicionar Coluna');

    fireEvent.change(titleInput, { target: { value: 'Nova Coluna' } });
    fireEvent.change(colorInput, { target: { value: '#f0f0f0' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nova Coluna', color: '#f0f0f0' })
      });
    });
  });

  test('não permite adicionar coluna com título duplicado', async () => {
    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    const titleInput = screen.getByPlaceholderText('Título da coluna');
    const submitButton = screen.getByText('Adicionar Coluna');

    fireEvent.change(titleInput, { target: { value: 'To Do' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Título de coluna já existe')).toBeInTheDocument();
    });
  });

  test('não permite deletar colunas padrão', async () => {
    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });

    const todoColumn = screen.getByText('To Do').closest('.kanban-column');
    const deleteButton = todoColumn?.querySelector('.delete-column-btn');
    
    expect(deleteButton).not.toBeInTheDocument();
  });

  test('exibe erro quando falha ao carregar dados', async () => {
    apiFetch.mockRejectedValue(new Error('Network error'));

    render(<KanbanBoard />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao conectar com o servidor.')).toBeInTheDocument();
    });
  });

  test('limita número máximo de colunas', async () => {
    const manyColumns = Array.from({ length: 6 }, (_, i) => ({
      id: i + 1,
      title: `Coluna ${i + 1}`,
      slug: `coluna-${i + 1}`,
      color: '#eef2f7',
      ord: i + 1
    }));

    apiFetch.mockImplementation((url, options) => {
      if (url === '/api/columns' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(manyColumns)
        });
      }
      if (url === '/api/tasks' && !options) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    render(<KanbanBoard />);
    
    await waitFor(() => {
      expect(screen.getByText('Coluna 1')).toBeInTheDocument();
    });

    const submitButton = screen.getByText('Adicionar Coluna');
    expect(submitButton).toBeDisabled();
  });
});