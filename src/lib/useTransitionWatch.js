import { useEffect, useRef } from "react";

// Watches a list of items for a field transitioning to a new value — fires
// onChange(item, prevValue, nextValue) once per transition. Never fires on
// the first snapshot (nothing to diff against yet) and never when the value
// didn't actually change between snapshots, so an unrelated re-fire of the
// same onSnapshot listener stays silent. Used for all three toast triggers:
// an item's status flipping to "ready", a new ticket appearing (undefined ->
// "received"), an ingredient going low (false -> true).
export function useTransitionWatch(items, keyFn, fieldFn, onChange) {
  const prevRef = useRef(null);
  // Ref so the effect always calls the latest onChange without re-running
  // (and re-diffing) every time the caller's inline callback is re-created.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const prev = prevRef.current;
    const next = new Map(items.map((item) => [keyFn(item), fieldFn(item)]));

    if (prev) {
      for (const item of items) {
        const key = keyFn(item);
        const prevValue = prev.has(key) ? prev.get(key) : undefined;
        const nextValue = fieldFn(item);
        if (prevValue !== nextValue) {
          onChangeRef.current(item, prevValue, nextValue);
        }
      }
    }

    prevRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}
