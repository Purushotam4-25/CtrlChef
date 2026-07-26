import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Landing spot right after login — sends each role to the section of the
// ops app it actually needs. Managers land on the dashboard since "everything"
// starts there per the spec's access table.
const HOME_BY_ROLE = { waiter: "/waiter", chef: "/chef", manager: "/manager" };

export default function StaffRedirect() {
  const { user, staff, loading } = useAuth();

  if (loading) return <div className="p-8 text-sm text-neutral-400">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!staff) return <Navigate to="/login" replace />;

  return <Navigate to={HOME_BY_ROLE[staff.role] || "/login"} replace />;
}
