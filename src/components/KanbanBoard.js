import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import "./KanbanBoard.css";

const initialTasks = [
  { id: 1, title: "Configurar projeto", status: "todo" },
  { id: 2, title: "Criar componentes", status: "doing" },
  { id: 3, title: "Testar aplicação", status: "done" },
];

const MAX_COLUMNS = 6;
const INITIAL_COLUMNS = [
  { key: "todo", title: "To Do", color: "#e6f4ff" },
  { key: "doing", title: "Em Progresso", color: "#fff8e6" },
  { key: "done", title: "Concluído", color: "#e6ffe6" },
];
const INITIAL_COLUMN_KEYS = INITIAL_COLUMNS.map((c) => c.key);

function KanbanBoard() {
  const [tasks, setTasks] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [columns, setColumns] = useState(INITIAL_COLUMNS);

  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("#eef2f7");

  useEffect(() => {
    fetch("/api/columns")
      .then((res) => res.json())
      .then(setColumns)
      .catch(() => setColumns(INITIAL_COLUMNS));
    fetch("/api/tasks")
      .then((res) => res.json())
      .then(setTasks)
      .catch(() => setTasks(initialTasks));
  }, []);

  const addTask = (status) => {
    const id = Date.now();
    const task = { id, title: "", status };
    setTasks([...tasks, task]);
    setEditingTaskId(id);
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter((t) => t.id !== id));
    fetch(`/api/tasks/${id}`, { method: "DELETE" });
  };

  const startEditing = (id) => {
    setEditingTaskId(id);
  };

  const handleTaskChange = (id, value) => {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, title: value } : t)));
  };

  const finishEditing = () => {
    const task = tasks.find((t) => t.id === editingTaskId);
    if (task) {
      fetch(`/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(task),
      });
    }
    setEditingTaskId(null);
  };

  const deleteColumn = (key) => {
    if (INITIAL_COLUMN_KEYS.includes(key)) return;
    setColumns((cols) => cols.filter((col) => col.key !== key));
    setTasks((ts) => ts.filter((t) => t.status !== key));
    fetch(`/api/columns/${key}`, { method: "DELETE" });
  };

  const addColumn = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (columns.length >= MAX_COLUMNS) return;
    const col = { key: `col_${Date.now()}`, title: newTitle, color: newColor };
    setColumns((prev) => [...prev, col]);
    fetch("/api/columns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(col),
    }).catch(() => {});
    setNewTitle("");
    setNewColor("#eef2f7");
  };

  const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, type } = result;

    if (type === "COLUMN") {
      if (source.index === destination.index) return;
      setColumns((prev) => {
        const updatedCols = reorder(prev, source.index, destination.index);
        fetch("/api/reorderColumns", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCols),
        });
        return updatedCols;
      });
      return;
    }

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const updated = (prev) => {
      const tasksByStatus = {};
      prev.forEach((t) => {
        if (!tasksByStatus[t.status]) tasksByStatus[t.status] = [];
        tasksByStatus[t.status].push({ ...t });
      });

      const [moved] = tasksByStatus[source.droppableId].splice(source.index, 1);
      moved.status = destination.droppableId;
      if (!tasksByStatus[destination.droppableId])
        tasksByStatus[destination.droppableId] = [];
      tasksByStatus[destination.droppableId].splice(
        destination.index,
        0,
        moved,
      );

      let ordered = [];
      columns.forEach((col) => {
        if (tasksByStatus[col.key])
          ordered = ordered.concat(tasksByStatus[col.key]);
      });
      Object.keys(tasksByStatus).forEach((key) => {
        if (!columns.some((c) => c.key === key)) {
          ordered = ordered.concat(tasksByStatus[key]);
        }
      });
      return ordered;
    };
    setTasks((prev) => {
      const resultTasks = updated(prev);
      fetch("/api/reorderTasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(resultTasks),
      });
      return resultTasks;
    });
  };

  const boardWidth = Math.min(
    960 + Math.max(columns.length - 3, 0) * 220,
    1400,
  );

  return (
    <div className="kanban-wrapper">
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              className="kanban-board"
              style={{ maxWidth: boardWidth }}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {columns.map((column, index) => (
                <Draggable
                  draggableId={column.key}
                  index={index}
                  key={column.key}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`kanban-column${
                        snapshot.isDragging ? " dragging" : ""
                      }`}
                    >
                      <h3 style={{ backgroundColor: column.color }}>
                        {column.title}
                        {!INITIAL_COLUMN_KEYS.includes(column.key) && (
                          <button
                            className="delete-column-btn"
                            aria-label={`Remover coluna ${column.title}`}
                            onClick={() => deleteColumn(column.key)}
                          >
                            &times;
                          </button>
                        )}
                      </h3>
                      <Droppable droppableId={column.key} type="TASK">
                        {(dropProvided, dropSnapshot) => (
                          <ul
                            ref={dropProvided.innerRef}
                            {...dropProvided.droppableProps}
                            className={
                              dropSnapshot.isDraggingOver ? "drag-over" : ""
                            }
                          >
                            {tasks
                              .filter((task) => task.status === column.key)
                              .map((task, idx) => (
                                <Draggable
                                  draggableId={task.id.toString()}
                                  index={idx}
                                  key={task.id}
                                >
                                  {(dragProvided, dragSnapshot) => (
                                    <li
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      className={`kanban-task${dragSnapshot.isDragging ? " dragging" : ""}`}
                                      style={{
                                        borderLeft: `4px solid ${column.color}`,
                                        ...dragProvided.draggableProps.style,
                                      }}
                                    >
                                      {editingTaskId === task.id ? (
                                        <input
                                          className="task-input"
                                          value={task.title}
                                          autoFocus
                                          onChange={(e) =>
                                            handleTaskChange(
                                              task.id,
                                              e.target.value,
                                            )
                                          }
                                          onBlur={finishEditing}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                              finishEditing();
                                          }}
                                        />
                                      ) : (
                                        <>
                                          <span
                                            onClick={() =>
                                              startEditing(task.id)
                                            }
                                          >
                                            {task.title || "Nova Tarefa"}
                                          </span>
                                          <button
                                            className="delete-task-btn"
                                            aria-label="Excluir tarefa"
                                            onClick={() => deleteTask(task.id)}
                                          >
                                            &times;
                                          </button>
                                        </>
                                      )}
                                    </li>
                                  )}
                                </Draggable>
                              ))}
                            {dropProvided.placeholder}
                            <li className="add-task-item">
                              <button
                                className="add-task-btn"
                                aria-label="Adicionar tarefa"
                                onClick={() => addTask(column.key)}
                              >
                                +
                              </button>
                            </li>
                          </ul>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
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
        <button type="submit" disabled={columns.length >= MAX_COLUMNS}>
          Adicionar Coluna
        </button>
      </form>
    </div>
  );
}

export default KanbanBoard;
