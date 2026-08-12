import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { durationLabel } from "@/lib/whatsxup";

type CallKind = "voice" | "video";
type CallState =
  | { phase: "idle" }
  | {
      phase: "outgoing" | "incoming" | "active";
      callId: string;
      peerId: string;
      peerName: string;
      peerAvatar: string | null;
      kind: CallKind;
    };

type Ctx = {
  onlineIds: Set<string>;
  startCall: (peer: { id: string; name: string; avatar: string | null }, kind: CallKind) => Promise<void>;
  state: CallState;
};

const RealtimeContext = createContext<Ctx>({
  onlineIds: new Set(),
  startCall: async () => {},
  state: { phase: "idle" },
});

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [state, setState] = useState<CallState>({ phase: "idle" });
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(null);
  const signalChannel = useRef<RealtimeChannel | null>(null);

  const send = useCallback(async (to: string, type: string, payload: Record<string, unknown>) => {
    const ch = supabase.channel(`signal:${to}`);
    await ch.subscribe();
    await ch.send({ type: "broadcast", event: "signal", payload: { type, from: user?.id, ...payload } });
    setTimeout(() => void supabase.removeChannel(ch), 800);
  }, [user?.id]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    remoteRef.current = null;
    pendingOffer.current = null;
    setMuted(false);
    setCamOff(false);
    setSeconds(0);
    setState({ phase: "idle" });
  }, []);

  const getMedia = useCallback(async (kind: CallKind) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === "video" ? { facingMode: "user" } : false,
      });
      localRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;
      return stream;
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError") {
        toast.error("Permission denied", {
          description: "Allow microphone/camera access in your browser settings to make calls.",
        });
      } else if (name === "NotFoundError") {
        toast.error("No microphone or camera found on this device.");
      } else {
        toast.error("Could not start your microphone or camera.");
      }
      throw err;
    }
  }, []);

  const buildPeer = useCallback(
    (peerId: string, stream: MediaStream) => {
      const pc = new RTCPeerConnection(ICE);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const remote = new MediaStream();
      remoteRef.current = remote;
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
        if (remoteVideo.current) remoteVideo.current.srcObject = remote;
        if (remoteAudio.current) remoteAudio.current.srcObject = remote;
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) void send(peerId, "ice", { candidate: e.candidate.toJSON() });
      };
      pcRef.current = pc;
      return pc;
    },
    [send],
  );

  // Subscribe to my own signaling channel
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`signal:${user.id}`);
    ch.on("broadcast", { event: "signal" }, async ({ payload }) => {
      const p = payload as Record<string, string | undefined> & { [k: string]: unknown };
      if (p["type"] === "offer") {
        pendingOffer.current = p["sdp"] as unknown as RTCSessionDescriptionInit;
        setState({
          phase: "incoming",
          callId: String(p["callId"]),
          peerId: String(p["from"]),
          peerName: String(p["name"] ?? "Unknown"),
          peerAvatar: (p["avatar"] as string) ?? null,
          kind: (p["kind"] as CallKind) ?? "voice",
        });
      } else if (p["type"] === "answer") {
        await pcRef.current?.setRemoteDescription(p["sdp"] as unknown as RTCSessionDescriptionInit);
        setState((s) => (s.phase === "outgoing" ? { ...s, phase: "active" } : s));
      } else if (p["type"] === "ice") {
        try {
          await pcRef.current?.addIceCandidate(p["candidate"] as unknown as RTCIceCandidateInit);
        } catch {
          /* ignore late candidates */
        }
      } else if (p["type"] === "decline") {
        toast.info("Call declined");
        cleanup();
      } else if (p["type"] === "end") {
        cleanup();
      }
    });
    void ch.subscribe();
    signalChannel.current = ch;
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, cleanup]);

  // Global presence
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("presence:online", { config: { presence: { key: user.id } } });
    ch.on("presence", { event: "sync" }, () => {
      setOnlineIds(new Set(Object.keys(ch.presenceState())));
    });
    void ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ at: Date.now() });
    });
    void supabase.from("profiles").update({ is_online: true, last_seen: new Date().toISOString() }).eq("id", user.id);
    const beat = setInterval(() => {
      void supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
    }, 60000);
    return () => {
      clearInterval(beat);
      void supabase.from("profiles").update({ is_online: false }).eq("id", user.id);
      void supabase.removeChannel(ch);
    };
  }, [user]);

  useEffect(() => {
    if (state.phase !== "active") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state.phase]);

  const startCall = useCallback(
    async (peer: { id: string; name: string; avatar: string | null }, kind: CallKind) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("calls")
        .insert({ caller_id: user.id, callee_id: peer.id, kind, status: "ringing" })
        .select("id")
        .single();
      if (error) {
        toast.error(error.message);
        return;
      }
      let stream: MediaStream;
      try {
        stream = await getMedia(kind);
      } catch {
        await supabase.from("calls").update({ status: "failed", ended_at: new Date().toISOString() }).eq("id", data.id);
        return;
      }
      setState({ phase: "outgoing", callId: data.id, peerId: peer.id, peerName: peer.name, peerAvatar: peer.avatar, kind });
      const pc = buildPeer(peer.id, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const { data: me } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single();
      await send(peer.id, "offer", {
        sdp: offer,
        callId: data.id,
        kind,
        name: me?.display_name ?? "Someone",
        avatar: me?.avatar_url ?? null,
      });
    },
    [user, getMedia, buildPeer, send],
  );

  const accept = useCallback(async () => {
    if (state.phase !== "incoming" || !pendingOffer.current) return;
    let stream: MediaStream;
    try {
      stream = await getMedia(state.kind);
    } catch {
      await send(state.peerId, "decline", {});
      cleanup();
      return;
    }
    const pc = buildPeer(state.peerId, stream);
    await pc.setRemoteDescription(pendingOffer.current);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await send(state.peerId, "answer", { sdp: answer });
    await supabase.from("calls").update({ status: "accepted" }).eq("id", state.callId);
    setState({ ...state, phase: "active" });
  }, [state, getMedia, buildPeer, send, cleanup]);

  const decline = useCallback(async () => {
    if (state.phase === "idle") return;
    await send(state.peerId, "decline", {});
    await supabase
      .from("calls")
      .update({ status: state.phase === "incoming" ? "declined" : "missed", ended_at: new Date().toISOString() })
      .eq("id", state.callId);
    cleanup();
  }, [state, send, cleanup]);

  const hangUp = useCallback(async () => {
    if (state.phase === "idle") return;
    await send(state.peerId, "end", {});
    await supabase
      .from("calls")
      .update({ status: state.phase === "active" ? "ended" : "missed", ended_at: new Date().toISOString() })
      .eq("id", state.callId);
    cleanup();
  }, [state, send, cleanup]);

  const value = useMemo(() => ({ onlineIds, startCall, state }), [onlineIds, startCall, state]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
      {state.phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background app-gradient px-6 py-12 safe-bottom">
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <UserAvatar path={state.peerAvatar} name={state.peerName} size="xl" />
            <div>
              <h2 className="text-2xl font-semibold">{state.peerName}</h2>
              <p className="text-sm text-muted-foreground">
                {state.phase === "incoming"
                  ? `Incoming ${state.kind} call`
                  : state.phase === "outgoing"
                    ? "Ringing…"
                    : durationLabel(seconds)}
              </p>
            </div>
          </div>

          {state.kind === "video" && (
            <div className="relative w-full max-w-md flex-1 overflow-hidden rounded-3xl bg-surface my-6">
              <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover" />
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className="absolute bottom-3 right-3 h-32 w-24 rounded-xl border border-border object-cover"
              />
            </div>
          )}
          <audio ref={remoteAudio} autoPlay />

          <div className="flex items-center gap-4">
            {state.phase === "active" && (
              <>
                <Button
                  size="icon"
                  variant={muted ? "secondary" : "outline"}
                  className="h-14 w-14 rounded-full"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
                  }}
                >
                  {muted ? <MicOff /> : <Mic />}
                </Button>
                {state.kind === "video" && (
                  <Button
                    size="icon"
                    variant={camOff ? "secondary" : "outline"}
                    className="h-14 w-14 rounded-full"
                    onClick={() => {
                      const next = !camOff;
                      setCamOff(next);
                      localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
                    }}
                  >
                    {camOff ? <VideoOff /> : <Video />}
                  </Button>
                )}
              </>
            )}
            {state.phase === "incoming" && (
              <Button size="icon" className="h-16 w-16 rounded-full" onClick={() => void accept()}>
                <Phone />
              </Button>
            )}
            <Button
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={() => void (state.phase === "incoming" ? decline() : hangUp())}
            >
              <PhoneOff />
            </Button>
          </div>
        </div>
      )}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
