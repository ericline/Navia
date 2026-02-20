import BubbleCard from "@/components/BubbleCard";

export default function ProfilePage() {
  // Placeholder until you add auth/user DB
  const user = {
    name: "Eric Lin",
    email: "eric@example.com",
    birthday: "2002-01-01",
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-sm text-slate-300 mt-1">
          User settings and preferences will live here (day start/end time, pacing, budget goals, etc.).
        </p>
      </div>

      <BubbleCard title="Account" subtitle="Basic info (for now)">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="text-xs text-slate-300">Name</div>
            <div className="mt-1 font-medium">{user.name}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="text-xs text-slate-300">Email</div>
            <div className="mt-1 font-medium">{user.email}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
            <div className="text-xs text-slate-300">Birthday</div>
            <div className="mt-1 font-medium">{user.birthday}</div>
          </div>
        </div>
      </BubbleCard>
    </main>
  );
}
