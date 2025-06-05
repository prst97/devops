import React, { useState } from 'react';
import './KanbanBoard.css';

const initialTasks = [
  { id: 1, title: 'Configurar projeto', status: 'todo' },
  { id: 2, title: 'Criar componentes', status: 'doing' },
  { id: 3, title: 'Testar aplicação', status: 'done' },
];

function KanbanBoard() {
  const [tasks] = useState(initialTasks);

  const [columns, setColumns] = useState([
    { key: 'todo', title: 'To Do', color: '#e6f4ff' },
    { key: 'doing', title: 'Em Progresso', color: '#fff8e6' },
    { key: 'done', title: 'Concluído', color: '#e6ffe6' },
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#eef2f7');

  const addColumn = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const key = `col_${Date.now()}`;
    setColumns([...columns, { key, title: newTitle, color: newColor }]);
    setNewTitle('');
    setNewColor('#eef2f7');
  };

  return (
    <div className="kanban-wrapper">
      <div className="kanban-board">
        {columns.map((column) => (
          <div key={column.key} className="kanban-column">
            <h3 style={{ backgroundColor: column.color }}>{column.title}</h3>
            <ul>
              {tasks
                .filter((task) => task.status === column.key)
                .map((task) => (
                  <li key={task.id} className="kanban-task">
                    {task.title}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <form className="add-column" onSubmit={addColumn}>
        <input
          type="text"
          placeholder="Título da coluna"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
        />
        <button type="submit">Adicionar Coluna</button>
      </form>
    </div>
  );
}

export default KanbanBoard;