import React, { useEffect } from "react";
import App from "./App.jsx";
import WarehouseMobileApp from "./roles/WarehouseMobileApp.jsx";

export default function RoleRouter() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem("auth:user") || "null"); } catch {}

  // Not-Aus: ?logout=1
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("logout")) {
      try {
        localStorage.removeItem("auth:user");
        localStorage.removeItem("auth:token");
        sessionStorage.clear();
      } catch {}
      window.history.replaceState({}, "", window.location.pathname);
      window.location.replace("/login");
    }
  }, []);

  if (!saved) return <App />;             // => Login-Screen in App
  return saved.role === "lager" ? <WarehouseMobileApp /> : <App />;
}
