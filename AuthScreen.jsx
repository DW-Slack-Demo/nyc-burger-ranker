import React, { useState } from 'react';
import { logIn, signUp, sendPasswordReset, MIN_PASSWORD_LENGTH } from './auth.js';
import { isDemoMode } from './firebase.js';

const labelClass = 'block text-[11px] uppercase tracking-[0.18em] font-semibold text-ink-soft mb-2';
const inputClass = 'w-full px-4 py-3 bg-white/70 border border-line rounded-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-wine focus:border-wine';

const SUBTITLES = {
  login: 'Log in to see your saved lists',
  signup: 'Create an account to save your lists and follow friends',
  reset: "Enter your account's email and we'll send you a link to choose a new password",
};

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // 'login', 'signup' or 'reset'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSentTo, setResetSentTo] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const isSignup = mode === 'signup';
  const isReset = mode === 'reset';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsBusy(true);
    try {
      if (isReset) {
        await sendPasswordReset(email);
        setResetSentTo(email.trim());
        setIsBusy(false);
        return;
      }
      // On success the app's auth listener takes over and shows the main screen.
      await (isSignup ? signUp(username, email, password) : logIn(email, password));
    } catch (err) {
      setError(err.message);
      setIsBusy(false);
    }
  };

  const switchMode = (next) => {
    // The login box takes an email or a username, so don't carry a username into the reset box.
    if (next === 'reset' && !email.includes('@')) setEmail('');
    setMode(next);
    setError('');
    setResetSentTo('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-sm p-8 sm:p-10 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="text-[11px] uppercase tracking-[0.2em] text-brass font-semibold">New York City · Miami</div>
          <h1 className="font-display italic text-5xl text-wine mt-1 mb-3">Top Shelf</h1>
          <p className="font-display italic text-ink-soft">
            {SUBTITLES[mode]}
          </p>
        </div>

        {isDemoMode && (
          <div className="mb-4 p-3 bg-brass-light border border-brass/40 rounded-sm text-sm text-ink-soft">
            <strong>Demo mode:</strong> accounts and lists are saved in this browser only.
          </div>
        )}

        {isReset && resetSentTo ? (
          <div className="space-y-4" role="status">
            <div className="p-4 bg-brass-light border border-brass/40 rounded-sm text-sm text-ink-soft">
              If an account uses <strong>{resetSentTo}</strong>, a password reset link is on its way.
              Open the email, click the link, and choose a new password. It can take a few minutes,
              and it may land in your spam folder.
            </div>
            <button
              onClick={() => switchMode('login')}
              className="w-full bg-wine text-paper py-3 rounded-sm uppercase tracking-[0.18em] text-sm font-semibold hover:bg-wine-dark transition-colors"
            >
              Back to log in
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label htmlFor="auth-username" className={labelClass}>Username</label>
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3-20 letters, numbers or _"
                className={inputClass}
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className={labelClass}>{mode === 'login' ? 'Email or username' : 'Email'}</label>
            <input
              id="auth-email"
              type={mode === 'login' ? 'text' : 'email'}
              autoComplete={mode === 'login' ? 'username' : 'email'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSignup ? 'For resetting your password. Never shown to others.' : 'you@example.com'}
              className={inputClass}
              required
            />
          </div>

          {!isReset && (
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="auth-password" className={labelClass}>Password</label>
                {!isSignup && (
                  <button type="button" onClick={() => switchMode('reset')} className="text-xs text-wine font-semibold hover:text-wine-dark">
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignup ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Your password'}
                className={inputClass}
                required
              />
            </div>
          )}

          {isSignup && (
            <div>
              <label htmlFor="auth-confirm" className={labelClass}>Confirm password</label>
              <input
                id="auth-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                required
              />
            </div>
          )}

          {isReset && isDemoMode && (
            <div className="p-3 bg-brass-light border border-brass/40 rounded-sm text-sm text-ink-soft">
              Reset emails can't be sent in demo mode, because demo accounts live only in this browser.
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
            {isBusy ? 'Please wait...' : isSignup ? 'Create Account' : isReset ? 'Send Reset Link' : 'Log In'}
          </button>
        </form>
        )}

        <p className="text-sm text-ink-muted text-center mt-6">
          {isReset ? 'Remembered it?' : isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button onClick={() => switchMode(isSignup || isReset ? 'login' : 'signup')} className="text-wine font-semibold hover:text-wine-dark">
            {isSignup || isReset ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </div>
    </div>
  );
}
