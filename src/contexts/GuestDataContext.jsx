import { createContext, useContext, useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db, RESTAURANT_ID } from "../firebase";

const GuestDataContext = createContext(null);

// One listener per collection, shared by every guest page — Home, Menu, and
// Queue all previously opened their own `dishes`/`queue` listeners
// independently.
export function GuestDataProvider({ children }) {
  const [restaurant, setRestaurant] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [queueList, setQueueList] = useState([]);
  const [loading, setLoading] = useState(true);
  // A permission error on any of these listeners used to be silent — no
  // error callback means the SDK just stops delivering updates. Surfaced as
  // one shared flag; GuestLayout shows a small non-blocking banner for it.
  const [error, setError] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "restaurants", RESTAURANT_ID),
        (snap) => setRestaurant(snap.data() || null),
        () => setError(true)
      ),
    []
  );

  useEffect(
    () =>
      onSnapshot(
        collection(db, "restaurants", RESTAURANT_ID, "dishes"),
        (snap) => {
          setDishes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        () => setError(true)
      ),
    []
  );

  useEffect(() => {
    const q = query(
      collection(db, "restaurants", RESTAURANT_ID, "queue"),
      where("status", "==", "waiting"),
      orderBy("checkedInAt", "asc")
    );
    return onSnapshot(
      q,
      (snap) => setQueueList(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setError(true)
    );
  }, []);

  return (
    <GuestDataContext.Provider value={{ restaurant, dishes, queueList, loading, error }}>
      {children}
    </GuestDataContext.Provider>
  );
}

export function useGuestData() {
  return useContext(GuestDataContext);
}
