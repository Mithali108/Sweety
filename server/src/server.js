const app = require('./app');
const pool = require('./config/db');

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    // Check the database before accepting requests.
    const result = await pool.query('SELECT NOW()');
    console.log(`Connected to PostgreSQL at ${result.rows[0].now}`);

    app.listen(port, () => {
      console.log(`Sweety backend is listening on port ${port}`);
    });
  } catch (error) {
    console.error('Could not connect to PostgreSQL:', error.message);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();
