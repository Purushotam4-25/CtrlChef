import { lazy, Suspense, useEffect, useState } from "react";
import { getSalesAnalytics } from "../../lib/api";
import { fmtINR } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { useOpsData } from "../../contexts/OpsDataContext";
import { StatTile } from "../../components/ops/primitives";

// A manager typically works one or two tabs a session, not all nine — lazy
// per tab instead of eagerly bundling the whole dashboard on first load.
const AnalyticsTab = lazy(() => import("./AnalyticsTab"));
const InventoryTab = lazy(() => import("./InventoryTab"));
const ForecastTab = lazy(() => import("./ForecastTab"));
const AssistantTab = lazy(() => import("./AssistantTab"));
const StaffTab = lazy(() => import("./StaffTab"));
const OrdersTab = lazy(() => import("./OrdersTab"));
const TablesTab = lazy(() => import("./TablesTab"));
const MenuTab = lazy(() => import("./MenuTab"));
const SettingsTab = lazy(() => import("./SettingsTab"));
const CustomersTab = lazy(() => import("./CustomersTab"));

// Grouped now that there are 9 tabs — a flat row of that many stopped being
// scannable. Still a plain wrapping bar, not a nested/dropdown nav.
const TAB_GROUPS = [
  { group: "Operations", items: [{ key: "orders", label: "Orders" }, { key: "tables", label: "Tables" }] },
  { group: "Catalogue", items: [{ key: "menu", label: "Menu" }, { key: "inventory", label: "Inventory" }] },
  { group: "People", items: [{ key: "staff", label: "Staff" }, { key: "customers", label: "Customers" }] },
  {
    group: "Insight",
    items: [
      { key: "analytics", label: "Analytics" },
      { key: "forecast", label: "Forecast" },
      { key: "assistant", label: "Assistant" },
    ],
  },
  { group: "Settings", items: [{ key: "settings", label: "Settings" }] },
];

export default function Dashboard() {
  const { T } = useOpsTheme();
  const [tab, setTab] = useState("analytics");
  const { restaurant, ingredients, dishes, staffList, tables, openOrders, allOrders, queueList, members } = useOpsData();
  const [revenueTonight, setRevenueTonight] = useState(0);
  const [revenueError, setRevenueError] = useState(false);

  useEffect(() => {
    getSalesAnalytics({ days: 1 })
      .then((res) => {
        setRevenueTonight(res.byDish.reduce((sum, d) => sum + d.revenue, 0));
        setRevenueError(false);
      })
      // A failed call used to leave this silently reading ₹0, indistinguishable
      // from a genuinely quiet night — show it can't be trusted instead.
      .catch(() => setRevenueError(true));
  }, []);

  const lowStockCount = ingredients.filter((i) => i.lowStock).length;
  const staffOnCount = staffList.filter((s) => s.clockedIn).length;

  return (
    <div>
      <div className="mb-3.5 text-[19px] font-bold">Manager Dashboard</div>

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="REVENUE TONIGHT"
          value={revenueError ? "—" : fmtINR(revenueTonight)}
          valueColor={revenueError ? "#f87171" : T.accentBright}
        />
        <StatTile label="OPEN TABS" value={openOrders.length} />
        <StatTile label="LOW STOCK ITEMS" value={lowStockCount} valueColor={lowStockCount > 0 ? "#fbbf24" : T.bright} />
        <StatTile label="STAFF CLOCKED IN" value={staffOnCount} />
        <StatTile label="GUESTS WAITING" value={queueList.length} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-2.5" style={{ borderColor: T.border }}>
        {TAB_GROUPS.map((g) => (
          <div key={g.group} className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wide" style={{ color: T.faintest }}>
              {g.group.toUpperCase()}
            </span>
            {g.items.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold transition-colors hover:brightness-125"
                style={{ background: tab === t.key ? T.accent : "transparent", color: tab === t.key ? "#fff" : T.dim }}
              >
                {t.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      <Suspense fallback={<div style={{ color: T.faint }}>Loading…</div>}>
        {tab === "orders" && <OrdersTab orders={allOrders} restaurant={restaurant} tables={tables} staffList={staffList} />}
        {tab === "tables" && <TablesTab tables={tables} />}
        {tab === "menu" && <MenuTab dishes={dishes} ingredients={ingredients} restaurant={restaurant} />}
        {tab === "inventory" && <InventoryTab ingredients={ingredients} dishes={dishes} />}
        {tab === "staff" && <StaffTab staff={staffList} />}
        {tab === "customers" && <CustomersTab members={members} orders={allOrders} />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "forecast" && <ForecastTab />}
        {tab === "assistant" && <AssistantTab />}
        {tab === "settings" && <SettingsTab restaurant={restaurant} />}
      </Suspense>
    </div>
  );
}
