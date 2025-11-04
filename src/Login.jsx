// src/Login.jsx
import React from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './AuthContext.jsx';

// === Endpunkte an dein Backend anpassen ===
const REGISTER_ENDPOINT = '/api/auth/register';
const FORGOT_ENDPOINT   = '/api/auth/password/forgot';

export default function Login() {
  const { login } = useAuth();

  const [mode, setMode] = React.useState('login'); // 'login' | 'forgot' | 'register'
  const [busy, setBusy] = React.useState(false);
  const [serverMsg, setServerMsg] = React.useState({ type: '', text: '' }); // {type:'error'|'success', text:''}

  // Felder Login
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [capsOn, setCapsOn] = React.useState(false);
  const [errorsLogin, setErrorsLogin] = React.useState({ username: '', password: '' });
  const userRef = React.useRef(null);
  const passRef = React.useRef(null);

  // Felder Forgot
  const [emailForgot, setEmailForgot] = React.useState('');
  const [errorsForgot, setErrorsForgot] = React.useState({ email: '' });

  // Felder Register
  const [regName, setRegName] = React.useState('');
  const [regEmail, setRegEmail] = React.useState('');
  const [regPw, setRegPw] = React.useState('');
  const [regPw2, setRegPw2] = React.useState('');
  const [showRegPw, setShowRegPw] = React.useState(false);
  const [errorsReg, setErrorsReg] = React.useState({ name: '', email: '', pw: '', pw2: '' });

  React.useEffect(() => {
    // Beim Moduswechsel Messages & Fehler leeren
    setServerMsg({ type: '', text: '' });
    setErrorsLogin({ username: '', password: '' });
    setErrorsForgot({ email: '' });
    setErrorsReg({ name: '', email: '', pw: '', pw2: '' });
  }, [mode]);

  /* ===== Helpers: Validierung ===== */
  const validateLogin = () => {
    const e = { username: '', password: '' };
    if (!username.trim()) e.username = 'Bitte Benutzernamen eingeben.';
    if (!password) e.password = 'Bitte Passwort eingeben.';
    return e;
  };

  const validateEmail = (v) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

  const validateForgot = () => {
    const e = { email: '' };
    if (!emailForgot.trim()) e.email = 'Bitte E-Mail eingeben.';
    else if (!validateEmail(emailForgot)) e.email = 'Bitte gültige E-Mail eingeben.';
    return e;
  };

  const validateRegister = () => {
    const e = { name: '', email: '', pw: '', pw2: '' };
    if (!regName.trim()) e.name = 'Bitte Benutzernamen eingeben.';
    if (!regEmail.trim()) e.email = 'Bitte E-Mail eingeben.';
    else if (!validateEmail(regEmail)) e.email = 'Bitte gültige E-Mail eingeben.';
    if (!regPw) e.pw = 'Bitte Passwort eingeben.';
    if (!regPw2) e.pw2 = 'Bitte Passwort bestätigen.';
    if (!e.pw && !e.pw2 && regPw !== regPw2) e.pw2 = 'Passwörter stimmen nicht überein.';
    return e;
  };

  /* ===== Submit: Login ===== */
  async function onSubmitLogin(ev) {
    ev.preventDefault();
    setServerMsg({ type: '', text: '' });
    const e = validateLogin();
    setErrorsLogin(e);
    if (e.username || e.password) {
      if (e.username) userRef.current?.focus();
      else if (e.password) passRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const res = await login(username.trim(), password);
      if (!res?.ok) {
        const raw = String(res?.error || '').toLowerCase();
        if (raw.includes('fehlende')) {
          setErrorsLogin(validateLogin());
          if (!username.trim()) userRef.current?.focus();
          else if (!password) passRef.current?.focus();
        } else if (/(ungültig|ungueltig|invalid)/.test(raw)) {
          setServerMsg({ type: 'error', text: 'Benutzername oder Passwort ist falsch.' });
          setPassword('');
          passRef.current?.focus();
        } else {
          setServerMsg({ type: 'error', text: 'Login fehlgeschlagen.' });
        }
      }
    } catch {
      setServerMsg({ type: 'error', text: 'Server nicht erreichbar.' });
    } finally {
      setBusy(false);
    }
  }

  /* ===== Submit: Passwort vergessen (Reset-Link anfordern) ===== */
  async function onSubmitForgot(ev) {
    ev.preventDefault();
    setServerMsg({ type: '', text: '' });
    const e = validateForgot();
    setErrorsForgot(e);
    if (e.email) return;

    setBusy(true);
    try {
      const r = await fetch(FORGOT_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailForgot.trim() }),
      });
      if (r.ok) {
        setServerMsg({
          type: 'success',
          text: 'Wenn die E-Mail existiert, wurde ein Reset-Link verschickt.',
        });
      } else {
        const data = await r.json().catch(() => ({}));
        const msg = data?.error || 'Anfrage fehlgeschlagen.';
        setServerMsg({ type: 'error', text: msg });
      }
    } catch {
      setServerMsg({ type: 'error', text: 'Server nicht erreichbar.' });
    } finally {
      setBusy(false);
    }
  }

  /* ===== Submit: Registrieren ===== */
  async function onSubmitRegister(ev) {
    ev.preventDefault();
    setServerMsg({ type: '', text: '' });
    const e = validateRegister();
    setErrorsReg(e);
    if (e.name || e.email || e.pw || e.pw2) return;

    setBusy(true);
    try {
      const r = await fetch(REGISTER_ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regName.trim(),
          email: regEmail.trim(),
          password: regPw,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        // Erfolgreich → zurück zum Login & Username vorfüllen
        setServerMsg({ type: 'success', text: 'Account erstellt. Sie können sich jetzt anmelden.' });
        setUsername(regName.trim());
        setRegName(''); setRegEmail(''); setRegPw(''); setRegPw2('');
        setMode('login');
        setTimeout(() => passRef.current?.focus(), 0);
      } else {
        const msg = data?.error || 'Registrierung fehlgeschlagen.';
        setServerMsg({ type: 'error', text: msg });
      }
    } catch {
      setServerMsg({ type: 'error', text: 'Server nicht erreichbar.' });
    } finally {
      setBusy(false);
    }
  }

  /* ===== UI Building Blocks ===== */
  const baseInput =
    'w-full px-4 py-3 bg-slate-600 border text-white rounded-xl transition-all placeholder-gray-400 focus:outline-none';
  const okBorder = 'border-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const errBorder = 'border-red-500 focus:ring-2 focus:ring-red-500';

  const Message = ({ type, children }) =>
    !children ? null : (
      <div
        className={
          'mb-5 flex items-start gap-2 text-sm rounded-xl px-3 py-2 border ' +
          (type === 'success'
            ? 'text-emerald-200 bg-emerald-900/25 border-emerald-800'
            : 'text-red-200 bg-red-900/30 border-red-800')
        }
        role="alert"
        aria-live="assertive"
      >
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{children}</span>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-800 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-slate-700 rounded-3xl shadow-2xl p-8 mb-8 border border-slate-600">
          {/* Brand-Icon */}
          <div className="flex items-center justify-center mb-8">
            <img
              src="/brand/navio_ai_mark_dark_tile.svg"
              alt="Navio AI"
              className="w-16 h-16 rounded-2xl shadow"
              draggable={false}
            />
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">Navio AI</h1>
          <p className="text-gray-300 text-center mb-6">
            {mode === 'login' && 'Melden Sie sich an, um fortzufahren'}
            {mode === 'forgot' && 'Passwort zurücksetzen anfordern'}
            {mode === 'register' && 'Neues Konto erstellen'}
          </p>

          {/* Server-Message */}
          <Message type={serverMsg.type}>{serverMsg.text}</Message>

          {/* === LOGIN === */}
          {mode === 'login' && (
            <form onSubmit={onSubmitLogin} className="space-y-5" noValidate>
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-200 mb-2">
                  Benutzername
                </label>
                <input
                  id="username"
                  ref={userRef}
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorsLogin.username) setErrorsLogin((p) => ({ ...p, username: '' }));
                  }}
                  className={`${baseInput} ${errorsLogin.username ? errBorder : okBorder}`}
                  placeholder="Ihr Benutzername"
                  autoComplete="username"
                  aria-invalid={!!errorsLogin.username}
                />
                {errorsLogin.username ? (
                  <p className="mt-2 text-sm text-red-300">{errorsLogin.username}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    id="password"
                    ref={passRef}
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorsLogin.password) setErrorsLogin((p) => ({ ...p, password: '' }));
                    }}
                    onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState('CapsLock'))}
                    onBlur={() => setCapsOn(false)}
                    className={`${baseInput} pr-12 ${errorsLogin.password ? errBorder : okBorder}`}
                    placeholder="Ihr Passwort"
                    autoComplete="current-password"
                    aria-invalid={!!errorsLogin.password}
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
                {errorsLogin.password ? (
                  <p className="mt-2 text-sm text-red-300">{errorsLogin.password}</p>
                ) : capsOn ? (
                  <p className="mt-2 text-sm text-amber-200">Achtung: Feststelltaste ist aktiv.</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] duration-200 disabled:opacity-60"
                aria-busy={busy ? 'true' : 'false'}
              >
                {busy ? 'Anmelden…' : 'Anmelden'}
              </button>

              <div className="flex items-center justify-between text-sm text-gray-300">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="hover:underline"
                >
                  Passwort vergessen?
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className="hover:underline"
                >
                  Konto erstellen
                </button>
              </div>
            </form>
          )}

          {/* === FORGOT === */}
          {mode === 'forgot' && (
            <form onSubmit={onSubmitForgot} className="space-y-5" noValidate>
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-200 mb-2">
                  E-Mail
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={emailForgot}
                  onChange={(e) => {
                    setEmailForgot(e.target.value);
                    if (errorsForgot.email) setErrorsForgot({ email: '' });
                  }}
                  className={`${baseInput} ${errorsForgot.email ? errBorder : okBorder}`}
                  placeholder="name@firma.de"
                  autoComplete="email"
                  aria-invalid={!!errorsForgot.email}
                />
                {errorsForgot.email ? (
                  <p className="mt-2 text-sm text-red-300">{errorsForgot.email}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-60"
              >
                {busy ? 'Sende Link…' : 'Reset-Link anfordern'}
              </button>

              <div className="text-center text-sm">
                <button type="button" onClick={() => setMode('login')} className="text-gray-300 hover:underline">
                  Zurück zum Login
                </button>
              </div>
            </form>
          )}

          {/* === REGISTER === */}
          {mode === 'register' && (
            <form onSubmit={onSubmitRegister} className="space-y-5" noValidate>
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-gray-200 mb-2">
                  Benutzername
                </label>
                <input
                  id="reg-name"
                  type="text"
                  value={regName}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    if (errorsReg.name) setErrorsReg((p) => ({ ...p, name: '' }));
                  }}
                  className={`${baseInput} ${errorsReg.name ? errBorder : okBorder}`}
                  placeholder="Ihr Benutzername"
                  autoComplete="username"
                />
                {errorsReg.name ? (
                  <p className="mt-2 text-sm text-red-300">{errorsReg.name}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-200 mb-2">
                  E-Mail
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={regEmail}
                  onChange={(e) => {
                    setRegEmail(e.target.value);
                    if (errorsReg.email) setErrorsReg((p) => ({ ...p, email: '' }));
                  }}
                  className={`${baseInput} ${errorsReg.email ? errBorder : okBorder}`}
                  placeholder="name@firma.de"
                  autoComplete="email"
                />
                {errorsReg.email ? (
                  <p className="mt-2 text-sm text-red-300">{errorsReg.email}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="reg-pw" className="block text-sm font-medium text-gray-200 mb-2">
                  Passwort
                </label>
                <div className="relative">
                  <input
                    id="reg-pw"
                    type={showRegPw ? 'text' : 'password'}
                    value={regPw}
                    onChange={(e) => {
                      setRegPw(e.target.value);
                      if (errorsReg.pw) setErrorsReg((p) => ({ ...p, pw: '' }));
                    }}
                    className={`${baseInput} pr-12 ${errorsReg.pw ? errBorder : okBorder}`}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-300 hover:text-white hover:bg-slate-500/30 focus:outline-none"
                    aria-label={showRegPw ? 'Passwort ausblenden' : 'Passwort anzeigen'}
                  >
                    {showRegPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errorsReg.pw ? (
                  <p className="mt-2 text-sm text-red-300">{errorsReg.pw}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor="reg-pw2" className="block text-sm font-medium text-gray-200 mb-2">
                  Passwort bestätigen
                </label>
                <input
                  id="reg-pw2"
                  type={showRegPw ? 'text' : 'password'}
                  value={regPw2}
                  onChange={(e) => {
                    setRegPw2(e.target.value);
                    if (errorsReg.pw2) setErrorsReg((p) => ({ ...p, pw2: '' }));
                  }}
                  className={`${baseInput} ${errorsReg.pw2 ? errBorder : okBorder}`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {errorsReg.pw2 ? (
                  <p className="mt-2 text-sm text-red-300">{errorsReg.pw2}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition-colors font-semibold text-lg disabled:opacity-60"
              >
                {busy ? 'Erstelle Konto…' : 'Registrieren'}
              </button>

              <div className="text-center text-sm">
                <button type="button" onClick={() => setMode('login')} className="text-gray-300 hover:underline">
                  Bereits ein Konto? Anmelden
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <footer className="text-center text-gray-400 text-xs opacity-60">
        Created with <span className="text-red-400">❤️</span> by Benedikt Niewels
      </footer>
    </div>
  );
}
