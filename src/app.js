const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const routes = require('./routes');

const app = express();

// Allow all origins (no cookies needed; JWT is sent via Authorization header)
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'studybridge-backend' });
});

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
