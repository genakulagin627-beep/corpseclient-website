import { useEffect, useState } from "react";
import { request } from "../api/client";

export function ThemePage() {
  const [dark, setDark] = useState("#6b7bff");
  const [light, setLight] = useState("#4d5cff");
  const [message, setMessage] = useState("");

  useEffect(() => {
    request("/api/site/theme").then((t) => {
      setDark(t.accent_dark || "#6b7bff");
      setLight(t.accent_light || "#4d5cff");
    });
  }, []);

  async function save() {
    await request("/api/admin/site-theme", {
      method: "PATCH",
      body: JSON.stringify({ accent_dark: dark, accent_light: light }),
    });
    setMessage("Theme saved");
  }

  return (
    <div className="card">
      <h2>Theme</h2>
      <div className="row">
        <label>
          Dark
          <input type="color" value={dark} onChange={(e) => setDark(e.target.value)} />
        </label>
        <label>
          Light
          <input type="color" value={light} onChange={(e) => setLight(e.target.value)} />
        </label>
      </div>
      <button onClick={save}>Save</button>
      {message ? <p>{message}</p> : null}
    </div>
  );
}
