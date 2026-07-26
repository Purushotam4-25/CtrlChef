import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../../firebase";
import { getSalesAnalytics } from "../../lib/api";
import { fmtINR } from "../../lib/format";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { StatTile } from "../../components/ops/primitives";
import AnalyticsTab from "./AnalyticsTab";
import InventoryTab from "./InventoryTab";
import ForecastTab from "./ForecastTab";
import AssistantTab from "./AssistantTab";
import StaffTab from "./StaffTab";

const TABS = [
  { key: "analytics", label: "Analytics" },
  { key: "inventory", label: "Inventory" },
  { key: "forecast", label: "Forecast" },
  { key: "assistant", label: "Assistant" },
  { key: "staff", label: "Staff" },
];

export default function Dashboard() {
  const { T } = useOpsTheme();
  const [tab, setTab] = useState("analytics");
  const [ingredients, setIngredients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [openTabsCount, setOpenTabsCount] = useState(0);
  const [revenueTonight, setRevenueTonight] = useState(0);

  useEffect(
    () => onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "ingredients"), (snap) =>
      setIngredients(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    ),
    []
  );

  useEffect(
    () => onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "staff"), (snap) =>
      setStaff(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    ),
    []
  );

  useEffect(() => {
    const q = query(collection(db, "restaurants", RESTAURANT_ID, "orders"), where("status", "==", "open"));
    return onSnapshot(q, (snap) => setOpenTabsCount(snap.size));
  }, []);

  useEffect(() => {
    getSalesAnalytics({ days: 1 }).then((res) => {
      setRevenueTonight(res.byDish.reduce((sum, d) => sum + d.revenue, 0));
    });
  }, []);

  const lowStockCount = ingredients.filter((i) => i.lowStock).length;
  const staffOnCount = staff.filter((s) => s.clockedIn).length;

  return (
    <div>
      <div className="mb-3.5 text-[19px] font-bold">Manager Dashboard</div>

      <div className="mb-4 grid grid-cols-4 gap-2.5">
        <StatTile label="REVENUE TONIGHT" value={fmtINR(revenueTonight)} valueColor={T.accentBright} />
        <StatTile label="OPEN TABS" value={openTabsCount} />
        <StatTile label="LOW STOCK ITEMS" value={lowStockCount} valueColor={lowStockCount > 0 ? "#fbbf24" : T.bright} />
        <StatTile label="STAFF CLOCKED IN" value={staffOnCount} />
      </div>

      <div className="mb-4 flex gap-1.5 border-b pb-2.5" style={{ borderColor: T.border }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="rounded-md px-3.5 py-1.5 text-[13px] font-semibold"
            style={{ background: tab === t.key ? T.accent : "transparent", color: tab === t.key ? "#fff" : T.dim }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "inventory" && <InventoryTab ingredients={ingredients} />}
      {tab === "forecast" && <ForecastTab />}
      {tab === "assistant" && <AssistantTab />}
      {tab === "staff" && <StaffTab staff={staff} />}
    </div>
  );
}
