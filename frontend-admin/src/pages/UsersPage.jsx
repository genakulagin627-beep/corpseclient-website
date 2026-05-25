import { useEffect, useState } from "react";
import { request } from "../api/client";

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UsersPage() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const data = await request(`/api/admin/users?limit=50&offset=0&q=${encodeURIComponent(q)}`);
      setUsers(data.users || []);
    } catch (err) {
      if (err.status === 401) setError("Session expired. Please log in again.");
      else if (err.status === 403) setError("Access denied. Admin role is required.");
      else setError("Failed to load users");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(uid, payload) {
    try {
      await request(`/api/admin/users/${uid}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await load();
    } catch (err) {
      if (err.status === 403) setError("Access denied. Admin role is required.");
      else setError("Failed to update user");
    }
  }

  return (
    <div className="card">
      <h2>Users</h2>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by UID, email, nickname" />
        <button onClick={load}>Search</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>UID</th>
            <th>Email</th>
            <th>Nick</th>
            <th>Role</th>
            <th>Subscription</th>
            <th>Banned</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.uid}>
              <td>{u.uid}</td>
              <td>{u.email}</td>
              <td>{u.nickname || "-"}</td>
              <td>{u.role}</td>
              <td>{fmtDate(u.subscription_until)}</td>
              <td>{u.banned ? "Yes" : "No"}</td>
              <td>
                <button onClick={() => patch(u.uid, { banned: !u.banned })}>{u.banned ? "Unban" : "Ban"}</button>
                <button onClick={() => patch(u.uid, { reset_hwid: true })}>Reset HWID</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
