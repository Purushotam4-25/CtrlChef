import { useState } from "react";
import { cancelQueueEntry, seatFromQueue } from "../../lib/api";
import { fmtElapsed } from "../../lib/format";
import { useOpsData } from "../../contexts/OpsDataContext";
import { useOpsTheme } from "../../contexts/ThemeContext";
import { Button, Modal, Panel } from "../../components/ops/primitives";

export default function QueuePanel({ tables, onError }) {
  const { T } = useOpsTheme();
  const { queueList } = useOpsData();
  const [seatingEntry, setSeatingEntry] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const fittingTablesFor = (partySize) =>
    tables.filter((t) => t.status === "empty" && t.capacity >= partySize).sort((a, b) => a.capacity - b.capacity);

  async function confirmSeat(entry, tableId) {
    if (confirming) return;
    setConfirming(true);
    try {
      // One transactional callable, not two round trips — a failure between
      // "seat the table" and "mark the entry seated" used to leave the table
      // occupied with the queue entry stuck waiting forever.
      await seatFromQueue({ entryId: entry.id, tableId });
      setSeatingEntry(null);
    } catch (e) {
      onError(e.message || "Couldn't seat that party.");
    } finally {
      setConfirming(false);
    }
  }

  async function removeEntry(entry) {
    if (removingId) return;
    setRemovingId(entry.id);
    try {
      await cancelQueueEntry({ entryId: entry.id });
    } catch (e) {
      onError(e.message || "Couldn't remove that party.");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <div className="mb-2 text-[13px] font-bold" style={{ color: T.header }}>
        Queue
        {queueList.length > 0 && (
          <span className="ml-1.5 font-mono text-[11.5px] font-bold" style={{ color: T.faint }}>
            {queueList.length}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2">
        {queueList.map((entry) => {
          const fits = fittingTablesFor(entry.partySize);
          return (
            <Panel key={entry.id} className="p-2.5">
              <div className="text-[13.5px] font-semibold">
                {entry.name} <span style={{ color: T.faint }}>· party of {entry.partySize}</span>
              </div>
              <div className="mt-0.5 text-[11.5px]" style={{ color: T.faint }}>
                Waiting {entry.checkedInAt ? fmtElapsed(Date.now() - entry.checkedInAt.toDate().getTime()) : "—"}
              </div>
              <div className="mt-2 flex gap-1.5">
                <Button
                  variant="primary"
                  className="flex-1"
                  disabled={fits.length === 0}
                  title={fits.length === 0 ? "No empty table fits this party yet" : ""}
                  onClick={() => setSeatingEntry(entry)}
                >
                  Seat
                </Button>
                <Button
                  variant="ghost"
                  disabled={removingId === entry.id}
                  onClick={() => removeEntry(entry)}
                  title="Remove from queue — didn't show, left, etc."
                >
                  No-show
                </Button>
              </div>
            </Panel>
          );
        })}
        {queueList.length === 0 && (
          <div className="text-[12.5px]" style={{ color: T.faint }}>
            Nobody's waiting.
          </div>
        )}
      </div>

      <Modal open={!!seatingEntry} onClose={() => setSeatingEntry(null)} width={300}>
        <div className="mb-3 text-[15px] font-bold">
          Seat {seatingEntry?.name} (party of {seatingEntry?.partySize})
        </div>
        <div className="flex flex-col gap-1.5">
          {seatingEntry &&
            fittingTablesFor(seatingEntry.partySize).map((t) => (
              <button
                key={t.id}
                disabled={confirming}
                onClick={() => confirmSeat(seatingEntry, t.id)}
                className="flex items-center justify-between rounded-md border px-3 py-2.5 text-[13.5px] transition-colors hover:brightness-125 disabled:opacity-50 disabled:hover:brightness-100"
                style={{ background: T.panel2, borderColor: T.borderAlt, color: T.text }}
              >
                <span>Table {t.number}</span>
                <span style={{ color: T.faint }}>{t.capacity} seats</span>
              </button>
            ))}
        </div>
      </Modal>
    </div>
  );
}
