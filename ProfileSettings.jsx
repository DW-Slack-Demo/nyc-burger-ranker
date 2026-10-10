import React, { useState } from 'react';
import { LogOut, Check } from 'lucide-react';
import { changeUsername, changeEmail, changePassword, deleteAccount, MIN_PASSWORD_LENGTH } from './auth.js';
import { isDemoMode } from './firebase.js';

// Runs a form's action, tracking whether it is busy, its error and what to say when done.
function useAction() {
  const [state, setState] = useState({ busy: false, error: '', done: '' });
  const run = async (action) => {
    setState({ busy: true, error: '', done: '' });
    try {
      const done = await action();
      setState({ busy: false, error: '', done: done || '' });
      return true;
    } catch (error) {
      setState({ busy: false, error: error.message || 'Something went wrong. Please try again.', done: '' });
      return false;
    }
  };
  return [state, run];
}

function Status({ state }) {
  if (state.error) return <p className="mt-2 text-sm text-wine" role="alert">{state.error}</p>;
  if (state.done) return <p className="mt-2 text-sm text-vert flex items-start gap-1" role="status"><Check className="w-4 h-4 shrink-0 mt-0.5" />{state.done}</p>;
  return null;
}

// Your own account: username, default city, email, password, signing out and deleting it.
export default function ProfileSettings({ username, email, hasEmail, homeCity, cities, onHomeCityChange, onRenamed, onLogOut, ui }) {
  const { panel, heading, eyebrow, input, primaryButton, quietButton } = ui;
  const label = 'block text-xs uppercase tracking-wider font-semibold text-ink-soft mb-1';

  const [newName, setNewName] = useState('');
  const [nameState, runName] = useAction();
  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  const [emailState, runEmail] = useAction();
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '' });
  const [passwordState, runPassword] = useAction();
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteState, runDelete] = useAction();

  const submitName = async (e) => {
    e.preventDefault();
    const ok = await runName(async () => {
      const name = await changeUsername(username, newName);
      onRenamed(name);
      return `You're now @${name}.`;
    });
    if (ok) setNewName('');
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    const sentTo = emailForm.email.trim();
    const ok = await runEmail(async () => {
      await changeEmail(sentTo, emailForm.password);
      return `We sent a confirmation link to ${sentTo}. Your email changes once you click it; until then, keep logging in with ${email}.`;
    });
    if (ok) setEmailForm({ email: '', password: '' });
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    const ok = await runPassword(async () => {
      await changePassword(passwordForm.current, passwordForm.next);
      return 'Your password is changed. Use the new one next time you log in.';
    });
    if (ok) setPasswordForm({ current: '', next: '' });
  };

  const submitDelete = async (e) => {
    e.preventDefault();
    // A successful delete signs out, which takes the app back to the login screen.
    await runDelete(() => deleteAccount(username, deletePassword));
  };

  return (
    <div className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className={eyebrow}>Account settings</div>
          <h2 className="font-display text-3xl text-ink mt-1">@{username}</h2>
          {email && <p className="text-sm text-ink-muted">{email}</p>}
        </div>
        <button onClick={onLogOut} className={`${quietButton} px-4 py-2 flex items-center gap-1.5`}>
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={submitName}>
          <h3 className={`${heading} mb-1`}>Username</h3>
          <p className="text-sm text-ink-muted mb-3">
            Your lists, photos and followers stay with you. Your old name becomes free for someone else to take.
          </p>
          <label htmlFor="new-username" className={label}>New username</label>
          <div className="flex gap-2">
            <input
              id="new-username"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={username}
              className={`${input} py-2`}
              required
            />
            <button type="submit" disabled={nameState.busy} className={`${primaryButton} px-4 shrink-0`}>
              {nameState.busy ? 'Saving...' : 'Change'}
            </button>
          </div>
          <Status state={nameState} />
        </form>

        <div>
          <h3 className={`${heading} mb-1`}>Default city</h3>
          <p className="text-sm text-ink-muted mb-3">The city the app opens to.</p>
          <div className="inline-flex border border-line rounded-sm bg-card p-0.5" role="group" aria-label="Default city">
            {Object.entries(cities).map(([key, info]) => (
              <button
                key={key}
                type="button"
                onClick={() => onHomeCityChange(key)}
                aria-pressed={homeCity === key}
                className={`px-4 py-2 rounded-sm uppercase tracking-wider text-xs font-semibold transition-colors ${
                  homeCity === key ? 'bg-wine text-paper' : 'text-ink-soft hover:text-ink'
                }`}
              >
                {info.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submitEmail}>
          <h3 className={`${heading} mb-1`}>Email</h3>
          {isDemoMode ? (
            <p className="text-sm text-ink-muted">Emails can't be changed in demo mode.</p>
          ) : !hasEmail ? (
            <p className="text-sm text-ink-muted">Add an email using the box at the top of the page.</p>
          ) : (
            <>
              <p className="text-sm text-ink-muted mb-3">The email you log in with and get password reset links at.</p>
              <label htmlFor="new-email" className={label}>New email</label>
              <input
                id="new-email"
                type="email"
                autoComplete="email"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                placeholder="you@example.com"
                className={`${input} py-2 mb-2`}
                required
              />
              <label htmlFor="email-password" className={label}>Current password</label>
              <input
                id="email-password"
                type="password"
                autoComplete="current-password"
                value={emailForm.password}
                onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                className={`${input} py-2 mb-3`}
                required
              />
              <button type="submit" disabled={emailState.busy} className={`${primaryButton} px-4 py-2.5`}>
                {emailState.busy ? 'Sending...' : 'Change email'}
              </button>
            </>
          )}
          <Status state={emailState} />
        </form>

        <form onSubmit={submitPassword}>
          <h3 className={`${heading} mb-1`}>Password</h3>
          <p className="text-sm text-ink-muted mb-3">At least {MIN_PASSWORD_LENGTH} characters.</p>
          <label htmlFor="current-password" className={label}>Current password</label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={passwordForm.current}
            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
            className={`${input} py-2 mb-2`}
            required
          />
          <label htmlFor="new-password" className={label}>New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={passwordForm.next}
            onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
            className={`${input} py-2 mb-3`}
            required
          />
          <button type="submit" disabled={passwordState.busy} className={`${primaryButton} px-4 py-2.5`}>
            {passwordState.busy ? 'Saving...' : 'Change password'}
          </button>
          <Status state={passwordState} />
        </form>
      </div>

      <div className="mt-8 pt-6 border-t border-line">
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)} className="text-sm text-wine hover:text-wine-dark underline underline-offset-2">
            Delete my account
          </button>
        ) : (
          <form onSubmit={submitDelete} className="max-w-md p-4 border border-wine/40 bg-wine/5 rounded-sm">
            <h3 className={`${heading} mb-1`}>Delete your account</h3>
            <p className="text-sm text-ink-soft mb-3">
              This permanently deletes your lists, leaderboard votes, photos and username, and can't be undone.
            </p>
            <label htmlFor="delete-password" className={label}>Your password</label>
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className={`${input} py-2 mb-3`}
              required
            />
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={deleteState.busy} className={`${primaryButton} px-4 py-2.5`}>
                {deleteState.busy ? 'Deleting...' : 'Delete forever'}
              </button>
              <button
                type="button"
                onClick={() => { setShowDelete(false); setDeletePassword(''); }}
                className={`${quietButton} px-4 py-2.5`}
              >
                Keep my account
              </button>
            </div>
            <Status state={deleteState} />
          </form>
        )}
      </div>
    </div>
  );
}
