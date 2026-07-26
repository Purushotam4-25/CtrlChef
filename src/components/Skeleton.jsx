// A plain pulsing placeholder — no library, just enough to read as "loading"
// instead of "broken" during the first fetch of a page's data.
export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-current/10 ${className}`} />;
}

export function SkeletonGrid({ count = 6, itemClassName = "h-24" }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={itemClassName} />
      ))}
    </>
  );
}
