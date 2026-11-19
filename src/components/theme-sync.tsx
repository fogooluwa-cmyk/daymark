"use client";

import { useEffect } from "react";

export default function ThemeSync() {
  useEffect(() => {
    const saved = window.localStorage.getItem("daymark.theme");
    if (saved === "dark" || saved === "light") document.documentElement.dataset.theme = saved;
  }, []);
  return null;
}
