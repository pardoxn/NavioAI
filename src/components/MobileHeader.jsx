// src/components/MobileHeader.jsx
import React from "react";
import { Menu, Navigation, Clock, Sparkles } from "lucide-react";

export default function MobileHeader({
  onMenuToggle,
  activeTab,
  onTabChange,
  toursCount,
  archivedCount,
  latestPlanLabel,
}) {
  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 text-white shadow-lg">
      <div className="mx-auto w-full max-w-md px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                <Navigation className="h-6 w-6 text-white" strokeWidth={2.5} />
              </div>
              <span className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-tight text-white">
                AI
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-semibold leading-tight">Navio AI</span>
              <span className="text-xs uppercase tracking-wide text-slate-200/80">Lager-Ansicht</span>
              {latestPlanLabel && (
                <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-200/80">
                  <Clock className="h-3 w-3" />
                  Zuletzt geplant: {latestPlanLabel}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onMenuToggle}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition-transform active:scale-95"
            aria-label="Menü öffnen"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {toursCount > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-100">
            <Sparkles className="h-3.5 w-3.5" />
            Neue Touren verfügbar
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <TabButton
            label={`Touren (${toursCount})`}
            active={activeTab === "tours"}
            onClick={() => onTabChange?.("tours")}
          />
          <TabButton
            label={`Archiv (${archivedCount})`}
            active={activeTab === "archive"}
            onClick={() => onTabChange?.("archive")}
          />
        </div>
      </div>
    </header>
  );
}

function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex h-11 items-center justify-center rounded-xl border transition-colors " +
        (active
          ? "border-white/30 bg-white/20 text-white shadow-sm"
          : "border-white/10 bg-white/10 text-slate-200 hover:bg-white/15")
      }
    >
      <span className="text-sm font-semibold tracking-wide">{label}</span>
    </button>
  );
}
