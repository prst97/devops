import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/api";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import "./KanbanBoard.css";

const MAX_COLUMNS = 6;

// id único temporário
let tempId = -1;

function KanbanBoard() {
  const [columns, setColumns] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState("#eef2f7");
  const [error, setError] = useState("");
  const [newTaskIds, setNewTaskIds] = useState([]); // ids temporários de tasks não salvas
  const inputRef = useRef(null);

  // Carrega colunas e tarefas
  const fetchAll = async () => {
    try {
      const [colsRes, tasksRes] = await Promise.all([
        apiFetch("/api/columns"),
        apiFetch("/api/tasks")
      ]);
      if (!colsRes.ok) throw new Error("Falha ao carregar colunas");
      if (!tasksRes.ok) throw new Error("Falha ao carregar tarefas");
      const cols = await colsRes.json();
      const tsks = await tasksRes.json();
      setColumns(cols);
      setTasks(tsks);
      setError("");
      setNewTaskIds([]); // limpa tasks temporárias ao recarregar
    } catch (e) {
      setColumns([]);
      setTasks([]);
      setError("Erro ao conectar com o servidor.");
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, []);

  // Adiciona uma nova task
  const addTask = (column) => {
    // encontra próxima ordem na coluna
    const ord =
      (tasks.filter((t) => t.column_id === column.id).reduce((max, t) => Math.max(max, t.ord || 0), 0) || 0) + 1;
    const localId = tempId--; // id temporario sempre valor negativo
    const newTask = {
      id: localId,
      title: "Nova Tarefa",
      column_id: column.id,
      ord,
      _new: true // marca como nova (nao salva no banco)
    };
    setTasks((prev) => [...prev, newTask]);
    setNewTaskIds((prev) => [...prev, localId]);
    setEditingTaskId(localId);
  };

  const removeNewTask = (id) => {
    setTasks((tasks) => tasks.filter((t) => t.id !== id));
    setNewTaskIds((ids) => ids.filter((i) => i !== id));
    setEditingTaskId(null);
  };

  const deleteTask = async (id) => {
    // Se for task nova, só remove local
    if (newTaskIds.includes(id)) {
      removeNewTask(id);
      return;
    }
    try {
      // Remove uma task que existe no banco
      const res = await apiFetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError("Erro ao excluir tarefa");
        return;
      }
      setTasks((tasks) => tasks.filter((t) => t.id !== id));
      setError("");
    } catch {
      setError("Erro ao excluir tarefa");
    }
  };

  const startEditing = (id) => setEditingTaskId(id);

  const handleTaskChange = (id, value) => {
    setTasks((tasks) =>
      tasks.map((t) => (t.id === id ? { ...t, title: value } : t))
    );
  };

  const finishEditing = async () => {
    const task = tasks.find((t) => t.id === editingTaskId);
    if (!task) {
      setEditingTaskId(null);
      return;
    }
    const title = task.title.trim();
    if (!title) {
      // tasks sem nome não salva, apaga se for nova
      if (newTaskIds.includes(task.id)) removeNewTask(task.id);
      setEditingTaskId(null);
      return;
    }
    // Salva nova task no banco
    if (newTaskIds.includes(task.id)) {
      try {
        const res = await apiFetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: task.title,
            column_id: task.column_id
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Erro ao criar tarefa");
          return;
        }
        const newTaskSaved = await res.json();

        setTasks((tasks) =>
          tasks.map((t) =>
            t.id === task.id ? { ...newTaskSaved } : t
          )
        );
        setNewTaskIds((ids) => ids.filter((i) => i !== task.id));
        setError("");
      } catch (err) {
        setError("Erro ao criar tarefa");
      }
    } else {
      // Atualizar task que já existe no banco
      try {
        const res = await apiFetch(`/api/tasks/${task.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: task.title }),
        });
        if (!res.ok) setError("Erro ao editar tarefa");
        else setError("");
      } catch {
        setError("Erro ao editar tarefa");
      }
    }
    setEditingTaskId(null);
  };

  // Lida com teclas no input (ESC, ENTER, TAB, etc)
  const handleInputKeyDown = (e, id, isNew) => {
    if (e.key === "Enter" || e.key === "Tab") {
      finishEditing();
    } else if (e.key === "Escape") {
      if (isNew) removeNewTask(id);
      else setEditingTaskId(null);
    }
  };

  // Remove coluna (e suas tasks)
  const deleteColumn = async (column) => {
    if (column.slug === "todo" || column.slug === "doing" || column.slug === "done") return;
    try {
      const res = await apiFetch(`/api/columns/${column.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError("Erro ao excluir coluna");
        return;
      }
      setColumns((cols) => cols.filter((col) => col.id !== column.id));
      setTasks((ts) => ts.filter((t) => t.column_id !== column.id));
      setError("");
    } catch {
      setError("Erro ao excluir coluna");
    }
  };

  // Adiciona uma coluna
  const addColumn = async (e) => {
    e.preventDefault();
    setError("");
    if (!newTitle.trim() || columns.length >= MAX_COLUMNS) return;
    if (columns.some(col => col.title === newTitle.trim())) {
      setError("Título de coluna já existe");
      return;
    }
    try {
      const res = await apiFetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), color: newColor }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Erro ao criar coluna");
        return;
      }
      const newCol = await res.json();
      setColumns((prev) => [...prev, newCol]);
      setNewTitle("");
      setNewColor("#eef2f7");
      setError("");
    } catch {
      setError("Erro ao criar coluna");
    }
  };

  // Reordena lista
  const reorder = (list, startIndex, endIndex) => {
    const result = Array.from(list);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result;
  };

  // DRAG pra coluna ou task
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, type } = result;

    // Colunas
    if (type === "COLUMN") {
      if (source.index === destination.index) return;
      setColumns((prev) => {
        const updatedCols = reorder(prev, source.index, destination.index);
        apiFetch("/api/reorderColumns", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedCols.map((c, idx) => ({
            ...c, ord: idx + 1
          }))),
        }).catch(() => setError("Erro ao reordenar colunas"));
        return updatedCols;
      });
      return;
    }

    // Tasks
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) return;

    setTasks((prev) => {
      // agrupa por column_id
      const tasksByColId = {};
      prev.forEach((t) => {
        if (!tasksByColId[t.column_id]) tasksByColId[t.column_id] = [];
        tasksByColId[t.column_id].push({ ...t });
      });
      const fromCol = columns.find(col => String(col.id) === source.droppableId);
      const toCol = columns.find(col => String(col.id) === destination.droppableId);
      if (!fromCol || !toCol) return prev;

      // Remove da lista da coluna origem
      const [moved] = tasksByColId[fromCol.id].splice(source.index, 1);
      moved.column_id = toCol.id; // muda de coluna se arrastou

      // Insere na coluna destino
      if (!tasksByColId[toCol.id]) tasksByColId[toCol.id] = [];
      tasksByColId[toCol.id].splice(destination.index, 0, moved);

      // Gera tasks ordenadas por coluna/ordem para atualizar no backend
      let ordered = [];
      columns.forEach((col) => {
        if (tasksByColId[col.id]) {
          tasksByColId[col.id].forEach((t, idx) => {
            t.ord = idx + 1;
            ordered.push(t);
          });
        }
      });

      apiFetch("/api/reorderTasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          ordered
            .filter((t) => !newTaskIds.includes(t.id))
            .map(({ id, column_id, title, ord }) => ({
              id, column_id, title, ord
            }))
        ),
      }).catch(() => setError("Erro ao reordenar tarefas"));

      return ordered;
    });
  };

  const boardWidth = Math.min(
    960 + Math.max(columns.length - 3, 0) * 220,
    1400,
  );

  return (
    <div className="kanban-wrapper">
      {error && (
        <div style={{ color: "#b40000", background: "#ffecec", padding: 10, marginBottom: 10, borderRadius: 6 }}>
          {error}
        </div>
      )}
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
                  draggableId={String(column.id)}
                  index={index}
                  key={column.id}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`kanban-column${snapshot.isDragging ? " dragging" : ""}`}
                    >
                      <h3 style={{ backgroundColor: column.color }}>
                        {column.title}
                        {!(["todo", "doing", "done"].includes(column.slug)) && (
                          <button
                            className="delete-column-btn"
                            aria-label={`Remover coluna ${column.title}`}
                            onClick={() => deleteColumn(column)}
                          >
                            &times;
                          </button>
                        )}
                      </h3>
                      <Droppable droppableId={String(column.id)} type="TASK">
                        {(dropProvided, dropSnapshot) => (
                          <ul
                            ref={dropProvided.innerRef}
                            {...dropProvided.droppableProps}
                            className={dropSnapshot.isDraggingOver ? "drag-over" : ""}
                          >
                            {tasks
                              .filter((task) => task.column_id === column.id)
                              .sort((a, b) => (a.ord || 0) - (b.ord || 0))
                              .map((task, idx) => (
                                <Draggable
                                  draggableId={String(task.id)}
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
                                          ref={inputRef}
                                          className="task-input"
                                          value={task.title}
                                          autoFocus
                                          onChange={(e) =>
                                            handleTaskChange(task.id, e.target.value)
                                          }
                                          onBlur={finishEditing}
                                          onKeyDown={(e) =>
                                            handleInputKeyDown(e, task.id, newTaskIds.includes(task.id))
                                          }
                                        />
                                      ) : (
                                        <>
                                          <span
                                            onClick={() => startEditing(task.id)}
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
                                onClick={() => addTask(column)}
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
