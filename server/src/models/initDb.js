const pool = require('../config/db');

async function initializeDatabase() {
  try {
    // Create users first because glucose_readings refers to users.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // The foreign key requires an existing user. CASCADE deletes that user's
    // readings automatically if the user account is deleted.
    // CHECK constraints limit slots and glucose values; UNIQUE prevents a user
    // from saving two readings in the same slot on the same date.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS glucose_readings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reading_date DATE NOT NULL,
        time_slot TEXT NOT NULL CHECK (
          time_slot IN (
            'morning_fasting',
            'after_breakfast',
            'after_lunch',
            'after_dinner'
          )
        ),
        glucose_level INTEGER NOT NULL CHECK (glucose_level BETWEEN 40 AND 600),
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, reading_date, time_slot)
      )
    `);

    console.log('Database tables are ready.');
  } catch (error) {
    console.error('Could not initialize database tables:', error.message);
    process.exitCode = 1;
  } finally {
    // Close the pool so this one-time script can exit.
    await pool.end();
  }
}

initializeDatabase();
