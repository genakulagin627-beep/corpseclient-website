import { Navigate, Route, Routes, Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken, hasToken } from "./api/client";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UsersPage } from "./pages/UsersPage";
import { KeysPage } from "./pages/KeysPage";
import { ThemePage } from "./pages/ThemePage";
import "./App.css";

function ProtectedRoute({ children }) {
  if (!hasToken()) return <Navigate to="/login" replace />;
  return children;
}

function ShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  const links = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/users", label: "Users" },
    { to: "/keys", label: "Keys" },
    { to: "/theme", label: "Theme" },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <h1>CorpseClient Admin</h1>
        {links.map((item) => (
          <Link key={item.to} to={item.to} className={location.pathname === item.to ? "active" : ""}>
            {item.label}
          </Link>
        ))}
        <button onClick={onLogout}>Logout</button>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/keys" element={<KeysPage />} />
          <Route path="/theme" element={<ThemePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <ShellLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
