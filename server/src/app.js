const cors = require('cors');
const express = require('express');
const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Make the database pool available to route handlers through the Express app.
app.locals.db = pool;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/auth', authRoutes);

app.get('/api/health', (request, response) => {
  response.status(200).json({
    status: 'ok',
    message: 'Sweety backend is running',
  });
});

module.exports = app;
