import { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../firebase";
import { useAuth } from "./AuthContext";

const OpsDataContext = createContext(null);

// One listener per collection for the whole ops surface — TableMap, Tickets,
// and Dashboard (+ its tabs) previously each opened their own listeners for
// the same `tables`/`orders`/`dishes`/`ingredients`/`staff` collections.
// Gated on being signed in as staff — these collections aren't readable by
// anyone else per firestore.rules, so there's nothing to fetch before then.
// `restaurant` is the one exception — it's public-read (name/branding), so
// its listener isn't gated on `currentStaff` like the rest of this context.
export function OpsDataProvider({ children }) {
  const { staff: currentStaff } = useAuth();
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  // A permission error on any listener below used to be silent — no error
  // callback means the SDK just stops delivering updates with nothing
  // logged. Surfaced as one shared flag; OpsLayout shows a small
  // non-blocking banner for it.
  const [error, setError] = useState(false);
  const onError = () => setError(true);

  useEffect(() => {
    return onSnapshot(doc(db, "restaurants", RESTAURANT_ID), (snap) => setRestaurant(snap.data() || null), onError);
  }, []);

  useEffect(() => {
    if (!currentStaff) return;
    // TableMap needs the restaurant's live serviceChargePct/gstPct to
    // preview a bill before closeOrder runs.
    return onSnapshot(doc(db, "restaurants", RESTAURANT_ID), (snap) => setRestaurant(snap.data() || null), onError);
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(
      collection(db, "restaurants", RESTAURANT_ID, "tables"),
      (snap) => {
        setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.number - b.number));
        setLoading(false);
      },
      onError
    );
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    const q = query(collection(db, "restaurants", RESTAURANT_ID, "orders"), where("status", "==", "open"));
    return onSnapshot(q, (snap) => setOpenOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    // Order history for the manager's Orders tab — capped at 50, this is a
    // live dashboard, not an export tool.
    const q = query(collection(db, "restaurants", RESTAURANT_ID, "orders"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => setAllOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(
      collection(db, "restaurants", RESTAURANT_ID, "ingredients"),
      (snap) => setIngredients(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(
      collection(db, "restaurants", RESTAURANT_ID, "staff"),
      (snap) => setStaffList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(
      collection(db, "restaurants", RESTAURANT_ID, "dishes"),
      (snap) => setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    const q = query(
      collection(db, "restaurants", RESTAURANT_ID, "queue"),
      where("status", "==", "waiting"),
      orderBy("checkedInAt", "asc")
    );
    return onSnapshot(q, (snap) => setQueueList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    // Waiter member search (TableMap) and the manager Customers tab both
    // need the full member list — staff can already read it per
    // firestore.rules.
    return onSnapshot(
      collection(db, "restaurants", RESTAURANT_ID, "members"),
      (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      onError
    );
  }, [currentStaff]);

  return (
    <OpsDataContext.Provider
      value={{ restaurant, tables, openOrders, allOrders, ingredients, staffList, dishes, queueList, members, loading, error }}
    >
      {children}
    </OpsDataContext.Provider>
  );
}

export function useOpsData() {
  return useContext(OpsDataContext);
}
