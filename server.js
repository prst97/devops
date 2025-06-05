const express = require('express');
const client = require('prom-client');
const path = require('path');
const bodyParser = require('body-parser');
const os = require('os');

const app = express();
const register = new client.Registry();
const port = process.env.PORT || 3000;
const hostname = os.hostname();

// Collect default metrics (CPU, Heap, Event Loop)
client.collectDefaultMetrics({ register });

// Custom metric
const httpRequestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total de requisi\u00e7\u00f5es HTTP recebidas',
    labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestCounter);

// Middleware
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

// Serve built React app
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));

// API routes
app.use('/api', require('./controller/controller'));

// Metrics
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
});

// Fallback to index.html for SPA
app.get('/', (req, res) => {
    res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(port, () => {
    console.log('listening on port:' + port);
});