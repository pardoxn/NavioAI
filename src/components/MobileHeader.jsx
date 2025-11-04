// src/components/MobileHeader.jsx
import React from "react";
import { Menu } from "lucide-react";

export default function MobileHeader({ onMenuToggle }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-base font-semibold text-white">
            N
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold text-slate-900 tracking-tight">NavioAI</span>
            <span className="text-xs uppercase tracking-wide text-slate-400">Lager</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition-transform active:scale-95"
          aria-label="Menü öffnen"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
