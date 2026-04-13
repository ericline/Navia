/**
 * AccountSection - Inline-editable account fields (name, email, birthday).
 * Each field toggles between display and edit mode independently.
 */
"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountSection() {
  const { user, updateUser } = useAuth();

  const [editingField, setEditingField] = useState<"name" | "email" | "birthday" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  if (!user) return null;

  function startEdit(field: "name" | "email" | "birthday") {
    setEditingField(field);
    setEditError(null);
    if (field === "birthday") {
      setEditValue(user?.birthday ?? "");
    } else {
      setEditValue(user?.[field] ?? "");
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
    setEditError(null);
  }

  async function saveEdit() {
    if (!editingField || !user) return;
    if (editingField === "name" && !editValue.trim()) {
      setEditError("Name cannot be empty");
      return;
    }
    if (editingField === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editValue)) {
      setEditError("Invalid email format");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const data: Record<string, string | null> = {};
      if (editingField === "birthday") {
        data.birthday = editValue || null;
      } else {
        data[editingField] = editValue;
      }
      await updateUser(data);
      setEditingField(null);
      setEditValue("");
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  const formattedBirthday = user.birthday
    ? new Date(user.birthday + "T00:00:00").toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const accountFields: { key: "name" | "email" | "birthday"; label: string; value: string }[] = [
    { key: "name", label: "Name", value: user.name },
    { key: "email", label: "Email", value: user.email },
    { key: "birthday", label: "Birthday", value: formattedBirthday },
  ];

  return (
    <section className="glass bg-warmSurface rounded-2xl p-6 space-y-4">
      <h2 className="text-sm font-semibold text-black/60">Account</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {accountFields.map(({ key, label, value }) => (
          <div
            key={key}
            className="rounded-xl bg-white/60 border border-black/6 p-4 group"
          >
            <div className="text-xs text-black/40 flex items-center justify-between">
              {label}
              {editingField !== key && (
                <button
                  onClick={() => startEdit(key)}
                  className="opacity-0 group-hover:opacity-100 transition p-0.5 rounded hover:bg-black/5"
                >
                  <Pencil className="h-3 w-3 text-black/30" />
                </button>
              )}
            </div>
            {editingField === key ? (
              <div className="mt-1">
                <input
                  type={key === "birthday" ? "date" : key === "email" ? "email" : "text"}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="glass-input w-full rounded-lg px-2 py-1 text-sm text-black/85"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
                {editError && (
                  <p className="text-[10px] text-red-500 mt-1">{editError}</p>
                )}
                <div className="flex items-center gap-1 mt-1.5">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="p-1 rounded-lg bg-blue/10 hover:bg-blue/20 transition disabled:opacity-40"
                  >
                    <Check className="h-3.5 w-3.5 text-blue" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="p-1 rounded-lg hover:bg-black/5 transition"
                  >
                    <X className="h-3.5 w-3.5 text-black/40" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-sm font-medium text-black/80">
                {value}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
