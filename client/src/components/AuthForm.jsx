import { useState } from 'react';
import { api } from '../services/api';

function AuthForm({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegistering = mode === 'register';

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const result = isRegistering
        ? await api.auth.register({ email, password })
        : await api.auth.login({ email, password });

      if (typeof result?.token !== 'string' || !result.token) {
        throw new Error('The server did not return an authentication token.');
      }

      window.localStorage.setItem('token', result.token);
      onAuthenticated();
    } catch (requestError) {
      setError(requestError.message || 'Could not authenticate. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError('');
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand-drop" />
          <span className="brand-pulse">♥</span>
        </div>
        <p className="eyebrow">YOUR HEALTH, IN FOCUS</p>
        <h1 id="auth-title">{isRegistering ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-description">
          {isRegistering
            ? 'Start keeping a clear record of your glucose readings.'
            : 'Sign in to review and manage your glucose readings.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Account options">
          <button
            className={mode === 'login' ? 'auth-tab active' : 'auth-tab'}
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => changeMode('login')}
          >
            Sign in
          </button>
          <button
            className={mode === 'register' ? 'auth-tab active' : 'auth-tab'}
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => changeMode('register')}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <label className="field-label" htmlFor="auth-email">Email address</label>
          <input
            autoComplete="email"
            className="text-input"
            id="auth-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />

          <label className="field-label" htmlFor="auth-password">Password</label>
          <input
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            className="text-input"
            id="auth-password"
            minLength={isRegistering ? 8 : undefined}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isRegistering ? 'At least 8 characters' : 'Enter your password'}
            required
            type="password"
            value={password}
          />

          <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? 'Please wait…'
              : isRegistering
                ? 'Create account'
                : 'Sign in'}
          </button>
        </form>

        <p className="auth-footnote">
          {isRegistering ? 'Already have an account?' : 'New to Sweety?'}
          {' '}
          <button
            className="text-button"
            onClick={() => changeMode(isRegistering ? 'login' : 'register')}
            type="button"
          >
            {isRegistering ? 'Sign in' : 'Create an account'}
          </button>
        </p>
        <p className="privacy-note">Your health information is private to your account.</p>
      </section>
    </main>
  );
}

export default AuthForm;
