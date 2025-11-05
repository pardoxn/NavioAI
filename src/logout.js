// src/logout.js
export function doLogout() {
  try {
    localStorage.removeItem("auth:user");
    localStorage.removeItem("auth:token");
    sessionStorage.clear();
  } catch {}
  window.location.href = "/login";
}
