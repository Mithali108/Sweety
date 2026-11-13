const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const SALT_ROUNDS = 12;

function createToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '7d',
    },
  );
}

async function register(request, response) {
  const { email: submittedEmail, password } = request.body || {};
  const email = typeof submittedEmail === 'string'
    ? submittedEmail.trim().toLowerCase()
    : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response.status(400).json({ message: 'Please provide a valid email address.' });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return response.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');
    return response.status(500).json({ message: 'Server authentication is not configured.' });
  }

  try {
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    if (existingUser.rows.length > 0) {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Store only the hash, never the original password.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash],
    );

    const user = result.rows[0];
    const token = createToken(user);

    return response.status(201).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    // The unique constraint also handles two simultaneous registrations.
    if (error.code === '23505') {
      return response.status(409).json({ message: 'An account with this email already exists.' });
    }

    console.error('Registration failed:', error.message);
    return response.status(500).json({ message: 'Could not register the account.' });
  }
}

async function login(request, response) {
  const { email: submittedEmail, password } = request.body || {};
  const email = typeof submittedEmail === 'string'
    ? submittedEmail.trim().toLowerCase()
    : '';

  if (!email || typeof password !== 'string') {
    return response.status(400).json({ message: 'Email and password are required.' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured.');
    return response.status(500).json({ message: 'Server authentication is not configured.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email],
    );

    if (result.rows.length === 0) {
      return response.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return response.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = createToken(user);

    return response.status(200).json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    return response.status(500).json({ message: 'Could not log in.' });
  }
}

module.exports = { register, login };
