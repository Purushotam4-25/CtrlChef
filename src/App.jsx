import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider, GuestThemeProvider } from "./contexts/ThemeContext";
import { GuestDataProvider } from "./contexts/GuestDataContext";
import { OpsDataProvider } from "./contexts/OpsDataContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import GuestLayout from "./layouts/GuestLayout";
import OpsLayout from "./layouts/OpsLayout";
import Home from "./pages/guest/Home";
import Menu from "./pages/guest/Menu";
import Queue from "./pages/guest/Queue";
import TableStatus from "./pages/guest/TableStatus";
import Account from "./pages/guest/Account";
import OrderHistory from "./pages/guest/OrderHistory";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import StaffRedirect from "./pages/StaffRedirect";
import TableMap from "./pages/waiter/TableMap";
import Tickets from "./pages/chef/Tickets";
import Dashboard from "./pages/manager/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route
        element={
          <GuestThemeProvider>
            <GuestDataProvider>
              <GuestLayout />
            </GuestDataProvider>
          </GuestThemeProvider>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/table/:tableId" element={<TableStatus />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/orders" element={<OrderHistory />} />
      </Route>

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/staff" element={<StaffRedirect />} />

      <Route
        element={
          <ThemeProvider>
            <ToastProvider>
              <OpsDataProvider>
                <OpsLayout />
              </OpsDataProvider>
            </ToastProvider>
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
