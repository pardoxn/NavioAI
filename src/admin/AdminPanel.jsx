// src/admin/AdminPanel.jsx
import React from "react";
import { Shield, UserCog } from "lucide-react";
import { useAuth } from "../AuthContext.jsx";

function isAdminUser(user) {
  const roles = [];
  if (Array.isArray(user?.roles)) roles.push(...user.roles);
  if (user?.role) roles.push(user.role);
  return roles.some((r) => String(r || "").toLowerCase() === "admin");
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(null); // username

  const isAdmin = React.useMemo(() => isAdminUser(user), [user]);
  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="text-red-600 font-semibold">Kein Zugriff (nur Admin).</div>
      </div>
    );
  }

  const normalizeRole = (input) => String(input || "").toLowerCase();

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/users", { credentials: "include" });
      const data = res.ok ? await res.json().catch(() => null) : null;
      const list = Array.isArray(data?.users) ? data.users : [];
      setUsers(list);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadUsers();
  }, []);

  async function updateRole(username, role) {
    const nextRole = normalizeRole(role);
    if (!username || !nextRole) return;
    setSaving(username);
    try {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, roles: [nextRole] }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) =>
            u?.username === username
              ? { ...u, roles: [nextRole], role: nextRole }
              : u
          )
        );
      } else {
        alert("Rollenänderung fehlgeschlagen.");
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <Shield className="text-blue-600" />
        <h1 className="text-xl font-bold">Benutzerverwaltung</h1>
      </header>

      {loading ? (
        <div className="text-gray-500">Lade Benutzer…</div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3">Benutzername</th>
                <th className="text-left px-4 py-3">Rolle</th>
                <th className="px-4 py-3">Alle Rollen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u, idx) => {
                const username = String(u?.username || "").trim();
                const rowKey = username || u?.id || `user-${idx}`;
                const roles = Array.isArray(u?.roles) ? u.roles : [];
                const currentRole = roles.length
                  ? normalizeRole(roles[0])
                  : normalizeRole(u?.role);
                const selectedRole = currentRole || "dispo";
                const displayRoles = roles.length
                  ? roles.join(", ")
                  : selectedRole;
                return (
                  <tr key={rowKey}>
                    <td className="px-4 py-3 font-medium">
                      {username || u.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="border rounded-md px-2 py-1"
                        value={selectedRole}
                        onChange={(e) => updateRole(username, e.target.value)}
                        disabled={!username || saving === username}
                      >
                        <option value="admin">admin</option>
                        <option value="dispo">dispo</option>
                        <option value="lager">lager</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <UserCog className="inline-block mr-2 text-gray-400" />
                      <span>{displayRoles}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
