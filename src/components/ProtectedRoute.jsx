import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// roles: array of allowed staff roles, or omit to just require any signed-in staff member
export function ProtectedRoute({ roles, children }) {
  const { user, staff, loading } = useAuth();

  if (loading) return <div className="p-8 text-sm text-neutral-400">Loading…</div>;
  if (!user || !staff) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(staff.role)) return <Navigate to="/login" replace />;

  return children;
}
