import React, { useState } from 'react';
import { logIn, signUp, MIN_PASSWORD_LENGTH } from './auth.js';
import { isDemoMode } from './firebase.js';

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsBusy(true);
    try {
      // On success the app's auth listener takes over and shows the main screen.
      await (isSignup ? signUp(username, password) : logIn(username, password));
    } catch (err) {
      setError(err.message);
      setIsBusy(false);
    }
  };

  const switchMode = () => {
    setMode(isSignup ? 'login' : 'signup');
    setError('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-sm p-8 sm:p-10 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brass font-semibold">New York City</div>
          <h1 className="font-display italic text-5xl text-wine mt-1 mb-3">Top Shelf</h1>
          <p className="font-display italic text-ink-soft">
            {isSignup ? 'Create an account to save your lists and follow friends' : 'Log in to see your saved lists'}
          </p>
        </div>

        {isDemoMode && (
          <div className="mb-4 p-3 bg-brass-light border border-brass/40 rounded-sm text-sm text-ink-soft">
            <strong>Demo mode:</strong> accounts and lists are saved in this browser only.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-username" className="block text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-soft mb-2">Username</label>
            <input
              id="auth-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isSignup ? '3-20 letters, numbers or _' : 'Your username'}
              className="w-full px-4 py-3 bg-white/70 border border-line rounded-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
              required
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-soft mb-2">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
              className="w-full px-4 py-3 bg-white/70 border border-line rounded-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
              required
            />
          </div>

          {isSignup && (
            <div>
              <label htmlFor="auth-confirm" className="block text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-soft mb-2">Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/70 border border-line rounded-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine"
                required
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-wine-light border border-wine/30 rounded-sm text-sm text-wine" role="alert">{error}</div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full bg-wine text-paper py-3 rounded-sm uppercase tracking-[0.18em] text-sm font-semibold hover:bg-wine-dark transition-colors disabled:bg-ink-muted"
          >
            {isBusy ? 'Please wait...' : isSignup ? 'Create Account' : 'Log In'}
          </button>
        </form>

        <p className="text-sm text-ink-muted text-center mt-6">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button onClick={switchMode} className="text-wine font-semibold hover:text-wine-dark">
            {isSignup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  );
}
