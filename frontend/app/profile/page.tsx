export default function ProfilePage() {
  const user = {
    name: "Eric Lin",
    email: "eric@example.com",
    birthday: "2002-01-01",
  };

  return (
    <div className="relative min-h-screen">
      <div
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/background.jpg')" }}
      />
      <div className="fixed inset-0 -z-10 bg-darkBlue/40" />

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white/95 tracking-tight">
            Profile
          </h1>
          <p className="text-white/50 mt-1 text-sm">
            Settings and preferences will live here
          </p>
        </div>

        <section className="glass rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white/70">Account</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Name", value: user.name },
              { label: "Email", value: user.email },
              { label: "Birthday", value: user.birthday },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-4"
              >
                <div className="text-xs text-white/40">{label}</div>
                <div className="mt-1 text-sm font-medium text-white/85">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white/70 mb-4">
            Preferences
          </h2>
          <p className="text-xs text-white/30 text-center py-6">
            Day start/end time, pacing, budget goals and more — coming soon
          </p>
        </section>
      </main>
    </div>
  );
}
