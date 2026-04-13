/**
 * Hook for managing the user's bucket list, persisted in localStorage.
 * Items are simple wishlist entries (name, location, notes) not tied to any trip.
 */

import { useEffect, useState } from "react";
import type { BucketItem } from "@/lib/types";

const STORAGE_KEY = "navia_bucket";

export function useBucketList() {
  const [bucket, setBucket] = useState<BucketItem[]>([]);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketLoc, setNewBucketLoc] = useState("");
  const [newBucketNotes, setNewBucketNotes] = useState("");

  // Load from localStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setBucket(JSON.parse(raw));
      } catch {}
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket));
  }, [bucket]);

  function addBucket() {
    if (!newBucketName || !newBucketLoc) return;
    setBucket((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: newBucketName,
        location: newBucketLoc,
        notes: newBucketNotes,
      },
    ]);
    setNewBucketName("");
    setNewBucketLoc("");
    setNewBucketNotes("");
  }

  function updateBucket(id: string, patch: Partial<BucketItem>) {
    setBucket((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }

  function deleteBucket(id: string) {
    setBucket((prev) => prev.filter((b) => b.id !== id));
  }

  return {
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
  };
}
