/**
 * Trip detail page — main planning interface for a single trip.
 * Data fetching and CRUD handlers are delegated to useTripData;
 * this file manages UI-only state (panels, modals, reveal overlay).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Plus, Share2, Sparkles } from "lucide-react";
import type { Activity } from "@/lib/types";
import { fetchActivitiesForTrip } from "@/lib/api";
import { TripHeader, TripCalendarStrip, UnscheduledDock, AddActivityPanel, CollaboratorPanel, RecommendationModal, ArrangementBrowser } from "@/components/trip";
import { TripConstellation } from "@/components/constellation";
import { useAuth } from "@/contexts/AuthContext";
import { useTripData } from "@/hooks/useTripData";

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  } = useTripData(tripId);

  // Calendar strip week pagination
  const [weekOffset, setWeekOffset] = useState(0);

  // Add/edit activity panel
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelDayId, setPanelDayId] = useState<number | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  // Constellation reveal overlay
  const [showReveal, setShowReveal] = useState(false);
  const [revealDone, setRevealDone] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Collaborator panel
  const [collabOpen, setCollabOpen] = useState(false);

  // AI modals
  const [recommendOpen, setRecommendOpen] = useState(false);
  const [arrangeOpen, setArrangeOpen] = useState(false);

  useEffect(() => {
    if (searchParams?.get("recommend") === "1") {
      setRecommendOpen(true);
    }
  }, [searchParams]);

  function closeRecommendations() {
    setRecommendOpen(false);
    if (searchParams?.get("recommend") === "1") {
      router.replace(`/trips/${tripId}`);
    }
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

  // Resolve CSS variable colors for PNG export of the constellation SVG
  const COLOR_MAP: Record<string, string> = {
    "rgb(var(--blue))": "rgb(75,134,180)",
    "rgb(var(--lightBlue))": "rgb(149,184,209)",
    "rgb(var(--darkBlue))": "rgb(43,65,98)",
    "rgb(var(--pink))": "rgb(184,107,119)",
  };

  const handleShareImage = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const svgEl = document.querySelector<SVGSVGElement>(".constellation-reveal-overlay svg");
    if (!svgEl) return;

    const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
    let svgString = new XMLSerializer().serializeToString(svgClone);

    for (const [cssVar, resolved] of Object.entries(COLOR_MAP)) {
      svgString = svgString.replaceAll(cssVar, resolved);
    }

    const viewBox = svgEl.getAttribute("viewBox")?.split(" ").map(Number) ?? [0, 0, 500, 300];
    const padding = 40;
    const canvasW = viewBox[2] + padding * 2;
    const canvasH = viewBox[3] + padding * 2;

    const canvas = document.createElement("canvas");
    canvas.width = canvasW * 2;
    canvas.height = canvasH * 2;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    ctx.fillStyle = "rgb(250, 248, 246)";
    ctx.fillRect(0, 0, canvasW, canvasH);

    const img = new Image();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, padding, padding, viewBox[2], viewBox[3]);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(trip?.name ?? "", canvasW / 2, canvasH - 12);

    canvas.toBlob(async (pngBlob) => {
      if (!pngBlob) return;
      const file = new File([pngBlob], `${trip?.name ?? "constellation"}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file] }); } catch {}
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(pngBlob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    }, "image/png");
  }, [trip?.name]);

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const liveUrl = typeof window !== "undefined"
      ? `${window.location.origin}/constellation/${tripId}`
      : `/constellation/${tripId}`;
    await navigator.clipboard.writeText(liveUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
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
        onFinish={() => { setShowReveal(true); setRevealDone(false); }}
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
        activities={unscheduledActivities}
        days={sortedDays}
        onEditActivity={handleEditActivity}
        onDeleteActivity={handleDeleteActivity}
        onScheduleActivity={handleScheduleActivity}
        onAutoArrange={() => setArrangeOpen(true)}
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
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-warmBg constellation-reveal-overlay ${revealDone ? "cursor-pointer" : ""}`}
          onClick={() => revealDone && router.push("/")}
        >
          <p className="text-sm text-black/40 mb-2 tracking-wide uppercase constellation-reveal-title">
            Your constellation
          </p>
          <h2 className="text-2xl font-bold text-black/80 mb-6 constellation-reveal-title">
            {trip.name}
          </h2>
          <div className="w-full max-w-2xl px-8">
            <TripConstellation
              tripId={tripId}
              tripName={trip.name}
              days={sortedDays}
              activitiesByDay={activitiesByDay}
              destination={trip.destination}
              size="reveal"
              revealAnimation
              onRevealComplete={() => setRevealDone(true)}
              onDayClick={(dayId) => router.push(`/trips/${tripId}/day/${dayId}`)}
            />
          </div>
          <p className="mt-8 text-xs text-black/30 constellation-reveal-title">
            Trip saved
          </p>
          <div
            className="mt-4 flex flex-col items-center gap-3 transition-opacity duration-500"
            style={{ opacity: revealDone ? 1 : 0 }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={handleShareImage}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue/90 hover:bg-blue text-xs font-semibold text-white transition"
              >
                <Share2 className="h-3.5 w-3.5" />
                Share Image
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/[0.06] hover:bg-black/[0.10] text-xs text-black/50 transition"
              >
                {linkCopied ? "Link copied!" : "Copy Link"}
              </button>
            </div>
            <p className="text-[11px] text-black/25">
              Tap anywhere to continue
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
