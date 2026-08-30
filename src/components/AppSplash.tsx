import { useEffect, useState } from "react";

/**
 * Opening splash (no image upload required):
 * 1) Dot 1 → 2 → 3
 * 2) Rise
 * 3) Land
 * 4) Fade out → app
 * Once per tab session.
 */
export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"dots" | "rise" | "land" | "out" | "done">(
    "dots",
  );
  const [dot, setDot] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (sessionStorage.getItem("xuppin.splash.shown") === "1") {
      setPhase("done");
      return;
    }

    setVisible(true);

    const t1 = window.setTimeout(() => setDot(1), 350);
    const t2 = window.setTimeout(() => setDot(2), 700);
    const t3 = window.setTimeout(() => setDot(3), 1050);
    const tRise = window.setTimeout(() => setPhase("rise"), 1450);
    const tLand = window.setTimeout(() => setPhase("land"), 1900);
    const tOut = window.setTimeout(() => setPhase("out"), 2400);
    const tDone = window.setTimeout(() => {
      sessionStorage.setItem("xuppin.splash.shown", "1");
      setVisible(false);
      setPhase("done");
    }, 2900);

    return () => {
      [t1, t2, t3, tRise, tLand, tOut, tDone].forEach((id) =>
        window.clearTimeout(id),
      );
    };
  }, []);

  if (!visible || phase === "done") return null;

  const motionClass =
    phase === "rise"
      ? "-translate-y-14 scale-110"
      : phase === "land"
        ? "translate-y-0 scale-100"
        : phase === "out"
          ? "translate-y-0 scale-95 opacity-0"
          : "translate-y-0 scale-100 opacity-100";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050b14]"
      aria-hidden
    >
      <div
        className={`relative flex flex-col items-center transition-all duration-500 ease-out ${motionClass}`}
      >
        <div className="pointer-events-none absolute h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl" />

        {/* Drawn logo — matches your cyan bubble; no PNG needed */}
        <svg
          width="168"
          height="168"
          viewBox="0 0 200 200"
          className="drop-shadow-[0_0_28px_rgba(34,230,200,0.4)]"
        >
          {/* Rounded square bg */}
          <rect
            x="8"
            y="8"
            width="184"
            height="184"
            rx="42"
            fill="#0a1628"
          />
          {/* Chat bubble ring */}
          <path
            d="M100 42c-32 0-58 24-58 54 0 18 9 34 24 44v22l24-14c3 1 7 1 10 1 32 0 58-24 58-53S132 42 100 42z"
            fill="none"
            stroke="#2ee6c8"
            strokeWidth="14"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Three dots — light one by one */}
          {[0, 1, 2].map((i) => {
            const on = dot > i;
            const cx = 72 + i * 28;
            return (
              <circle
                key={i}
                cx={cx}
                cy={98}
                r={on ? 9 : 7}
                fill={on ? "#2ee6c8" : "rgba(46,230,200,0.2)"}
                style={{
                  filter: on
                    ? "drop-shadow(0 0 8px #2ee6c8)"
                    : undefined,
                  transition: "all 0.3s ease-out",
                }}
              />
            );
          })}
        </svg>

        <p
          className={`mt-7 text-sm font-semibold tracking-[0.25em] text-cyan-300 transition-opacity duration-300 ${
            dot >= 3 ? "opacity-100" : "opacity-30"
          }`}
        >
          XUPPIN
        </p>
      </div>
    </div>
  );
}
