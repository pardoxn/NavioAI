// src/components/SidebarAdminLink.jsx
import React from 'react';
import { Shield } from 'lucide-react';
import { useAuth } from '../AuthContext.jsx';

export default function SidebarAdminLink() {
  const { user } = useAuth();
  const isAdmin = React.useMemo(() => {
    const list = [];
    if (Array.isArray(user?.roles)) list.push(...user.roles);
    if (user?.role) list.push(user.role);
    return list.some((r) => String(r || "").toLowerCase() === "admin");
  }, [user]);
  if (!isAdmin) return null;

  const isActive =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

  const base = 'flex items-center gap-2 px-3 py-2 rounded-xl transition-colors';
  const normal = 'text-slate-200 hover:bg-slate-700';
  const active = 'bg-slate-700 text-white border border-slate-600';

  return (
    <a href="/admin" className={`${base} ${isActive ? active : normal}`}>
      <Shield className="w-4 h-4" />
      <span>Benutzerverwaltung</span>
    </a>
  );
}
