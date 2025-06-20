const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const client = require('prom-client');
const path = require('path');
const bodyParser = require('body-parser');
const os = require('os');
const slugify = require('slugify');

const app = express();

const corsOrigin = process.env.CORS_ORIGIN || '';
if (corsOrigin) {
  app.use(cors({ origin: corsOrigin.split(','), credentials: true }));
} else {
  app.use(cors());
}

const register = new client.Registry();
const port = process.env.PORT || 3000;
const hostname = os.hostname();

client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de requisi\u00e7\u00f5es HTTP recebidas',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestCounter);

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.path,
      status_code: res.statusCode
    });
  });
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

const pgUri = process.env.POSTGRES_URI || 'postgres://kanban_user:kanban_pass@localhost:5432/kanban';
const pool = new Pool({ connectionString: pgUri });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS columns (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(64) NOT NULL UNIQUE,
      color VARCHAR(32) NOT NULL,
      ord INTEGER NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      ord INTEGER NOT NULL
    );
  `);

  // Popular colunas iniciais se vazio
  const { rows: colRows } = await pool.query('SELECT COUNT(*) FROM columns');
  if (parseInt(colRows[0].count, 10) === 0) {
    // inserir colunas (ordem: 1, 2, 3)
    const initialColumns = [
      { title: 'To Do', slug: 'todo', color: '#e6f4ff', ord: 1 },
      { title: 'Em Progresso', slug: 'doing', color: '#fff8e6', ord: 2 },
      { title: 'Concluído', slug: 'done', color: '#e6ffe6', ord: 3 },
    ];
    for (const col of initialColumns) {
      await pool.query(
        'INSERT INTO columns (title, slug, color, ord) VALUES ($1, $2, $3, $4)',
        [col.title, col.slug, col.color, col.ord]
      );
    }
  }

  // Popular tasks iniciais se vazio
  const { rows: taskRows } = await pool.query('SELECT COUNT(*) FROM tasks');
  if (parseInt(taskRows[0].count, 10) === 0) {

    const { rows: cols } = await pool.query('SELECT id, slug FROM columns ORDER BY ord ASC');
    const slugToId = Object.fromEntries(cols.map((c) => [c.slug, c.id]));
    const initialTasks = [
      { title: 'Configurar projeto', slug: 'todo' },
      { title: 'Criar componentes', slug: 'doing' },
      { title: 'Testar aplicação', slug: 'done' },
    ];
    let taskOrd = {};
    for (const t of initialTasks) {
      const cid = slugToId[t.slug];
      taskOrd[cid] = (taskOrd[cid] || 0) + 1;
      await pool.query(
        'INSERT INTO tasks (title, column_id, ord) VALUES ($1, $2, $3)',
        [t.title, cid, taskOrd[cid]]
      );
    }
  }
}

// ROTAS

app.get('/api', (req, res) => res.json({ status: 'ok' }));

// Get todas as columns ordenadas
app.get('/api/columns', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, title, slug, color, ord FROM columns ORDER BY ord ASC'
  );
  res.json(rows);
});

// Criar coluna única
app.post('/api/columns', async (req, res) => {
  let { title, slug, color } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  slug = slug ? slugify(slug, { lower: true }) : slugify(title, { lower: true });
  color = color || '#eef2f7';
  const { rows: ordRows } = await pool.query('SELECT COALESCE(MAX(ord), 0) as max FROM columns');
  const ord = (ordRows[0].max || 0) + 1;

  try {
    const result = await pool.query(
      'INSERT INTO columns (title, slug, color, ord) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, slug, color, ord]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') { // nome duplicado
      res.status(400).json({ error: 'Slug must be unique' });
    } else {
      res.status(500).json({ error: 'Error creating column' });
    }
  }
});

// Atualizar coluna por id
app.put('/api/columns/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, color } = req.body;
  let set = [];
  let params = [];
  if (title !== undefined) {
    params.push(title);
    set.push(`title = $${params.length}`);
  }
  if (color !== undefined) {
    params.push(color);
    set.push(`color = $${params.length}`);
  }
  if (!set.length) return res.status(400).json({ error: 'No updates' });
  params.push(id);
  const sql = `UPDATE columns SET ${set.join(', ')} WHERE id = $${params.length} RETURNING *`;
  const result = await pool.query(sql, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Column not found' });
  res.json(result.rows[0]);
});

// Reordenar colunas (sobrescreve ordem)
app.put('/api/reorderColumns', async (req, res) => {
  const cols = req.body;
  if (!Array.isArray(cols)) return res.status(400).json({ error: 'Invalid payload' });
  for (let i = 0; i < cols.length; ++i) {
    await pool.query(
      'UPDATE columns SET ord = $1 WHERE id = $2',
      [i + 1, cols[i].id]
    );
  }
  const { rows } = await pool.query(
    'SELECT id, title, slug, color, ord FROM columns ORDER BY ord ASC'
  );
  res.json(rows);
});

// Apagar coluna por id
app.delete('/api/columns/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  await pool.query('DELETE FROM columns WHERE id = $1', [id]);
  res.status(204).end();
});

// Get todas as tasks
app.get('/api/tasks', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      t.id,
      t.title,
      t.column_id,
      t.ord,
      c.slug as column_slug,
      c.title as column_title,
      c.color as color
    FROM tasks t
    JOIN columns c ON t.column_id = c.id
    ORDER BY t.column_id ASC, t.ord ASC
  `);
  res.json(rows);
});

