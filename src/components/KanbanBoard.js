import React, { useState } from 'react';
import './KanbanBoard.css';

const initialTasks = [
  { id: 1, title: 'Configurar projeto', status: 'todo' },
  { id: 2, title: 'Criar componentes', status: 'doing' },
  { id: 3, title: 'Testar aplicação', status: 'done' },
];

function KanbanBoard() {
  const [tasks] = useState(initialTasks);

  const columns = [
    { key: 'todo', title: 'To Do' },
    { key: 'doing', title: 'Em Progresso' },
    { key: 'done', title: 'Concluído' },
  ];

  return (
    <div className="kanban-wrapper">
      <div className="kanban-board">
        {columns.map((column) => (
          <div key={column.key} className="kanban-column">
            <h2>{column.title}</h2>
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
    </div>
  );
}

export default KanbanBoard;