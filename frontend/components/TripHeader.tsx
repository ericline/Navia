"use client";

import { Trip } from "@/lib/api";
import { formatDate, formatDestination } from "@/lib/utils";
import { MapPin, Calendar, Trash2, CheckCircle, Users } from "lucide-react";

interface TripHeaderProps {
  trip: Trip;
  onDelete: () => void;
  onFinish: () => void;
  onCollaborators?: () => void;
}

export default function TripHeader({ trip, onDelete, onFinish, onCollaborators }: TripHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-black/85 tracking-tight">
          {trip.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-black/40" />
            <span className="text-sm text-black/50">{formatDestination(trip.destination)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-black/40" />
            <span className="text-sm text-black/50">
              {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-black/35">
          {trip.timezone}
        </span>
        {onCollaborators && (
          <button
            onClick={onCollaborators}
            className="flex items-center gap-1.5 rounded-xl border border-black/10 hover:bg-black/5 px-3 py-1.5 text-xs text-black/50 transition"
          >
            <Users className="h-3.5 w-3.5" />
            Collaborators
          </button>
        )}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 rounded-xl border border-red-400/20 text-red-400/60 hover:bg-red-400/10 hover:border-red-400/30 hover:text-red-400/80 px-3 py-1.5 text-xs transition"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
        <button
          onClick={onFinish}
          className="flex items-center gap-1.5 rounded-xl bg-blue/90 hover:bg-blue px-3 py-1.5 text-xs font-semibold text-white transition"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Finish
        </button>
      </div>
    </div>
  );
}
