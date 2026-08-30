import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Opening splash only:
 * - First time this browser tab loads the app
 * - NOT when switching Chats / Shop / Settings
 * - NOT when a screen is merely loading data
 *
 * Dots fill the outline holes on logo-splash-nodots.png.
 */
const LOGO_SRC = "/icons/logo-splash-nodots.png";
const LOGO_FALLBACK = "/icons/logo-splash.png";
const SESSION_KEY = "xuppin.splash.shown";

const DOT_SLOTS = [
  { left: "38.30%", top: "49.68%" },
  { left: "50.00%", top: "49.69%" },
  { left: "61.62%", top: "49.68%" },
] as const;

export function AppSplash() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<
    "hold" | "dots" | "rise" | "land" | "out" | "done"
  >("done");
  const [dot, setDot] = useState(0);
  const [logoSrc, setLogoSrc] = useState(LOGO_SRC);
  const timersRef = useRef<number[]>([]);
  const startedRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (startedRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") {
      setPhase("done");
      return;
    }

    startedRef.current = true;
    setDot(0);
    setPhase("hold");
    setVisible(true);

    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timersRef.current.push(id);
    };

    later(() => {
      setPhase("dots");
      setDot(1);
    }, 500);
    later(() => setDot(2), 1100);
    later(() => setDot(3), 1700);
    later(() => setPhase("rise"), 2100);
    later(() => setPhase("land"), 2500);
    later(() => setPhase("out"), 2900);
    later(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      setVisible(false);
      setPhase("done");
    }, 3300);

    return () => clearTimers();
  }, [clearTimers]);

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

          <div className="pointer-events-none absolute inset-0">
            {DOT_SLOTS.map((slot, i) => {
              if (dot <= i) return null;
              return (
                <span
                  key={i}
                  className="absolute block rounded-full"
                  style={{
                    left: slot.left,
                    top: slot.top,
                    width: "6.2%",
                    height: "6.2%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: "#2ee6c8",
                    boxShadow: "0 0 12px rgba(46, 230, 200, 0.95)",
                  }}
                />
              );
            })}
          </div>
        </div>

        <p
          className={`mt-6 text-sm font-semibold tracking-[0.25em] text-cyan-300 transition-opacity duration-300 ${
            dot >= 3 ? "opacity-100" : "opacity-40"
          }`}
        >
          XUPPIN
        </p>
      </div>
    </div>
  );
}
