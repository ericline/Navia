"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, UserPlus, Crown, Trash2 } from "lucide-react";
import {
  Collaborator,
  fetchCollaborators,
  addCollaborator,
  removeCollaborator,
} from "@/lib/api";

interface CollaboratorPanelProps {
  open: boolean;
  onClose: () => void;
  tripId: number;
  isOwner: boolean;
  ownerName: string;
  ownerEmail: string;
}

export default function CollaboratorPanel({
  open,
  onClose,
  tripId,
  isOwner,
  ownerName,
  ownerEmail,
}: CollaboratorPanelProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchCollaborators(tripId)
      .then((c) => { if (!cancelled) setCollaborators(c); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, tripId]);

  async function handleInvite() {
    if (!email.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const c = await addCollaborator(tripId, email.trim(), role);
      setCollaborators((prev) => [...prev, c]);
      setEmail("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(userId: number) {
    try {
      await removeCollaborator(tripId, userId);
      setCollaborators((prev) => prev.filter((c) => c.user_id !== userId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end panel-backdrop" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-warmSurface shadow-xl slide-in-right flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black/[0.06]">
          <h2 className="text-sm font-semibold text-black/75">Collaborators</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 transition">
            <X className="h-4 w-4 text-black/40" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Owner */}
          <div className="rounded-xl bg-white/60 border border-black/6 p-3 flex items-center gap-3">
            <Crown className="h-4 w-4 text-yellow-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-black/80 truncate">{ownerName}</div>
              <div className="text-[11px] text-black/40 truncate">{ownerEmail}</div>
            </div>
            <span className="text-[10px] text-black/30 bg-black/5 rounded-full px-2 py-0.5">
              Owner
            </span>
          </div>

          {/* Collaborators list */}
          {loading ? (
            <p className="text-xs text-black/40 text-center py-4">Loading...</p>
          ) : collaborators.length === 0 ? (
            <p className="text-xs text-black/35 text-center py-4">
              No collaborators yet
            </p>
          ) : (
            collaborators.map((c) => (
              <div
                key={c.id}
                className="rounded-xl bg-white/60 border border-black/6 p-3 flex items-center gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-black/80 truncate">
                    {c.user_name}
                  </div>
                  <div className="text-[11px] text-black/40 truncate">{c.user_email}</div>
                </div>
                <span className="text-[10px] text-black/30 bg-black/5 rounded-full px-2 py-0.5">
                  {c.role}
                </span>
                {isOwner && (
                  <button
                    onClick={() => handleRemove(c.user_id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </button>
                )}
              </div>
            ))
          )}

          {/* Invite form (owner only) */}
          {isOwner && (
            <div className="space-y-2 pt-2 border-t border-black/[0.06]">
              <h3 className="text-xs font-medium text-black/50">Invite</h3>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="glass-input w-full rounded-xl px-3 py-2 text-sm text-black/85 placeholder:text-black/30"
                onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
              />
              <div className="flex gap-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="glass-input rounded-xl px-3 py-2 text-sm text-black/85 flex-1"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={handleInvite}
                  disabled={inviting || !email.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-blue/90 hover:bg-blue px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-40"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {inviting ? "Adding..." : "Add"}
                </button>
              </div>
              {error && (
                <p className="text-[11px] text-red-500">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
