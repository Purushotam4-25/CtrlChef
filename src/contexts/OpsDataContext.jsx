import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../firebase";
import { useAuth } from "./AuthContext";

const OpsDataContext = createContext(null);

// One listener per collection for the whole ops surface — TableMap, Tickets,
// and Dashboard (+ its tabs) previously each opened their own listeners for
// the same `tables`/`orders`/`dishes`/`ingredients`/`staff` collections.
// Gated on being signed in as staff — these collections aren't readable by
// anyone else per firestore.rules, so there's nothing to fetch before then.
export function OpsDataProvider({ children }) {
  const { staff: currentStaff } = useAuth();
  const [tables, setTables] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "tables"), (snap) => {
      setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.number - b.number));
      setLoading(false);
    });
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    const q = query(collection(db, "restaurants", RESTAURANT_ID, "orders"), where("status", "==", "open"));
    return onSnapshot(q, (snap) => setOpenOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "ingredients"), (snap) =>
      setIngredients(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "staff"), (snap) =>
      setStaffList(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    return onSnapshot(collection(db, "restaurants", RESTAURANT_ID, "dishes"), (snap) =>
      setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [currentStaff]);

  useEffect(() => {
    if (!currentStaff) return;
    const q = query(
      collection(db, "restaurants", RESTAURANT_ID, "queue"),
      where("status", "==", "waiting"),
      orderBy("checkedInAt", "asc")
    );
    return onSnapshot(q, (snap) => setQueueList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [currentStaff]);

  return (
    <OpsDataContext.Provider value={{ tables, openOrders, ingredients, staffList, dishes, queueList, loading }}>
      {children}
    </OpsDataContext.Provider>
  );
}

export function useOpsData() {
  return useContext(OpsDataContext);
}
