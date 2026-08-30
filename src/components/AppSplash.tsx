import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Uses your uploaded logo: /icons/logo-splash.png
 * 1) Show logo only (~0.5s)
 * 2) Dots 1 → 2 → 3 quickly
 * 3) Rise → land → fade
 * Replays when returning from background.
 */
const LOGO_SRC = "/icons/logo-splash.png";
const LOGO_FALLBACK = "/icons/icon-512.png";

export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<
    "hold" | "dots" | "rise" | "land" | "out" | "done"
  >("done");
  const [dot, setDot] = useState(0);
  const [logoSrc, setLogoSrc] = useState(LOGO_SRC);
  const timersRef = useRef<number[]>([]);
  const playingRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const play = useCallback(() => {
    if (typeof window === "undefined") return;
    if (playingRef.current) return;

    playingRef.current = true;
    clearTimers();

    setDot(0);
    setPhase("hold");
    setVisible(true);

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    // Logo alone — short hold (0.5s), then animation starts
    later(() => {
      setPhase("dots");
      setDot(1);
    }, 500);
    later(() => setDot(2), 750);
    later(() => setDot(3), 1000);
    later(() => setPhase("rise"), 1250);
    later(() => setPhase("land"), 1550);
    later(() => setPhase("out"), 1850);
    later(() => {
      setVisible(false);
      setPhase("done");
      playingRef.current = false;
    }, 2150);
  }, [clearTimers]);

  useEffect(() => {
    play();
    return () => {
      clearTimers();
      playingRef.current = false;
    };
  }, [play, clearTimers]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") play();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) play();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [play]);

  if (!visible || phase === "done") return null;

  const motionClass =
    phase === "rise"
      ? "-translate-y-14 scale-110"
      : phase === "land"
        ? "translate-y-0 scale-100"
        : phase === "out"
          ? "translate-y-0 scale-95 opacity-0"
          : "translate-y-0 scale-100 opacity-100";

  // During hold: no overlay dots (pure image). After: sequential glow.
  const showDotOverlay = phase !== "hold";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050b14]"
      aria-hidden
    >
      <div
        className={`relative flex flex-col items-center transition-all duration-400 ease-out ${motionClass}`}
      >
        <div className="pointer-events-none absolute h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative h-44 w-44">
          <img
            src={logoSrc}
            alt=""
            width={176}
            height={176}
            className="h-44 w-44 rounded-[2rem] object-contain"
            draggable={false}
            onError={() => {
              if (logoSrc !== LOGO_FALLBACK) setLogoSrc(LOGO_FALLBACK);
            }}
          />

          {showDotOverlay ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="flex items-center justify-center gap-[0.85rem]"
                style={{ marginTop: "0.15rem" }}
              >
                {[0, 1, 2].map((i) => {
                  const on = dot > i;
                  return (
                    <span
                      key={i}
                      className="block h-3.5 w-3.5 rounded-full transition-all duration-200 ease-out"
                      style={{
                        backgroundColor: on
                          ? "#2ee6c8"
                          : "rgba(5, 11, 20, 0.55)",
                        boxShadow: on
                          ? "0 0 14px rgba(46, 230, 200, 1)"
                          : "none",
                        transform: on ? "scale(1.15)" : "scale(0.9)",
                        opacity: on ? 1 : 0.85,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <p
          className={`mt-6 text-sm font-semibold tracking-[0.25em] text-cyan-300 transition-opacity duration-200 ${
            dot >= 3 ? "opacity-100" : "opacity-40"
          }`}
        >
          XUPPIN
        </p>
      </div>
    </div>
  );
}
