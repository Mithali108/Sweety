require('dotenv').config();

const { Pool } = require('pg');

// Pool manages reusable connections to the PostgreSQL database.
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
});

module.exports = pool;
