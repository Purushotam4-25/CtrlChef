import { lazy, Suspense } from "react";
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

// Guests — the surface a judge loads first, often on a phone — never hit
// any of these three; lazy-loading them keeps that first bundle to just the
// guest code instead of the whole staff app.
const TableMap = lazy(() => import("./pages/waiter/TableMap"));
const Tickets = lazy(() => import("./pages/chef/Tickets"));
const Dashboard = lazy(() => import("./pages/manager/Dashboard"));

function OpsFallback() {
  return <div className="p-8 text-sm text-neutral-400">Loading…</div>;
}

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
              <Suspense fallback={<OpsFallback />}>
                <TableMap />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/chef"
          element={
            <ProtectedRoute roles={["chef", "manager"]}>
              <Suspense fallback={<OpsFallback />}>
                <Tickets />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute roles={["manager"]}>
              <Suspense fallback={<OpsFallback />}>
                <Dashboard />
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
