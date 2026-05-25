import { useEffect, useState } from "react";
import { request } from "../api/client";

export function KeysPage() {
  const [keys, setKeys] = useState([]);
  const [days, setDays] = useState(30);
  const [count, setCount] = useState(1);
  const [created, setCreated] = useState("");

  async function load() {
    const data = await request("/api/admin/keys?limit=100");
    setKeys(data.keys || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createKeys() {
    const data = await request("/api/admin/keys", {
      method: "POST",
      body: JSON.stringify({
        duration_days: Number(days),
        duration_hours: 0,
        duration_minutes: 0,
        count: Number(count),
      }),
    });
    setCreated((data.keys || []).map((x) => x.code).join("\n"));
    await load();
  }

  return (
    <div className="card">
      <h2>Keys</h2>
      <div className="row">
        <input type="number" value={days} onChange={(e) => setDays(e.target.value)} placeholder="Days" />
        <input type="number" value={count} onChange={(e) => setCount(e.target.value)} placeholder="Count" />
        <button onClick={createKeys}>Create</button>
      </div>
      {created ? <pre>{created}</pre> : null}
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Duration</th>
            <th>Created</th>
            <th>Used</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.code}>
              <td>{k.code}</td>
              <td>{k.duration_label}</td>
              <td>{k.created_at}</td>
              <td>{k.used_at || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
