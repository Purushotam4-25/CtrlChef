import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useGuestTheme } from "../../contexts/ThemeContext";
import { getMyOrderHistory } from "../../lib/api";
import { fmtINR } from "../../lib/format";

export default function OrderHistory() {
  const { T } = useGuestTheme();
  const { user, accountType, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    if (accountType !== "member") return;
    getMyOrderHistory({ memberId: user.uid }).then((res) => setOrders(res.orders));
  }, [accountType, user]);

  if (authLoading) return <div className="mx-auto max-w-[720px] px-8 py-14 text-sm" style={{ color: T.faint }}>Loading…</div>;

  if (accountType !== "member") {
    return (
      <div className="mx-auto max-w-[720px] px-8 py-14 text-center">
        <div className="mb-3 text-[15px] font-bold">Sign in to see your order history</div>
        <Link to="/account" className="text-[13px] font-semibold underline" style={{ color: T.accent }}>
          Go to my account
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-8 pb-14 pt-10">
      <div className="mb-1 text-[11px] font-semibold tracking-wide" style={{ color: T.faint }}>MY ACCOUNT</div>
      <h1 className="mb-5 font-serif text-[28px] font-bold">Order history</h1>

      {orders === null && <div className="text-sm" style={{ color: T.faint }}>Loading your orders…</div>}
      {orders?.length === 0 && <div className="text-sm" style={{ color: T.faint }}>No orders yet.</div>}

      <div className="flex flex-col gap-3">
        {orders?.map((o) => {
          const at = o.createdAt ? new Date(o.createdAt) : null;
          const total = o.bill?.total ?? o.totalAmount;
          return (
            <div key={o.id} className="rounded-lg border p-4" style={{ borderColor: T.border, background: T.panel }}>
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[12.5px]" style={{ color: T.faint }}>
                  {at ? at.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </div>
                <div className="font-mono text-[15px] font-bold" style={{ color: T.text }}>{fmtINR(total)}</div>
              </div>
              <div className="flex flex-col gap-0.5">
                {o.items.map((item) => (
                  <div key={item.itemId} className="flex justify-between text-[13px]" style={{ color: T.cardText }}>
                    <span>{item.dishName} ×{item.qty}</span>
                    <span className="font-mono">{fmtINR(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
