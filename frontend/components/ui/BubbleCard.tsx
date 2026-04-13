/** BubbleCard - Reusable glass-effect card container with optional title and subtitle. */
export default function BubbleCard({
  title,
  subtitle,
  children,
  className = "",
  accent = "none",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  accent?: "none" | "blue";
}) {
  const accentRing =
    accent === "blue"
      ? "hover:border-blue/40 hover:shadow-[0_0_0_1px_rgba(75,134,180,0.25)]"
      : "hover:border-black/10";

  return (
    <section
      className={[
        "rounded-3xl border border-black/8 bg-warmSurface",
        "backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.07)]",
        "transition-all duration-200",
        accentRing,
        className,
      ].join(" ")}
    >
      <div className="p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-black/80">{title}</h2>
          {subtitle && (
            <p className="text-xs text-black/50 mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
