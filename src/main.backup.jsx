// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root.jsx";   // Gate (Auth + App mit Sidebar)
import Reset from "./Reset.jsx";
import "./index.css";

const path = window.location.pathname;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {path.startsWith("/reset") ? <Reset /> : <Root />}
  </React.StrictMode>
);
