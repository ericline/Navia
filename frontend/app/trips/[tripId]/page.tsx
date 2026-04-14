/**
 * Trip detail page — main planning interface for a single trip.
 * Data fetching and CRUD handlers are delegated to useTripData;
 * this file manages UI-only state (panels, modals, reveal overlay).
 */
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import type { Activity } from "@/lib/types";
import { TripHeader, TripCalendarStrip, UnscheduledDock, AddActivityPanel, CollaboratorPanel, RecommendationModal, ArrangementBrowser } from "@/components/trip";
import { ConstellationRevealOverlay } from "@/components/constellation";
import { useAuth } from "@/contexts/AuthContext";
import { useTripData } from "@/hooks/useTripData";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const tripIdParam = params?.tripId;
  const tripId = Array.isArray(tripIdParam)
    ? parseInt(tripIdParam[0], 10)
    : parseInt(tripIdParam as string, 10);

  const {
    trip,
    sortedDays,
    activities,
    activitiesByDay,
    unscheduledActivities,
    loading,
    error,
    refreshActivities,
    handleDeleteTrip,
    handleCreateActivity,
    handleUpdateActivity,
    handleDeleteActivity,
    handleReorderActivities,
    handleScheduleActivity,
    handleMoveActivityToDay,
    handleUpdateDay,
    handleToggleMustDo,
  } = useTripData(tripId);

  // Calendar strip week pagination
  const [weekOffset, setWeekOffset] = useState(0);

  // Add/edit activity panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDayId, setPanelDayId] = useState<number | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Constellation reveal overlay
  const [showReveal, setShowReveal] = useState(false);

  // Collaborator panel
  const [collabOpen, setCollabOpen] = useState(false);

  // AI modals. Initialize recommendOpen from ?recommend=1 synchronously so
  // the deep-link entry never goes through a false→true toggle. The URL flag
  // is intentionally left in place; React's state is the source of truth for
  // "modal open", so touching the URL would only risk triggering a re-render.
  const [recommendOpen, setRecommendOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("recommend") === "1";
  });
  const [arrangeOpen, setArrangeOpen] = useState(false);

  function closeRecommendations() {
    setRecommendOpen(false);
  }

  function handleOpenPanel(dayId?: number) {
    setEditingActivity(null);
    setPanelDayId(dayId ?? null);
    setPanelOpen(true);
  }

  function handleEditActivity(activity: Activity) {
    setEditingActivity(activity);
    setPanelDayId(null);
    setPanelOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-black/40">Loading trip...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm text-red-500">{error ?? "Trip not found."}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-6 pb-20">
      <TripHeader
        trip={trip}
        onDelete={handleDeleteTrip}
        onFinish={() => setShowReveal(true)}
        onCollaborators={() => setCollabOpen(true)}
      />

      {sortedDays.length > 0 ? (
        <TripCalendarStrip
          days={sortedDays}
          activitiesByDay={activitiesByDay}
          weekOffset={weekOffset}
          onWeekChange={setWeekOffset}
          onAddActivity={handleOpenPanel}
          onEditActivity={handleEditActivity}
          onDeleteActivity={handleDeleteActivity}
          onToggleMustDo={handleToggleMustDo}
          tripName={trip.name}
          onViewDayMap={(dayId) => router.push(`/trips/${tripId}/day/${dayId}`)}
          onReorderActivities={handleReorderActivities}
          onMoveActivity={handleMoveActivityToDay}
          onUpdateDay={handleUpdateDay}
          defaultDayStart={user?.preferences?.day_start ?? "09:00:00"}
          defaultDayEnd={user?.preferences?.day_end ?? "21:00:00"}
        />
      ) : (
        <section className="glass bg-warmSurface rounded-2xl p-8 text-center">
          <p className="text-sm text-black/40">
            No days available for this trip.
          </p>
        </section>
      )}

      <button
        onClick={() => setRecommendOpen(true)}
        className="fixed bottom-32 right-6 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-blue/90 shadow-lg hover:bg-blue transition constellation-star-today"
        title="AI suggestions based on your trip so far"
      >
        <Sparkles className="h-5 w-5 text-white" />
      </button>

      <button
        onClick={() => handleOpenPanel()}
        className="fixed bottom-16 right-6 z-30 flex items-center justify-center w-12 h-12 rounded-full bg-blue shadow-lg hover:bg-blue/90 transition constellation-star-today"
      >
        <Plus className="h-5 w-5 text-white" />
      </button>

      <UnscheduledDock
        tripId={tripId}
        activities={unscheduledActivities}
        days={sortedDays}
        onEditActivity={handleEditActivity}
        onDeleteActivity={handleDeleteActivity}
        onScheduleActivity={handleScheduleActivity}
        onAutoArrange={() => setArrangeOpen(true)}
        onActivityChanged={refreshActivities}
      />

      <RecommendationModal
        open={recommendOpen}
        tripId={tripId}
        onClose={closeRecommendations}
        onAdded={refreshActivities}
      />

      <ArrangementBrowser
        open={arrangeOpen}
        tripId={tripId}
        days={sortedDays}
        activities={activities}
        onClose={() => setArrangeOpen(false)}
        onApplied={refreshActivities}
      />

      <AddActivityPanel
        open={panelOpen}
        onClose={() => { setPanelOpen(false); setEditingActivity(null); }}
        onCreate={handleCreateActivity}
        onUpdate={handleUpdateActivity}
        tripId={tripId}
        days={sortedDays}
        preselectedDayId={panelDayId}
        editingActivity={editingActivity}
      />

      <CollaboratorPanel
        open={collabOpen}
        onClose={() => setCollabOpen(false)}
        tripId={tripId}
        isOwner={!!user && user.id === trip?.owner_id}
        ownerName={trip?.owner_name ?? ""}
        ownerEmail={trip?.owner_email ?? ""}
      />

      {showReveal && (
        <ConstellationRevealOverlay
          tripId={tripId}
          tripName={trip.name}
          days={sortedDays}
          activitiesByDay={activitiesByDay}
          destination={trip.destination}
          onClose={() => {
            setShowReveal(false);
            router.push("/");
          }}
          onDayClick={(dayId) => router.push(`/trips/${tripId}/day/${dayId}`)}
        />
      )}
    </main>
  );
}
