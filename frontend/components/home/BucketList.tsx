/**
 * BucketList - localStorage-backed wishlist for future trip ideas.
 * Each item has a name, location (with autocomplete), and optional notes.
 */
"use client";

import { MapPin, Trash2, Plus } from "lucide-react";
import LocationAutocomplete from "@/components/ui/LocationAutocomplete";
import { useBucketList } from "@/hooks/useBucketList";

export default function BucketList() {
  const {
    bucket,
    newBucketName,
    newBucketLoc,
    newBucketNotes,
    setNewBucketName,
    setNewBucketLoc,
    setNewBucketNotes,
    addBucket,
    updateBucket,
    deleteBucket,
  } = useBucketList();

  return (
    <section className="glass bg-coolCard rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-black/75 mb-3 flex items-center gap-2">
        Bucket List
        {bucket.length > 0 && (
          <span className="text-[10px] text-blue/50 bg-blue/[0.08] rounded-full px-2 py-0.5">
            {bucket.length}
          </span>
        )}
      </h2>

      <div className="space-y-2 pr-1 mb-3">
        {bucket.length === 0 ? (
          <p className="text-xs text-black/30 py-4 text-center">
            Save ideas for future trips
          </p>
        ) : (
          bucket.map((b) => (
            <div key={b.id} className="rounded-xl bg-black/[0.03] p-3 group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    className="bg-transparent text-sm text-black/75 w-full focus:outline-none truncate"
                    value={b.name}
                    onChange={(e) => updateBucket(b.id, { name: e.target.value })}
                  />
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="h-2.5 w-2.5 text-black/30 shrink-0" />
                    <LocationAutocomplete
                      value={b.location}
                      onChange={(val) => updateBucket(b.id, { location: val })}
                      containerClassName="flex-1 min-w-0"
                      className="bg-transparent text-[11px] text-black/40 w-full focus:outline-none"
                    />
                  </div>
                </div>
                <button
                  onClick={() => deleteBucket(b.id)}
                  className="text-black/20 hover:text-blue/70 transition opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea
                className="mt-1.5 w-full bg-transparent text-[11px] text-black/30 resize-none focus:outline-none"
                value={b.notes}
                onChange={(e) => updateBucket(b.id, { notes: e.target.value })}
                rows={1}
                placeholder="Notes..."
              />
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl bg-black/[0.03] p-3 space-y-2">
        <div className="flex gap-2">
          <input
            className="glass-input flex-1 rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            placeholder="Activity name"
          />
          <LocationAutocomplete
            value={newBucketLoc}
            onChange={setNewBucketLoc}
            placeholder="Location"
            containerClassName="flex-1"
            className="glass-input w-full rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
          />
        </div>
        <div className="flex gap-2">
          <input
            className="glass-input flex-1 rounded-lg px-3 py-1.5 text-xs text-black/75 placeholder:text-black/40"
            value={newBucketNotes}
            onChange={(e) => setNewBucketNotes(e.target.value)}
            placeholder="Notes (optional)"
          />
          <button
            onClick={addBucket}
            className="rounded-lg bg-pink/30 hover:bg-pink/50 border border-pink/40 px-3 py-1.5 text-xs text-pink transition flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      </div>
    </section>
  );
}
