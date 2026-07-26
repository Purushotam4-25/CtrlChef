import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import GuestLayout from "./layouts/GuestLayout";
import OpsLayout from "./layouts/OpsLayout";
import Home from "./pages/guest/Home";
import Menu from "./pages/guest/Menu";
import Queue from "./pages/guest/Queue";
import Login from "./pages/Login";
import StaffRedirect from "./pages/StaffRedirect";
import TableMap from "./pages/waiter/TableMap";
import Tickets from "./pages/chef/Tickets";
import Dashboard from "./pages/manager/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<GuestLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/queue" element={<Queue />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/staff" element={<StaffRedirect />} />

      <Route
        element={
          <ThemeProvider>
            <OpsLayout />
          </ThemeProvider>
        }
      >
        <Route
          path="/waiter"
          element={
            <ProtectedRoute roles={["waiter", "manager"]}>
              <TableMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chef"
          element={
            <ProtectedRoute roles={["chef", "manager"]}>
              <Tickets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute roles={["manager"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
