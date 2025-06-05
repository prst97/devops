const express = require('express');
const router = express.Router();

let columns = [
  { key: 'todo', title: 'To Do', color: '#e6f4ff' },
  { key: 'doing', title: 'Em Progresso', color: '#fff8e6' },
  { key: 'done', title: 'Concluído', color: '#e6ffe6' },
];

let tasks = [
  { id: 1, title: 'Configurar projeto', status: 'todo', color: '#e6f4ff' },
  { id: 2, title: 'Criar componentes', status: 'doing', color: '#fff8e6' },
  { id: 3, title: 'Testar aplicação', status: 'done', color: '#e6ffe6' },
];

// Health check
router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

// Retrieve all tasks
router.get('/tasks', (req, res) => {
  res.json(tasks);
});

// Create a new task
router.post('/tasks', (req, res) => {
  const { id, title, status } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Task id required' });
  }
  const column = columns.find((c) => c.key === (status || 'todo'));
  const color = column ? column.color : '#eef2f7';
  const task = { id, title: title || '', status: status || 'todo', color };
  tasks.push(task);
  res.status(201).json(task);
});

// Update a task
router.put('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  const { title, status } = req.body;
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (title !== undefined) task.title = title;
  if (status !== undefined) {
    task.status = status;
    const column = columns.find((c) => c.key === status);
    if (column) task.color = column.color;
  }
  res.json(task);
});

// Delete a task
router.delete('/tasks/:id', (req, res) => {
  const taskId = parseInt(req.params.id);
  tasks = tasks.filter((t) => t.id !== taskId);
  res.status(204).end();
});

// Retrieve all columns
router.get('/columns', (req, res) => {
  res.json(columns);
});

// Create a new column
router.post('/columns', (req, res) => {
  const { title, color } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const column = {
    key: `col_${Date.now()}`,
    title,
    color: color || '#eef2f7',
  };
  columns.push(column);
  res.status(201).json(column);
});

// Update a column
router.put('/columns/:key', (req, res) => {
  const { key } = req.params;
  const { title, color } = req.body;
  const column = columns.find((c) => c.key === key);
  if (!column) return res.status(404).json({ error: 'Column not found' });
  if (title !== undefined) column.title = title;
  if (color !== undefined) {
    column.color = color;
    // update tasks belonging to this column with new color
    tasks.forEach((t) => {
      if (t.status === key) t.color = color;
    });
  }
  res.json(column);
});

// Delete a column and its tasks
router.delete('/columns/:key', (req, res) => {
  const { key } = req.params;
  if (!columns.some((c) => c.key === key)) {
    return res.status(404).json({ error: 'Column not found' });
  }
  columns = columns.filter((c) => c.key !== key);
  tasks = tasks.filter((t) => t.status !== key);
  res.status(204).end();
});

module.exports = router;