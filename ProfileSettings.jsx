import React, { useState } from 'react';
import { LogOut, Check, Camera } from 'lucide-react';
import { changeUsername, changeEmail, changePassword, deleteAccount, MIN_PASSWORD_LENGTH } from './auth.js';
import { isDemoMode } from './firebase.js';
import { saveAvatar, removeAvatar } from './photoStore.js';
import Avatar from './Avatar.jsx';

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

// Your own account: profile photo, username, default city, email, password, signing out and
// deleting it.
export default function ProfileSettings({ userId, avatar, onAvatarChange, username, email, hasEmail, homeCity, cities, onHomeCityChange, onRenamed, onLogOut, ui }) {
  const { panel, eyebrow, input, primaryButton, quietButton } = ui;

  const [avatarState, runAvatar] = useAction();
  const [newName, setNewName] = useState('');
  const [nameState, runName] = useAction();
  const [emailForm, setEmailForm] = useState({ email: '', password: '' });
  const [emailState, runEmail] = useAction();
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '' });
  const [passwordState, runPassword] = useAction();
  // Which setting's form is open; only one at a time keeps the page short.
  const [open, setOpen] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteState, runDelete] = useAction();

  const pickAvatar = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) runAvatar(async () => onAvatarChange(await saveAvatar(userId, file)));
  };

  const clearAvatar = () => runAvatar(async () => {
    await removeAvatar(userId);
    onAvatarChange(null);
  });

  const submitName = async (e) => {
    e.preventDefault();
    const ok = await runName(async () => {
      const name = await changeUsername(username, newName);
      onRenamed(name);
      return `You're now @${name}.`;
    });
    if (ok) { setNewName(''); setOpen(null); }
  };

  const submitEmail = async (e) => {
    e.preventDefault();
    const sentTo = emailForm.email.trim();
    const ok = await runEmail(async () => {
      await changeEmail(sentTo, emailForm.password);
      return `We sent a confirmation link to ${sentTo}. Your email changes once you click it; until then, keep logging in with ${email}.`;
    });
    if (ok) { setEmailForm({ email: '', password: '' }); setOpen(null); }
  };

  const submitPassword = async (e) => {
    e.preventDefault();
    const ok = await runPassword(async () => {
      await changePassword(passwordForm.current, passwordForm.next);
      return 'Your password is changed. Use the new one next time you log in.';
    });
    if (ok) { setPasswordForm({ current: '', next: '' }); setOpen(null); }
  };

  const submitDelete = async (e) => {
    e.preventDefault();
    // A successful delete signs out, which takes the app back to the login screen.
    await runDelete(() => deleteAccount(username, deletePassword));
  };

  const toggle = (key) => {
    setOpen(open === key ? null : key);
    if (key === 'delete') setDeletePassword('');
  };
  const changeLink = (key, text = 'Change') => (
    <button type="button" onClick={() => toggle(key)} className="text-sm text-wine hover:text-wine-dark underline underline-offset-2 shrink-0">
      {open === key ? 'Cancel' : text}
    </button>
  );
  const row = 'py-3 flex items-center justify-between gap-3';
  const rowLabel = 'w-24 shrink-0 text-xs uppercase tracking-wider font-semibold text-ink-soft';
  const rowValue = 'flex-1 min-w-0 truncate text-sm text-ink';
  const inlineForm = 'pb-4 -mt-1 space-y-2 max-w-md';

  return (
    <div className={panel}>
      <div className="flex items-center gap-4">
        <Avatar src={avatar} username={username} size={56} />
        <div className="flex-1 min-w-0">
          <div className={eyebrow}>Account settings</div>
          <h2 className="font-display text-2xl text-ink truncate">@{username}</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className={`text-wine hover:text-wine-dark flex items-center gap-1 ${avatarState.busy ? 'opacity-50' : 'cursor-pointer'}`}>
              <Camera className="w-4 h-4" />
              {avatarState.busy ? 'Saving...' : avatar ? 'Change photo' : 'Add a photo'}
              <input type="file" accept="image/*" className="hidden" disabled={avatarState.busy} onChange={pickAvatar} />
            </label>
            {avatar && !avatarState.busy && (
              <button type="button" onClick={clearAvatar} className="text-ink-muted hover:text-wine underline underline-offset-2">
                Remove
              </button>
            )}
          </div>
        </div>
        <button onClick={onLogOut} className={`${quietButton} px-3 py-2 flex items-center gap-1.5 shrink-0 self-start`}>
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
      </div>
      <Status state={avatarState} />

      <div className="mt-4 divide-y divide-line border-t border-line">
        <div>
          <div className={row}>
            <span className={rowLabel}>Username</span>
            <span className={rowValue}>@{username}</span>
            {changeLink('name')}
          </div>
          {open === 'name' && (
            <form onSubmit={submitName} className={inlineForm}>
              <p className="text-xs text-ink-muted">Your lists, photos and followers stay with you. Your old name becomes free for someone else.</p>
              <div className="flex gap-2">
                <input
                  aria-label="New username"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New username"
                  className={`${input} py-2`}
                  required
                  autoFocus
                />
                <button type="submit" disabled={nameState.busy} className={`${primaryButton} px-4 shrink-0`}>
                  {nameState.busy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
          <Status state={nameState} />
        </div>

        <div className={row}>
          <span className={rowLabel}>Default city</span>
          <div className="flex-1 flex justify-end sm:justify-start">
            <div className="inline-flex border border-line rounded-sm bg-card p-0.5" role="group" aria-label="Default city">
              {Object.entries(cities).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onHomeCityChange(key)}
                  aria-pressed={homeCity === key}
                  className={`px-3 py-1 rounded-sm uppercase tracking-wider text-xs font-semibold transition-colors ${
                    homeCity === key ? 'bg-wine text-paper' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  {info.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className={row}>
            <span className={rowLabel}>Email</span>
            <span className={`${rowValue} ${email ? '' : 'text-ink-muted'}`}>{email || 'Not added yet'}</span>
            {hasEmail && !isDemoMode && changeLink('email')}
          </div>
          {open === 'email' && (
            <form onSubmit={submitEmail} className={inlineForm}>
              <input
                aria-label="New email"
                type="email"
                autoComplete="email"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
                placeholder="New email"
                className={`${input} py-2`}
                required
                autoFocus
              />
              <div className="flex gap-2">
                <input
                  aria-label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  placeholder="Current password"
                  className={`${input} py-2`}
                  required
                />
                <button type="submit" disabled={emailState.busy} className={`${primaryButton} px-4 shrink-0`}>
                  {emailState.busy ? 'Sending...' : 'Save'}
                </button>
              </div>
            </form>
          )}
          <Status state={emailState} />
        </div>

        <div>
          <div className={row}>
            <span className={rowLabel}>Password</span>
            <span className={`${rowValue} tracking-widest`}>••••••••</span>
            {changeLink('password')}
          </div>
          {open === 'password' && (
            <form onSubmit={submitPassword} className={inlineForm}>
              <input
                aria-label="Current password"
                type="password"
                autoComplete="current-password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                placeholder="Current password"
                className={`${input} py-2`}
                required
                autoFocus
              />
              <div className="flex gap-2">
                <input
                  aria-label="New password"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  value={passwordForm.next}
                  onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
                  placeholder={`New password (${MIN_PASSWORD_LENGTH}+ characters)`}
                  className={`${input} py-2`}
                  required
                />
                <button type="submit" disabled={passwordState.busy} className={`${primaryButton} px-4 shrink-0`}>
                  {passwordState.busy ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
          <Status state={passwordState} />
        </div>

        <div>
          <div className={row}>
            <span className={rowLabel}>Account</span>
            <span className={`${rowValue} text-ink-muted`}>Delete everything you've saved</span>
            {changeLink('delete', 'Delete')}
          </div>
          {open === 'delete' && (
            <form onSubmit={submitDelete} className={`${inlineForm} p-3 border border-wine/40 bg-wine/5 rounded-sm`}>
              <p className="text-sm text-ink-soft">
                This permanently deletes your lists, leaderboard votes, photos, profile photo and username. It can't be undone.
              </p>
              <div className="flex gap-2">
                <input
                  aria-label="Your password"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                  className={`${input} py-2`}
                  required
                  autoFocus
                />
                <button type="submit" disabled={deleteState.busy} className={`${primaryButton} px-4 shrink-0`}>
                  {deleteState.busy ? 'Deleting...' : 'Delete forever'}
                </button>
              </div>
            </form>
          )}
          <Status state={deleteState} />
        </div>
      </div>
    </div>
  );
}
