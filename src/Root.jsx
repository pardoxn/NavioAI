// src/Root.jsx
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import App from './App.jsx';
import Login from './Login.jsx';

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Lädt…
      </div>
    );
  }

  if (!user) return <Login />;

  return <App />;
}

export default function Root() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
