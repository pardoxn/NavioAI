// src/Reset.jsx
import React from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Reset() {
  const params = new URLSearchParams(window.location.search);
  const tid = params.get('tid') || '';
  const t = params.get('t') || '';

  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState({ type: '', text: '' });
  const [errors, setErrors] = React.useState({ pw: '', pw2: '' });

  const invalidLink = !tid || !t;

  function validate() {
    const e = { pw: '', pw2: '' };
    if (!pw) e.pw = 'Bitte neues Passwort eingeben.';
    if (!pw2) e.pw2 = 'Bitte Passwort bestätigen.';
    if (!e.pw && !e.pw2 && pw !== pw2) e.pw2 = 'Passwörter stimmen nicht überein.';
    return e;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    setMsg({ type: '', text: '' });
    const e = validate();
    setErrors(e);
    if (e.pw || e.pw2) return;

    setBusy(true);
    try {
      const r = await fetch('/api/auth/password/reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tid, t, newPassword: pw }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        setMsg({ type: 'success', text: 'Passwort wurde aktualisiert. Sie können sich jetzt anmelden.' });
        // optional: nach kurzer Zeit auf Login leiten
        setTimeout(() => (window.location.href = '/'), 1500);
      } else {
        setMsg({ type: 'error', text: data?.error || `Fehler (${r.status})` });
      }
    } catch {
      setMsg({ type: 'error', text: 'Server nicht erreichbar.' });
    } finally {
      setBusy(false);
    }
  }

  const base =
    'w-full px-4 py-3 bg-slate-600 border text-white rounded-xl transition-all placeholder-gray-400 focus:outline-none';
  const ok = 'border-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const err = 'border-red-500 focus:ring-2 focus:ring-red-500';

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-slate-700 rounded-3xl shadow-2xl p-8 mb-8 border border-slate-600">
          <div className="flex items-center justify-center mb-8">
            <img
              src="/brand/navio_ai_mark_dark_tile.svg"
              alt="Navio AI"
              className="w-16 h-16 rounded-2xl shadow"
              draggable={false}
            />
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">Passwort zurücksetzen</h1>
          <p className="text-gray-300 text-center mb-6">
            Bitte vergeben Sie ein neues Passwort.
          </p>

          {invalidLink && (
            <div className="mb-5 flex items-start gap-2 text-sm text-red-200 bg-red-900/30 border border-red-800 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Ungültiger oder unvollständiger Link. Bitte fordern Sie ihn erneut an.</span>
            </div>
          )}

          {msg.text ? (
            <div
              className={
                'mb-5 flex items-start gap-2 text-sm rounded-xl px-3 py-2 border ' +
                (msg.type === 'success'
                  ? 'text-emerald-200 bg-emerald-900/25 border-emerald-800'
                  : 'text-red-200 bg-red-900/30 border-red-800')
              }
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{msg.text}</span>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="pw" className="block text-sm font-medium text-gray-200 mb-2">
                Neues Passwort
              </label>
              <div className="relative">
                <input
                  id="pw"
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value);
                    if (errors.pw) setErrors((p) => ({ ...p, pw: '' }));
                  }}
                  className={`${base} pr-12 ${errors.pw ? err : ok}`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={invalidLink}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-500/30 focus:outline-none"
                  aria-label={showPw ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.pw ? <p className="mt-2 text-sm text-red-300">{errors.pw}</p> : null}
            </div>

            <div>
              <label htmlFor="pw2" className="block text-sm font-medium text-gray-200 mb-2">
                Passwort bestätigen
              </label>
              <input
                id="pw2"
                type={showPw ? 'text' : 'password'}
                value={pw2}
                onChange={(e) => {
                  setPw2(e.target.value);
                  if (errors.pw2) setErrors((p) => ({ ...p, pw2: '' }));
                }}
                className={`${base} ${errors.pw2 ? err : ok}`}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={invalidLink}
              />
              {errors.pw2 ? <p className="mt-2 text-sm text-red-300">{errors.pw2}</p> : null}
            </div>

            <button
              type="submit"
              disabled={busy || invalidLink}
              className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-60"
            >
              {busy ? 'Speichere…' : 'Passwort setzen'}
            </button>

            <div className="text-center text-sm mt-2">
              <a href="/" className="text-gray-300 hover:underline">Zurück zum Login</a>
            </div>
          </form>
        </div>
      </div>

      <footer className="text-center text-gray-400 text-xs opacity-60">
        Created with <span className="text-red-400">❤️</span> by Benedikt Niewels
      </footer>
    </div>
  );
}
