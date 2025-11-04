// src/AppGate.jsx
import React from 'react';
import { useAuth } from './AuthContext.jsx';
import Login from './Login.jsx';

export default function AppGate({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    // neutraler Loader – ändert dein UI nicht dauerhaft
    return (
      <div className="min-h-screen bg-slate-800 text-slate-300 flex items-center justify-center p-6">
        Lade…
      </div>
    );
  }

  if (!user) {
    // zeigt deinen bestehenden Login-Screen
    return <Login />;
  }

  // eingeloggt -> rendert deine bestehende App 1:1
  return children;
}
