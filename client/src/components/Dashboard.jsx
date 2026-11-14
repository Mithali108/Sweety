import { useEffect, useState } from 'react';
import { api } from '../services/api';

const TIME_SLOTS = [
  { value: 'morning_fasting', label: 'Morning Fasting' },
  { value: 'after_breakfast', label: 'After Breakfast' },
  { value: 'after_lunch', label: 'After Lunch' },
  { value: 'after_dinner', label: 'After Dinner' },
];

function localDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function blankReading() {
  return {
    reading_date: localDateString(),
    time_slot: TIME_SLOTS[0].value,
    glucose_level: '',
    notes: '',
  };
}

function normalizeReadings(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  return Array.isArray(payload?.readings) ? payload.readings : [];
}

function normalizeStats(value = {}) {
  const report = value || {};
  const stats = report.stats || report;
  return {
    count: Number(stats.count) || 0,
    average: stats.average === null || stats.average === undefined
      ? null
      : Number(stats.average),
    min: stats.min === null || stats.min === undefined ? null : Number(stats.min),
    max: stats.max === null || stats.max === undefined ? null : Number(stats.max),
  };
}

function formatDate(dateString) {
  if (!dateString) {
    return '—';
  }

  const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) {
    return String(dateString);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatTimeSlot(value) {
  return TIME_SLOTS.find((slot) => slot.value === value)?.label || value;
}

function glucoseStatus(value) {
  if (value < 70) {
    return { label: 'Below range', className: 'status-amber' };
  }
  if (value <= 140) {
    return { label: 'In range', className: 'status-green' };
  }
  return { label: 'Above range', className: 'status-red' };
}

function SummaryCard({ title, date, stats, icon, tone }) {
  return (
    <article className={`summary-card summary-${tone}`}>
      <div className="summary-card-heading">
        <div>
          <p className="summary-label">{title}</p>
          {date && <p className="summary-date">{formatDate(date)}</p>}
        </div>
        <span className="summary-icon" aria-hidden="true">{icon}</span>
      </div>
      <div className="summary-average">
        <span className="summary-number">
          {stats.average === null ? '—' : stats.average}
        </span>
        <span className="summary-unit">mg/dL avg</span>
      </div>
      <div className="summary-details">
        <div>
          <span className="detail-label">Min / max</span>
          <strong>
            {stats.min === null || stats.max === null
              ? '—'
              : `${stats.min} / ${stats.max}`}
          </strong>
        </div>
        <div>
          <span className="detail-label">Readings</span>
          <strong>{stats.count}</strong>
        </div>
      </div>
    </article>
  );
}

function Dashboard({ onLogout }) {
  const [readings, setReadings] = useState([]);
  const [reports, setReports] = useState(null);
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [form, setForm] = useState(blankReading);
  const [editingId, setEditingId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([
      api.readings.list({ date: dateFilter, month: monthFilter }),
      api.readings.reports(),
    ])
      .then(([readingPayload, reportPayload]) => {
        if (!active) {
          return;
        }

        const daily = reportPayload?.daily || {};
        setReadings(normalizeReadings(readingPayload));
        setReports({
          daily: {
            date: daily.date || localDateString(),
            stats: normalizeStats(daily),
          },
          monthToDate: normalizeStats(reportPayload?.monthToDate),
          previousMonth: normalizeStats(reportPayload?.previousMonth),
        });
      })
      .catch((error) => {
        if (active) {
          setLoadError(error.message || 'Could not load your readings.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [dateFilter, monthFilter, refreshKey]);

  function updateForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setLoadError('');
    setIsSaving(true);

    const reading = {
      ...form,
      glucose_level: Number(form.glucose_level),
      notes: form.notes.trim(),
    };

    try {
      if (editingId === null) {
        await api.readings.create(reading);
      } else {
        await api.readings.update(editingId, reading);
      }
      setForm(blankReading());
      setEditingId(null);
      setIsLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setFormError(error.message || 'Could not save this reading.');
    } finally {
      setIsSaving(false);
    }
  }

  function beginEdit(reading) {
    setForm({
      reading_date: String(reading.reading_date).slice(0, 10),
      time_slot: reading.time_slot,
      glucose_level: String(reading.glucose_level),
      notes: reading.notes || '',
    });
    setEditingId(reading.id);
    setFormError('');
    document.getElementById('reading-form')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(blankReading());
    setFormError('');
  }

  async function deleteReading(reading) {
    if (!window.confirm('Delete this glucose reading? This cannot be undone.')) {
      return;
    }

    setDeletingId(reading.id);
    setLoadError('');
    try {
      await api.readings.remove(reading.id);
      if (editingId === reading.id) {
        cancelEdit();
      }
      setIsLoading(true);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setLoadError(error.message || 'Could not delete this reading.');
    } finally {
      setDeletingId(null);
    }
  }

  function clearFilters() {
    if (dateFilter || monthFilter) {
      setIsLoading(true);
      setLoadError('');
    }
    setDateFilter('');
    setMonthFilter('');
  }

  const today = localDateString();

  return (
    <div className="dashboard-page">
      <header className="topbar">
        <a className="topbar-brand" href="/" aria-label="Sweety home">
          <span className="brand-mark brand-mark-small" aria-hidden="true">
            <span className="brand-drop" />
            <span className="brand-pulse">♥</span>
          </span>
          <span>
            <strong>Sweety</strong>
            <small>Blood Glucose Tracker</small>
          </span>
        </a>
        <div className="topbar-actions">
          <span className="account-label">Your personal health dashboard</span>
          <button className="button button-secondary logout-button" onClick={onLogout} type="button">
            Log out
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">YOUR DAILY OVERVIEW</p>
            <h1>Your glucose, at a glance.</h1>
            <p className="welcome-copy">
              A simple, secure place to understand your readings over time.
            </p>
          </div>
          <div className="today-chip">
            <span className="today-dot" />
            Today · {formatDate(today)}
          </div>
        </section>

        {loadError && <div className="alert alert-error" role="alert">{loadError}</div>}

        <section className="summary-grid" aria-label="Glucose summaries">
          <SummaryCard
            date={reports?.daily.date || today}
            icon="◷"
            stats={reports?.daily.stats || normalizeStats()}
            title="Today's report"
            tone="coral"
          />
          <SummaryCard
            icon="▤"
            stats={reports?.monthToDate || normalizeStats()}
            title="Month to date"
            tone="mint"
          />
          <SummaryCard
            icon="↗"
            stats={reports?.previousMonth || normalizeStats()}
            title="Previous month"
            tone="lavender"
          />
        </section>

        <div className="content-grid">
          <section className="panel reading-panel" id="reading-form">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{editingId === null ? 'NEW ENTRY' : 'UPDATE ENTRY'}</p>
                <h2>{editingId === null ? 'Add a reading' : 'Edit reading'}</h2>
              </div>
              <span className="panel-symbol" aria-hidden="true">＋</span>
            </div>
            <p className="panel-description">
              Record a reading to keep your history up to date.
            </p>

            <form className="reading-form" onSubmit={handleSubmit}>
              {formError && <div className="alert alert-error" role="alert">{formError}</div>}
              <label className="field-label" htmlFor="reading-date">Date</label>
              <input
                className="text-input"
                id="reading-date"
                max={today}
                name="reading_date"
                onChange={updateForm}
                required
                type="date"
                value={form.reading_date}
              />

              <label className="field-label" htmlFor="reading-time">Time slot</label>
              <select
                className="text-input"
                id="reading-time"
                name="time_slot"
                onChange={updateForm}
                required
                value={form.time_slot}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot.value} value={slot.value}>{slot.label}</option>
                ))}
              </select>

              <label className="field-label" htmlFor="glucose-level">Glucose level</label>
              <div className="number-input-wrap">
                <input
                  className="text-input"
                  id="glucose-level"
                  max="600"
                  min="40"
                  name="glucose_level"
                  onChange={updateForm}
                  placeholder="e.g. 105"
                  required
                  type="number"
                  value={form.glucose_level}
                />
                <span>mg/dL</span>
              </div>

              <label className="field-label" htmlFor="reading-notes">
                Notes <span className="optional-label">Optional</span>
              </label>
              <input
                className="text-input"
                id="reading-notes"
                name="notes"
                onChange={updateForm}
                placeholder="Add a note about this reading"
                type="text"
                value={form.notes}
              />

              <div className="form-actions">
                <button className="button button-primary" disabled={isSaving} type="submit">
                  {isSaving ? 'Saving…' : editingId === null ? 'Save reading' : 'Update reading'}
                </button>
                {editingId !== null && (
                  <button className="button button-secondary" onClick={cancelEdit} type="button">
                    Cancel
                  </button>
                )}
              </div>
            </form>
            <p className="form-hint">Readings are private and saved to your account.</p>
          </section>

          <section className="panel history-panel">
            <div className="panel-heading history-heading">
              <div>
                <p className="eyebrow">YOUR RECORD</p>
                <h2>Reading history</h2>
              </div>
              <span className="reading-count">
                {readings.length} {readings.length === 1 ? 'reading' : 'readings'}
              </span>
            </div>

            <div className="filter-bar">
              <label className="filter-field">
                <span>Date</span>
                <input
                  aria-label="Filter readings by date"
                  className="filter-input"
                  onChange={(event) => {
                    setIsLoading(true);
                    setLoadError('');
                    setDateFilter(event.target.value);
                    setMonthFilter('');
                  }}
                  type="date"
                  value={dateFilter}
                />
              </label>
              <label className="filter-field">
                <span>Month</span>
                <input
                  aria-label="Filter readings by month"
                  className="filter-input"
                  onChange={(event) => {
                    setIsLoading(true);
                    setLoadError('');
                    setMonthFilter(event.target.value);
                    setDateFilter('');
                  }}
                  type="month"
                  value={monthFilter}
                />
              </label>
              <button className="clear-filter" onClick={clearFilters} type="button">
                Clear filter
              </button>
            </div>

            <div className="table-scroll">
              <table className="readings-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Time slot</th>
                    <th scope="col">Glucose</th>
                    <th scope="col">Notes</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td className="empty-state" colSpan="5">Loading your readings…</td></tr>
                  ) : readings.length === 0 ? (
                    <tr>
                      <td className="empty-state" colSpan="5">
                        <span className="empty-icon" aria-hidden="true">◌</span>
                        <strong>No readings found</strong>
                        <span>Add a reading or adjust your filters.</span>
                      </td>
                    </tr>
                  ) : readings.map((reading) => {
                    const status = glucoseStatus(Number(reading.glucose_level));
                    return (
                      <tr key={reading.id}>
                        <td className="date-cell">{formatDate(reading.reading_date)}</td>
                        <td>{formatTimeSlot(reading.time_slot)}</td>
                        <td>
                          <span className={`status-pill ${status.className}`}>
                            <span className="status-dot" />
                            {reading.glucose_level} <span className="status-unit">mg/dL</span>
                          </span>
                        </td>
                        <td className="notes-cell" title={reading.notes || undefined}>
                          {reading.notes || '—'}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              aria-label={`Edit reading from ${formatDate(reading.reading_date)}`}
                              className="row-action"
                              onClick={() => beginEdit(reading)}
                              type="button"
                            >
                              Edit
                            </button>
                            <button
                              aria-label={`Delete reading from ${formatDate(reading.reading_date)}`}
                              className="row-action row-action-delete"
                              disabled={deletingId === reading.id}
                              onClick={() => deleteReading(reading)}
                              type="button"
                            >
                              {deletingId === reading.id ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="table-footnote">Glucose levels are shown in mg/dL.</p>
          </section>
        </div>
        <footer className="dashboard-footer">
          <span>Sweety · Your readings, thoughtfully organized.</span>
          <span>For personal tracking only—not a substitute for medical advice.</span>
        </footer>
      </main>
    </div>
  );
}

export default Dashboard;
