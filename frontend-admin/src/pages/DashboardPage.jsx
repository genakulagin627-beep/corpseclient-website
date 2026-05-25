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

export function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/api/admin/stats")
      .then(setStats)
      .catch(() => setError("Failed to load stats"));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p>Loading...</p>;

  return (
    <div className="dashboard-stack">
      <div className="grid grid-4">
        <article className="card metric">
          <p className="metric-label">Users</p>
          <p className="metric-value">{stats.users_total}</p>
        </article>
        <article className="card metric">
          <p className="metric-label">Active subscriptions</p>
          <p className="metric-value">{stats.active_subscriptions ?? 0}</p>
        </article>
        <article className="card metric">
          <p className="metric-label">Keys used / total</p>
          <p className="metric-value">
            {stats.keys_used ?? 0} / {stats.keys_total ?? 0}
          </p>
        </article>
        <article className="card metric">
          <p className="metric-label">Banned users</p>
          <p className="metric-value">{stats.banned_users ?? 0}</p>
        </article>
      </div>

      <div className="grid grid-2">
        <article className="card">
          <h3>Service counters</h3>
          <p>Launches: {stats.launches_total}</p>
          <p>Updates: {stats.updates_total}</p>
          <p>Last update: {fmtDate(stats.last_update_at)}</p>
        </article>

        <article className="card">
          <h3>Recent users</h3>
          <table>
            <thead>
              <tr>
                <th>UID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Subscription</th>
              </tr>
            </thead>
            <tbody>
              {(stats.latest_users || []).map((u) => (
                <tr key={u.uid}>
                  <td>{u.uid}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{fmtDate(u.subscription_until)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </div>
    </div>
  );
}