// Criar task (precisa column_id OU slug)
app.post('/api/tasks', async (req, res) => {
  let { title, column_id, slug } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title required' });

  // Se veio slug, resolve id
  if (!column_id && slug) {
    const col = await pool.query('SELECT id FROM columns WHERE slug = $1', [slug]);
    if (!col.rows[0]) return res.status(400).json({ error: 'Invalid column slug' });
    column_id = col.rows[0].id;
  }
  if (!column_id) {
    // default: primeira coluna
    const col = await pool.query('SELECT id FROM columns ORDER BY ord ASC LIMIT 1');
    if (!col.rows[0]) return res.status(400).json({ error: 'No columns available' });
    column_id = col.rows[0].id;
  }
  // qual próxima ordem dentro da coluna
  const { rows: ordRows } = await pool.query(
    'SELECT COALESCE(MAX(ord), 0) AS max FROM tasks WHERE column_id = $1', [column_id]
  );
  const ord = (ordRows[0].max || 0) + 1;

  const result = await pool.query(
    'INSERT INTO tasks (title, column_id, ord) VALUES ($1, $2, $3) RETURNING *',
    [title, column_id, ord]
  );
  // Retorna task + dados coluna
  const task = result.rows[0];
  const col = await pool.query('SELECT slug, title, color FROM columns WHERE id = $1', [task.column_id]);
  res.status(201).json({ ...task, color:col.rows[0].color });
});

// Atualizar task (por id)
app.put('/api/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, column_id, slug } = req.body;
  let set = [];
  let params = [];
  if (title !== undefined) {
    params.push(title);
    set.push(`title = $${params.length}`);
  }
  if (column_id !== undefined) {
    params.push(column_id);
    set.push(`column_id = $${params.length}`);
  } else if (slug !== undefined) {
    const col = await pool.query('SELECT id FROM columns WHERE slug = $1', [slug]);
    if (!col.rows[0]) return res.status(400).json({ error: 'Invalid column slug' });
    params.push(col.rows[0].id);
    set.push(`column_id = $${params.length}`);
  }
  if (!set.length) return res.status(400).json({ error: 'No updates' });
  params.push(id);
  const sql = `UPDATE tasks SET ${set.join(', ')} WHERE id = $${params.length} RETURNING *`;
  const result = await pool.query(sql, params);
  if (!result.rows[0]) return res.status(404).json({ error: 'Task not found' });
  // retorna task + dados coluna
  const task = result.rows[0];
  const col = await pool.query('SELECT slug, title, color FROM columns WHERE id = $1', [task.column_id]);
  res.json({ ...task, ...col.rows[0] });
});

// Reordenar as tasks (recebe [{id, column_id, title, ord}], atualiza ordem e coluna de cada)
app.put('/api/reorderTasks', async (req, res) => {
  const tasks = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'Invalid payload' });
  // atualiza cada task com seu column_id e ordem
  for (const t of tasks) {
    await pool.query(
      'UPDATE tasks SET column_id = $1, ord = $2 WHERE id = $3',
      [t.column_id, t.ord, t.id]
    );
  }

  const { rows } = await pool.query(`
    SELECT
      t.id,
      t.title,
      t.column_id,
      t.ord,
      c.slug as column_slug,
      c.title as column_title,
      c.color as color
    FROM tasks t
    JOIN columns c ON t.column_id = c.id
    ORDER BY t.column_id ASC, t.ord ASC
  `);
  res.json(rows);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  res.status(204).end();
});

// Metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

initDb().then(() => {
  app.listen(port, () => {
    console.log('listening on port:' + port);
  });
}).catch(err => {
  console.error('Erro ao inicializar o banco', err);
  process.exit(1);
});
