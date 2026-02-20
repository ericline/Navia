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
  accent?: "none" | "gold" | "honey";
}) {
  const accentRing =
    accent === "gold"
      ? "hover:border-gold/40 hover:shadow-[0_0_0_1px_rgba(255,208,70,0.25)]"
      : accent === "honey"
      ? "hover:border-honey/40 hover:shadow-[0_0_0_1px_rgba(236,164,0,0.25)]"
      : "hover:border-lightBlue/25";

  return (
    <section
      className={[
        "rounded-3xl border border-lightBlue/15 bg-white/[0.04]",
        "backdrop-blur-md shadow-[0_18px_40px_-30px_rgba(0,0,0,0.9)]",
        "transition-all duration-200",
        accentRing,
        className,
      ].join(" ")}
    >
      <div className="p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-lightBlue/95">{title}</h2>
          {subtitle && (
            <p className="text-xs text-lightBlue/70 mt-1 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
