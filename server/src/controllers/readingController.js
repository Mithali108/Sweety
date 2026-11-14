const pool = require('../config/db');

const TIME_SLOTS = [
  'morning_fasting',
  'after_breakfast',
  'after_lunch',
  'after_dinner',
];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  return day >= 1 && day <= daysInMonth;
}

function isValidMonthString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }

  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

function isValidGlucoseLevel(value) {
  return Number.isInteger(value) && value >= 40 && value <= 600;
}

function validateReadingFields(body, response) {
  if (!isValidDateString(body.reading_date)) {
    response.status(400).json({ message: 'Please provide a valid reading date.' });
    return false;
  }

  if (body.reading_date > localDateString()) {
    response.status(400).json({ message: 'Reading date cannot be in the future.' });
    return false;
  }

  if (!TIME_SLOTS.includes(body.time_slot)) {
    response.status(400).json({ message: 'Please provide a valid time slot.' });
    return false;
  }

  if (!isValidGlucoseLevel(body.glucose_level)) {
    response.status(400).json({ message: 'Glucose level must be an integer between 40 and 600.' });
    return false;
  }

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    response.status(400).json({ message: 'Notes must be a string.' });
    return false;
  }

  return true;
}

function parseReadingId(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function monthStart(monthString) {
  return `${monthString}-01`;
}

function nextMonthStart(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

function previousMonthStart(monthString) {
  const [year, month] = monthString.split('-').map(Number);
  const previousYear = month === 1 ? year - 1 : year;
  const previousMonth = month === 1 ? 12 : month - 1;
  return `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`;
}

function statsFromRow(row) {
  const average = row.average === null ? null : Number(row.average);
  return {
    count: Number(row.count),
    average: average === null ? null : Math.round(average * 10) / 10,
    min: row.min === null ? null : Number(row.min),
    max: row.max === null ? null : Number(row.max),
  };
}

async function createReading(request, response) {
  const body = request.body || {};
  if (!validateReadingFields(body, response)) {
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO glucose_readings
        (user_id, reading_date, time_slot, glucose_level, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, reading_date, time_slot, glucose_level, notes, created_at`,
      [
        request.user.id,
        body.reading_date,
        body.time_slot,
        body.glucose_level,
        body.notes === undefined ? null : body.notes,
      ],
    );

    return response.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({
        message: 'A reading for this date and time slot already exists',
      });
    }

    console.error('Creating glucose reading failed:', error.message);
    return response.status(500).json({ message: 'Could not create the reading.' });
  }
}

async function getReadings(request, response) {
  const { date, month } = request.query;
  let dateFilter = '';
  let parameters = [request.user.id];

  if (date !== undefined) {
    if (!isValidDateString(date)) {
      return response.status(400).json({ message: 'Please provide a valid date in YYYY-MM-DD format.' });
    }
    dateFilter = ' AND reading_date = $2';
    parameters = [request.user.id, date];
  } else if (month !== undefined) {
    if (!isValidMonthString(month)) {
      return response.status(400).json({ message: 'Please provide a valid month in YYYY-MM format.' });
    }
    dateFilter = ' AND reading_date >= $2 AND reading_date < $3';
    parameters = [request.user.id, monthStart(month), nextMonthStart(month)];
  }

  try {
    const result = await pool.query(
      `SELECT id, user_id, reading_date, time_slot, glucose_level, notes, created_at
       FROM glucose_readings
       WHERE user_id = $1${dateFilter}
       ORDER BY reading_date DESC, created_at DESC`,
      parameters,
    );

    return response.status(200).json(result.rows);
  } catch (error) {
    console.error('Fetching glucose readings failed:', error.message);
    return response.status(500).json({ message: 'Could not fetch readings.' });
  }
}

async function updateReading(request, response) {
  const id = parseReadingId(request.params.id);
  if (id === null) {
    return response.status(400).json({ message: 'Please provide a valid reading ID.' });
  }

  const body = request.body || {};
  if (!validateReadingFields(body, response)) {
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE glucose_readings
       SET glucose_level = $1, time_slot = $2, reading_date = $3, notes = $4
       WHERE id = $5 AND user_id = $6
       RETURNING id, user_id, reading_date, time_slot, glucose_level, notes, created_at`,
      [
        body.glucose_level,
        body.time_slot,
        body.reading_date,
        body.notes === undefined ? null : body.notes,
        id,
        request.user.id,
      ],
    );

    if (result.rows.length === 0) {
      return response.status(404).json({ message: 'Reading not found.' });
    }

    return response.status(200).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({
        message: 'A reading for this date and time slot already exists',
      });
    }

    console.error('Updating glucose reading failed:', error.message);
    return response.status(500).json({ message: 'Could not update the reading.' });
  }
}

async function deleteReading(request, response) {
  const id = parseReadingId(request.params.id);
  if (id === null) {
    return response.status(400).json({ message: 'Please provide a valid reading ID.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM glucose_readings WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, request.user.id],
    );

    if (result.rows.length === 0) {
      return response.status(404).json({ message: 'Reading not found.' });
    }

    return response.status(200).json({ message: 'Reading deleted successfully.' });
  } catch (error) {
    console.error('Deleting glucose reading failed:', error.message);
    return response.status(500).json({ message: 'Could not delete the reading.' });
  }
}

async function getReports(request, response) {
  const today = localDateString();
  const reportDate = request.query.date === undefined ? today : request.query.date;

  if (!isValidDateString(reportDate)) {
    return response.status(400).json({ message: 'Please provide a valid date in YYYY-MM-DD format.' });
  }

  const currentMonth = today.slice(0, 7);
  const firstDayOfMonth = monthStart(currentMonth);
  const firstDayOfPreviousMonth = previousMonthStart(currentMonth);

  try {
    const [dailyResult, monthResult, previousMonthResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS count, AVG(glucose_level) AS average,
                MIN(glucose_level) AS min, MAX(glucose_level) AS max
         FROM glucose_readings
         WHERE user_id = $1 AND reading_date = $2`,
        [request.user.id, reportDate],
      ),
      pool.query(
        `SELECT COUNT(*) AS count, AVG(glucose_level) AS average,
                MIN(glucose_level) AS min, MAX(glucose_level) AS max
         FROM glucose_readings
         WHERE user_id = $1 AND reading_date >= $2 AND reading_date <= $3`,
        [request.user.id, firstDayOfMonth, today],
      ),
      pool.query(
        `SELECT COUNT(*) AS count, AVG(glucose_level) AS average,
                MIN(glucose_level) AS min, MAX(glucose_level) AS max
         FROM glucose_readings
         WHERE user_id = $1 AND reading_date >= $2 AND reading_date < $3`,
        [request.user.id, firstDayOfPreviousMonth, firstDayOfMonth],
      ),
    ]);

    return response.status(200).json({
      daily: statsFromRow(dailyResult.rows[0]),
      monthToDate: statsFromRow(monthResult.rows[0]),
      previousMonth: statsFromRow(previousMonthResult.rows[0]),
    });
  } catch (error) {
    console.error('Fetching glucose reports failed:', error.message);
    return response.status(500).json({ message: 'Could not fetch reports.' });
  }
}

module.exports = {
  createReading,
  getReadings,
  updateReading,
  deleteReading,
  getReports,
};
