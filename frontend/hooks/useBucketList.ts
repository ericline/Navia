/**
 * Hook for managing the user's bucket list.
 *
 * Bucket items are Activity rows with trip_id=null, authenticated via the user's
 * token. The first mount after upgrade migrates any legacy localStorage entries
 * (keyed at `navia_bucket` as {id,name,location,notes}) into the backend, then
 * clears the key.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ActivityUpdate,
  createActivity,
  deleteActivity,
  fetchBucketActivities,
  updateActivity,
} from "@/lib/api";

const LEGACY_STORAGE_KEY = "navia_bucket";
const MIGRATION_FLAG = "navia_bucket_migrated_v1";

export function useBucketList() {
  const [bucket, setBucket] = useState<Activity[]>([]);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketAddress, setNewBucketAddress] = useState("");
  const [newBucketNotes, setNewBucketNotes] = useState("");
  const [newBucketCoords, setNewBucketCoords] = useState<[number, number] | null>(null);
  const [newBucketCategory, setNewBucketCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const items = await fetchBucketActivities();
      setBucket(items);
    } catch (err) {
      console.warn("fetchBucketActivities failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // One-time migration + initial load.
  useEffect(() => {
    (async () => {
      if (typeof window !== "undefined" && !localStorage.getItem(MIGRATION_FLAG)) {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (raw) {
          try {
            const legacy = JSON.parse(raw) as Array<{
              name: string;
              location?: string;
              notes?: string;
            }>;
            for (const item of legacy) {
              if (!item?.name) continue;
              try {
                await createActivity({
                  trip_id: null,
                  name: item.name,
                  address: item.location ?? undefined,
                  notes: item.notes ?? undefined,
                });
              } catch (err) {
                console.warn("bucket migrate item failed", err);
              }
            }
          } catch {
            // corrupt json — drop silently
          }
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
        localStorage.setItem(MIGRATION_FLAG, "1");
      }
      await refresh();
    })();
  }, [refresh]);

  async function addBucket() {
    if (!newBucketName || !newBucketAddress) return;
    try {
      const created = await createActivity({
        trip_id: null,
        name: newBucketName,
        address: newBucketAddress,
        lat: newBucketCoords?.[1] ?? null,
        lng: newBucketCoords?.[0] ?? null,
        category: newBucketCategory || undefined,
        notes: newBucketNotes || undefined,
      });
      setBucket((prev) => [...prev, created]);
      setNewBucketName("");
      setNewBucketAddress("");
      setNewBucketNotes("");
      setNewBucketCoords(null);
      setNewBucketCategory("");
    } catch (err) {
      console.warn("addBucket failed", err);
    }
  }

  async function updateBucket(id: number, patch: ActivityUpdate) {
    // Optimistic UI — server truth reconciles on response.
    setBucket((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } as Activity : b))
    );
    try {
      const updated = await updateActivity(id, patch);
      setBucket((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } catch (err) {
      console.warn("updateBucket failed", err);
      await refresh();
    }
  }

  async function deleteBucket(id: number) {
    setBucket((prev) => prev.filter((b) => b.id !== id));
    try {
      await deleteActivity(id);
    } catch (err) {
      console.warn("deleteBucket failed", err);
      await refresh();
    }
  }

  return {
    bucket,
    loading,
    newBucketName,
    newBucketAddress,
    newBucketNotes,
    newBucketCoords,
    newBucketCategory,
    setNewBucketName,
    setNewBucketAddress,
    setNewBucketNotes,
    setNewBucketCoords,
    setNewBucketCategory,
    addBucket,
    updateBucket,
    deleteBucket,
    refresh,
  };
}
