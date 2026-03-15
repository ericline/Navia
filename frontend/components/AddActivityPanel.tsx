"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Activity, Day, ActivityCreate, ActivityUpdate } from "@/lib/api";
import { X, Star } from "lucide-react";
import LocationAutocomplete, { ADDRESS_TYPES } from "@/components/LocationAutocomplete";

const inputClass =
  "glass-input w-full rounded-xl px-3 py-2 text-sm text-black/85 placeholder:text-black/30";
const labelClass = "block text-xs mb-1 text-black/50";
const selectClass =
  "glass-input block w-full rounded-xl px-3 py-2 text-sm text-black/85";

interface FormState {
  name: string;
  category: string;
  address: string;
  dayId: string;
  duration: string;
  cost: string;
  energy: string;
  mustDo: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  address: "",
  dayId: "",
  duration: "",
  cost: "",
  energy: "",
  mustDo: false,
};

interface AddActivityPanelProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: ActivityCreate) => Promise<void>;
  onUpdate: (id: number, data: ActivityUpdate) => Promise<void>;
  tripId: number;
  days: Day[];
  preselectedDayId?: number | null;
  editingActivity?: Activity | null;
}

export default function AddActivityPanel({
  open,
  onClose,
  onCreate,
  onUpdate,
  tripId,
  days,
  preselectedDayId,
  editingActivity,
}: AddActivityPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    setMounted(true);
  }, []);

  // Populate form when editing or when preselected day changes
  useEffect(() => {
    if (!open) return;
    if (editingActivity) {
      setForm({
        name: editingActivity.name,
        category: editingActivity.category || "",
        address: editingActivity.address || "",
        dayId: editingActivity.day_id != null ? String(editingActivity.day_id) : "",
        duration:
          editingActivity.est_duration_minutes != null
            ? String(editingActivity.est_duration_minutes)
            : "",
        cost:
          editingActivity.cost_estimate != null
            ? String(editingActivity.cost_estimate)
            : "",
        energy: editingActivity.energy_level || "",
        mustDo: editingActivity.must_do,
      });
    } else {
      setForm({
        ...EMPTY_FORM,
        dayId: preselectedDayId != null ? String(preselectedDayId) : "",
      });
    }
  }, [open, editingActivity, preselectedDayId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;

    const parsedDuration =
      form.duration.trim() === ""
        ? null
        : Number.isNaN(Number(form.duration))
        ? null
        : Number(form.duration);
    const parsedCost =
      form.cost.trim() === ""
        ? null
        : Number.isNaN(Number(form.cost))
        ? null
        : Number(form.cost);
    const dayIdValue = form.dayId === "" ? null : parseInt(form.dayId, 10);

    try {
      setSaving(true);
      if (editingActivity) {
        await onUpdate(editingActivity.id, {
          name: form.name.trim(),
          category: form.category || undefined,
          address: form.address || undefined,
          day_id: dayIdValue,
          unschedule: dayIdValue === null && editingActivity.day_id != null,
          est_duration_minutes: parsedDuration,
          cost_estimate: parsedCost,
          energy_level: form.energy || undefined,
          must_do: form.mustDo,
        });
      } else {
        await onCreate({
          trip_id: tripId,
          day_id: dayIdValue,
          name: form.name.trim(),
          category: form.category || undefined,
          address: form.address || undefined,
          est_duration_minutes: parsedDuration,
          cost_estimate: parsedCost,
          energy_level: form.energy || undefined,
          must_do: form.mustDo,
        });
      }
      setForm(EMPTY_FORM);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open || !mounted) return null;

  const isEditing = !!editingActivity;

  const panel = (
    <div
      className="fixed inset-0 z-50 flex justify-end panel-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Desktop: right panel */}
      <div className="hidden sm:block w-full max-w-md h-full bg-warmBg border-l border-black/10 shadow-2xl overflow-y-auto slide-in-right">
        <PanelContent
          isEditing={isEditing}
          onClose={onClose}
          onSubmit={handleSubmit}
          saving={saving}
          days={days}
          form={form}
          updateField={updateField}
        />
      </div>

      {/* Mobile: bottom sheet */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 max-h-[85vh] bg-warmBg border-t border-black/10 rounded-t-2xl shadow-2xl overflow-y-auto slide-in-up">
        <PanelContent
          isEditing={isEditing}
          onClose={onClose}
          onSubmit={handleSubmit}
          saving={saving}
          days={days}
          form={form}
          updateField={updateField}
        />
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

interface PanelContentProps {
  isEditing: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  days: Day[];
  form: FormState;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}

function PanelContent({
  isEditing,
  onClose,
  onSubmit,
  saving,
  days,
  form,
  updateField,
}: PanelContentProps) {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-blue/60" />
          <h2 className="text-base font-semibold text-black/85">
            {isEditing ? "Edit Star" : "Chart a Star"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 hover:bg-black/[0.06] transition text-black/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-black/40">
        {isEditing
          ? "Update this activity. Change its day or leave uncharted."
          : "Add an activity to your constellation. Assign it to a day or leave uncharted."}
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className={labelClass}>Name *</label>
          <input
            className={inputClass}
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            required
            placeholder="e.g., Reading Terminal Market"
          />
        </div>

        <div>
          <label className={labelClass}>Category</label>
          <input
            className={inputClass}
            value={form.category}
            onChange={(e) => updateField("category", e.target.value)}
            placeholder="food, museum, hike..."
          />
        </div>

        <div>
          <label className={labelClass}>Address</label>
          <LocationAutocomplete
            value={form.address}
            onChange={(val) => updateField("address", val)}
            placeholder="City or specific address"
            className={inputClass}
            types={ADDRESS_TYPES}
          />
        </div>

        <div>
          <label className={labelClass}>Assign to day</label>
          <select
            className={selectClass}
            style={{ colorScheme: "light" }}
            value={form.dayId}
            onChange={(e) => updateField("dayId", e.target.value)}
          >
            <option value="">Uncharted (unscheduled)</option>
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                {day.date}
                {day.name ? ` – ${day.name}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Duration (min)</label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.duration}
              onChange={(e) => updateField("duration", e.target.value)}
              placeholder="e.g., 90"
            />
          </div>
          <div>
            <label className={labelClass}>Cost estimate</label>
            <input
              type="number"
              min={0}
              step="1"
              className={inputClass}
              value={form.cost}
              onChange={(e) => updateField("cost", e.target.value)}
              placeholder="0 = free"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Energy level</label>
          <select
            className={selectClass}
            style={{ colorScheme: "light" }}
            value={form.energy}
            onChange={(e) => updateField("energy", e.target.value)}
          >
            <option value="">Not set</option>
            <option value="low">Low (relaxing)</option>
            <option value="medium">Medium</option>
            <option value="high">High (strenuous)</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            id="panel-must-do"
            type="checkbox"
            className="h-3.5 w-3.5 rounded"
            checked={form.mustDo}
            onChange={(e) => updateField("mustDo", e.target.checked)}
          />
          <label htmlFor="panel-must-do" className="text-xs text-black/55">
            Mark as must-do
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-blue/90 hover:bg-blue px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
        >
          {saving
            ? isEditing
              ? "Updating..."
              : "Charting..."
            : isEditing
            ? "Update star"
            : "Chart this star"}
        </button>
      </form>
    </div>
  );
}
