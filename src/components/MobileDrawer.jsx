// src/components/MobileDrawer.jsx
import React from "react";
import { X, LogOut, User as UserIcon, Navigation, Archive } from "lucide-react";

function buildDisplayName(user) {
  const raw =
    user?.name ||
    user?.fullName ||
    user?.displayName ||
    user?.username ||
    user?.email ||
    "";
  const trimmed = String(raw || "").trim();
  return trimmed || "Lager-Nutzer";
}

function buildInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "L";
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "L";
}

function buildRoleLabel(role) {
  const value = Array.isArray(role) ? role[0] : role;
  if (!value) return "lager";
  return String(value).toLowerCase();
}

export default function MobileDrawer({
  open,
  onClose,
  onLogout,
  user,
  role,
  onNavigate,
  activeTab,
}) {
  const displayName = buildDisplayName(user);
  const initials = buildInitials(displayName);
  const roleLabel = buildRoleLabel(role || user?.role || user?.roles);

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ease-out ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-80 max-w-[90%] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Profil
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
            aria-label="Menü schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-semibold text-white shadow-inner">
              {initials}
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">
                {displayName}
              </div>
              <div className="flex items-center gap-1 text-sm uppercase tracking-wide text-slate-400">
                <UserIcon className="h-3.5 w-3.5" />
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pt-2">
          <nav className="space-y-2">
            <DrawerNavButton
              icon={Navigation}
              label="Aktive Touren"
              active={activeTab === "tours"}
              onClick={() => {
                onNavigate?.("tours");
              }}
            />
            <DrawerNavButton
              icon={Archive}
              label="Archiv"
              active={activeTab === "archive"}
              onClick={() => {
                onNavigate?.("archive");
              }}
            />
          </nav>
        </div>

        <div className="mt-auto px-6 pb-8">
          <button
            type="button"
            onClick={() => {
              onLogout?.();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-base font-semibold text-white shadow-lg transition-transform active:scale-95"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>
    </div>
  );
}

function DrawerNavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-colors " +
        (active
          ? "border-slate-300 bg-slate-100 text-slate-900"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100")
      }
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      {active && <span className="text-xs font-semibold uppercase text-slate-500">jetzt</span>}
    </button>
  );
}
