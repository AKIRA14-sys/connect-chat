import { notifyIncomingCall } from "@/lib/push.functions";
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
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { durationLabel } from "@/lib/whatsxup";

type CallKind = "voice" | "video";

type SignalPayload = {
  type: string;
  from?: string;
  to?: string;
  callId?: string;
  kind?: CallKind;
  name?: string;
  avatar?: string | null;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type CallState =
  | {
      phase: "idle";
    }
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
  startCall: (
    peer: {
      id: string;
      name: string;
      avatar: string | null;
    },
    kind: CallKind,
  ) => Promise<void>;
  state: CallState;
};

const RealtimeContext = createContext<Ctx>({
  onlineIds: new Set(),
  startCall: async () => {},
  state: { phase: "idle" },
});

const ICE: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ],
};

export function RealtimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  const [onlineIds, setOnlineIds] = useState<Set<string>>(
    new Set(),
  );

  const [state, setState] = useState<CallState>({
    phase: "idle",
  });

  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [sharingScreen, setSharingScreen] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);

  const localRef = useRef<MediaStream | null>(null);

  const remoteRef = useRef<MediaStream | null>(null);

  const localVideo = useRef<HTMLVideoElement | null>(null);

  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  const remoteAudio = useRef<HTMLAudioElement | null>(null);

  /*
   * The user's permanent signaling channel.
   *
   * signal:<our-user-id>
   *
   * This channel stays alive while the user is logged in.
   */
  const signalChannel = useRef<RealtimeChannel | null>(null);

  const signalReady = useRef(false);

  /*
   * Pending incoming offer.
   */
  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(
    null,
  );

  /*
   * ICE received before remoteDescription.
   */
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

  /*
   * Prevent processing the same database ringing call repeatedly.
   */
  const handledIncomingCallId = useRef<string | null>(null);

  /*
   * Current outgoing call information.
   */
  const outgoingCallRef = useRef<{
    callId: string;
    peerId: string;
    kind: CallKind;
    callerName: string;
    callerAvatar: string | null;
    offer?: RTCSessionDescriptionInit;
  } | null>(null);

  /*
   * -------------------------------------------------------
   * SEND THROUGH THE USER'S PERMANENT SIGNAL CHANNEL
   * -------------------------------------------------------
   */

  const sendSignal = useCallback(
    async (
      to: string,
      type: string,
      payload: Record<string, unknown> = {},
    ) => {
      if (!user?.id || !to) {
        return false;
      }

      const channel = signalChannel.current;

      if (!channel || !signalReady.current) {
        console.warn(
          "[WHATSXUP SIGNAL] Channel not ready.",
          {
            type,
            to,
          },
        );

        return false;
      }

      const message: SignalPayload = {
        type,
        from: user.id,
        to,
        ...payload,
      };

      try {
        const result = await channel.send({
          type: "broadcast",
          event: "signal",
          payload: message,
        });

        if (result !== "ok") {
          console.error(
            "[WHATSXUP SIGNAL] Send failed:",
            result,
          );

          return false;
        }

        console.log(
          "[WHATSXUP SIGNAL] SENT:",
          type,
          "TO:",
          to,
        );

        return true;
      } catch (error) {
        console.error(
          "[WHATSXUP SIGNAL] Send error:",
          error,
        );

        return false;
      }
    },
    [user?.id],
  );

  /*
   * -------------------------------------------------------
   * CLEANUP WEBRTC
   * -------------------------------------------------------
   */

  const cleanupWebRTC = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localRef.current) {
      localRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    localRef.current = null;
    remoteRef.current = null;

    pendingOffer.current = null;
    pendingIceCandidates.current = [];

    outgoingCallRef.current = null;

    setMuted(false);
    setCamOff(false);
    setSeconds(0);
    setSharingScreen(false);

    if (localVideo.current) {
      localVideo.current.srcObject = null;
    }

    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }

    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }
  }, []);

  /*
   * -------------------------------------------------------
   * GET MEDIA
   * -------------------------------------------------------
   */

  const getMedia = useCallback(
    async (kind: CallKind) => {
      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        toast.error(
          "Camera and microphone are not supported by this browser.",
        );

        throw new Error("getUserMedia unavailable");
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia({
            audio: true,
            video:
              kind === "video"
                ? {
                    facingMode: "user",
                  }
                : false,
          });

        localRef.current = stream;

        if (
          localVideo.current &&
          kind === "video"
        ) {
          localVideo.current.srcObject = stream;

          await localVideo.current
            .play()
            .catch(() => undefined);
        }

        return stream;
      } catch (error) {
        const name = (error as DOMException)?.name;

        if (name === "NotAllowedError") {
          toast.error(
            "Camera or microphone permission denied.",
            {
              description:
                "Allow camera and microphone access in your browser settings.",
            },
          );
        } else if (name === "NotFoundError") {
          toast.error(
            "No camera or microphone was found.",
          );
        } else if (name === "NotReadableError") {
          toast.error(
            "Camera or microphone is already being used.",
          );
        } else {
          toast.error(
            "Could not start camera or microphone.",
          );
        }

        throw error;
      }
    },
    [],
  );

  /*
   * -------------------------------------------------------
   * APPLY QUEUED ICE
   * -------------------------------------------------------
   */

  const applyPendingIce = useCallback(async () => {
    const pc = pcRef.current;

    if (!pc || !pc.remoteDescription) {
      return;
    }

    const candidates = [
      ...pendingIceCandidates.current,
    ];

    pendingIceCandidates.current = [];

    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.warn(
          "[WHATSXUP ICE] Could not apply candidate:",
          error,
        );
      }
    }
  }, []);

  /*
   * -------------------------------------------------------
   * BUILD PEER
   * -------------------------------------------------------
   */

  const buildPeer = useCallback(
    (
      peerId: string,
      stream: MediaStream,
    ) => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection(ICE);

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const remote = new MediaStream();

      remoteRef.current = remote;

      pc.ontrack = (event) => {
        if (event.streams[0]) {
          event.streams[0]
            .getTracks()
            .forEach((track) => {
              if (
                !remote
                  .getTracks()
                  .some(
                    (existing) =>
                      existing.id === track.id,
                  )
              ) {
                remote.addTrack(track);
              }
            });
        } else if (
          !remote
            .getTracks()
            .some(
              (existing) =>
                existing.id === event.track.id,
            )
        ) {
          remote.addTrack(event.track);
        }

        if (remoteVideo.current) {
          remoteVideo.current.srcObject = remote;

          void remoteVideo.current
            .play()
            .catch(() => undefined);
        }

        if (remoteAudio.current) {
          remoteAudio.current.srcObject = remote;

          void remoteAudio.current
            .play()
            .catch(() => undefined);
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        void sendSignal(peerId, "ice", {
          candidate:
            event.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        console.log(
          "[WHATSXUP WEBRTC]",
          pc.connectionState,
        );

        if (
          pc.connectionState === "connected"
        ) {
          console.log(
            "[WHATSXUP WEBRTC] CONNECTED",
          );
        }

        if (
          pc.connectionState === "failed"
        ) {
          toast.error(
            "The call connection failed.",
          );
        }
      };

      pcRef.current = pc;

      return pc;
    },
    [sendSignal],
  );

  /*
   * -------------------------------------------------------
   * CLEANUP WHOLE CALL
   * -------------------------------------------------------
   */

  const cleanup = useCallback(() => {
    cleanupWebRTC();

    handledIncomingCallId.current = null;

    setState({
      phase: "idle",
    });
  }, [cleanupWebRTC]);

  /*
   * -------------------------------------------------------
   * PERMANENT SIGNAL CHANNEL
   *
   * This channel is created immediately after login.
   *
   * The important difference is:
   *
   * Caller DOES NOT create a temporary channel.
   *
   * Both users permanently listen on their own channels.
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!user?.id) {
      signalReady.current = false;
      return;
    }

    let cancelled = false;

    const channel = supabase.channel(
      `signal:${user.id}`,
    );

    signalChannel.current = channel;

    channel.on(
      "broadcast",
      {
        event: "signal",
      },
      async ({ payload }) => {
        if (cancelled) {
          return;
        }

        const p = payload as SignalPayload;

        if (
          p.to &&
          p.to !== user.id
        ) {
          return;
        }

        if (
          p.from &&
          p.from === user.id
        ) {
          return;
        }

        console.log(
          "[WHATSXUP SIGNAL RECEIVED]",
          p.type,
          p,
        );

        /*
         * -------------------------------------------------
         * READY
         *
         * Receiver tells caller:
         * "I am listening now. Send me the offer."
         * -------------------------------------------------
         */

        if (p.type === "ready") {
          const outgoing =
            outgoingCallRef.current;

          if (
            !outgoing ||
            outgoing.peerId !== p.from
          ) {
            return;
          }

          if (outgoing.offer) {
            await sendSignal(
              outgoing.peerId,
              "offer",
              {
                sdp: outgoing.offer,
                callId:
                  outgoing.callId,
                kind:
                  outgoing.kind,
                name:
                  outgoing.callerName,
                avatar:
                  outgoing.callerAvatar,
              },
            );
          }

          return;
        }

        /*
         * -------------------------------------------------
         * OFFER
         * -------------------------------------------------
         */

        if (p.type === "offer") {
          if (
            !p.sdp ||
            !p.from ||
            !p.callId
          ) {
            console.error(
              "[WHATSXUP] Invalid offer.",
            );

            return;
          }

          /*
           * The database ringing detector should
           * already have displayed the incoming call.
           *
           * But if the offer arrives first, we still
           * create the incoming UI as a fallback.
           */

          if (
            state.phase !== "idle" &&
            !(
              state.phase === "incoming" &&
              state.callId === p.callId
            )
          ) {
            await sendSignal(
              p.from,
              "busy",
              {},
            );

            return;
          }

          pendingOffer.current = p.sdp;

          pendingIceCandidates.current = [];

          const incomingName =
            p.name?.trim() ||
            "Unknown";

          const incomingAvatar =
            p.avatar
              ? String(p.avatar)
              : null;

          const incomingKind =
            p.kind === "video"
              ? "video"
              : "voice";

          setState((current) => {
            if (
              current.phase === "incoming" &&
              current.callId === p.callId
            ) {
              return current;
            }

            return {
              phase: "incoming",
              callId: p.callId!,
              peerId: p.from!,
              peerName: incomingName,
              peerAvatar:
                incomingAvatar,
              kind: incomingKind,
            };
          });

          return;
        }

        /*
         * -------------------------------------------------
         * ANSWER
         * -------------------------------------------------
         */

        if (p.type === "answer") {
          if (
            !p.sdp ||
            !pcRef.current
          ) {
            return;
          }

          try {
            await pcRef.current.setRemoteDescription(
              p.sdp,
            );

            await applyPendingIce();

            setState((current) =>
              current.phase === "outgoing"
                ? {
                    ...current,
                    phase: "active",
                  }
                : current,
            );

            if (
              outgoingCallRef.current
            ) {
              await supabase
                .from("calls")
                .update({
                  status: "accepted",
                })
                .eq(
                  "id",
                  outgoingCallRef.current
                    .callId,
                );
            }
          } catch (error) {
            console.error(
              "[WHATSXUP ANSWER]",
              error,
            );
          }

          return;
        }

        /*
         * -------------------------------------------------
         * ICE
         * -------------------------------------------------
         */

        if (p.type === "ice") {
          if (!p.candidate) {
            return;
          }

          if (
            !pcRef.current ||
            !pcRef.current.remoteDescription
          ) {
            pendingIceCandidates.current.push(
              p.candidate,
            );

            return;
          }

          try {
            await pcRef.current.addIceCandidate(
              p.candidate,
            );
          } catch (error) {
            console.warn(
              "[WHATSXUP ICE]",
              error,
            );
          }

          return;
        }

        /*
         * -------------------------------------------------
         * DECLINE
         * -------------------------------------------------
         */

        if (p.type === "decline") {
          toast.info("Call declined.");

          cleanup();

          return;
        }

        /*
         * -------------------------------------------------
         * END
         * -------------------------------------------------
         */

        if (p.type === "end") {
          cleanup();

          return;
        }

        /*
         * -------------------------------------------------
         * BUSY
         * -------------------------------------------------
         */

        if (p.type === "busy") {
          toast.info(
            "User is already on another call.",
          );

          cleanup();

          return;
        }
      },
    );

    channel.subscribe((status) => {
      console.log(
        "[WHATSXUP SIGNAL CHANNEL]",
        user.id,
        status,
      );

      if (status === "SUBSCRIBED") {
        signalReady.current = true;

        console.log(
          "[WHATSXUP] SIGNALING READY:",
          user.id,
        );
      } else {
        signalReady.current = false;
      }
    });

    return () => {
      cancelled = true;
      signalReady.current = false;

      if (
        signalChannel.current === channel
      ) {
        signalChannel.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [
    user?.id,
    applyPendingIce,
    cleanup,
    sendSignal,
  ]);

  /*
   * -------------------------------------------------------
   * RELIABLE DATABASE RINGING DETECTOR
   *
   * This is the key change.
   *
   * Instead of relying only on Broadcast, the receiver
   * checks the calls table for calls where:
   *
   * callee_id = me
   * status = ringing
   *
   * Therefore a missed Broadcast cannot prevent the
   * incoming call UI from appearing.
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const checkIncomingCall = async () => {
      if (cancelled) {
        return;
      }

      /*
       * Don't interrupt an active/outgoing call.
       */
      if (state.phase !== "idle") {
        return;
      }

      try {
        const { data: call, error } =
          await supabase
            .from("calls")
            .select(
              "id, caller_id, callee_id, kind, status, created_at",
            )
            .eq(
              "callee_id",
              user.id,
            )
            .eq(
              "status",
              "ringing",
            )
            .order(
              "created_at",
              {
                ascending: false,
              },
            )
            .limit(1)
            .maybeSingle();

        if (error) {
          console.error(
            "[WHATSXUP CALL POLL]",
            error,
          );

          return;
        }

        if (
          !call ||
          cancelled
        ) {
          return;
        }

        if (
          handledIncomingCallId.current ===
          call.id
        ) {
          return;
        }

        handledIncomingCallId.current =
          call.id;

        /*
         * Get caller profile.
         */

        const { data: caller } =
          await supabase
            .from("profiles")
            .select(
              "display_name, username, avatar_url",
            )
            .eq(
              "id",
              call.caller_id,
            )
            .maybeSingle();

        if (cancelled) {
          return;
        }

        const callerName =
          caller?.display_name?.trim() ||
          (caller?.username
            ? `@${caller.username}`
            : "Someone");

        const callerAvatar =
          caller?.avatar_url ??
          null;

        const kind =
          call.kind === "video"
            ? "video"
            : "voice";

        /*
         * SHOW INCOMING UI.
         */

        setState({
          phase: "incoming",
          callId: call.id,
          peerId: call.caller_id,
          peerName: callerName,
          peerAvatar: callerAvatar,
          kind,
        });

        /*
         * Tell caller:
         *
         * "I have detected your ringing call
         * and my signaling channel is ready."
         */

        if (
          signalReady.current
        ) {
          await sendSignal(
            call.caller_id,
            "ready",
            {
              callId: call.id,
            },
          );
        }

        toast.info(
          `Incoming ${kind} call`,
          {
            description:
              callerName,
          },
        );
      } catch (error) {
        console.error(
          "[WHATSXUP INCOMING CALL]",
          error,
        );
      }
    };

    /*
     * Check immediately.
     */
    void checkIncomingCall();

    /*
     * Poll every 1 second.
     *
     * This makes the ringing state reliable even if
     * Supabase Realtime database replication isn't
     * enabled for the calls table.
     */
    const interval =
      window.setInterval(() => {
        void checkIncomingCall();
      }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    user?.id,
    state.phase,
    sendSignal,
  ]);

  /*
   * -------------------------------------------------------
   * CALL TIMER
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (state.phase !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      setSeconds(
        (current) => current + 1,
      );
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.phase]);

  /*
   * -------------------------------------------------------
   * LOCAL VIDEO
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (
      state.phase === "idle" ||
      state.kind !== "video"
    ) {
      return;
    }

    if (
      localVideo.current &&
      localRef.current
    ) {
      localVideo.current.srcObject =
        localRef.current;

      void localVideo.current
        .play()
        .catch(() => undefined);
    }
  }, [
    state.phase,
    state.kind,
    sharingScreen,
  ]);

  /*
   * -------------------------------------------------------
   * START CALL
   * -------------------------------------------------------
   */

  const startCall = useCallback(
    async (
      peer: {
        id: string;
        name: string;
        avatar: string | null;
      },
      kind: CallKind,
    ) => {
      if (!user?.id) {
        return;
      }

      if (state.phase !== "idle") {
        toast.info(
          "You are already in a call.",
        );

        return;
      }

      /*
       * VERY IMPORTANT:
       *
       * Make sure OUR signaling channel is ready
       * before creating the call.
       */

      if (
        !signalChannel.current ||
        !signalReady.current
      ) {
        toast.error(
          "Call connection is still starting. Please try again.",
        );

        return;
      }

      /*
       * Create database ringing record FIRST.
       *
       * This is what the receiver detects.
       */

      const {
        data,
        error,
      } = await supabase
        .from("calls")
        .insert({
          caller_id: user.id,
          callee_id: peer.id,
          kind,
          status: "ringing",
        })
        .select("id")
        .single();

      if (error || !data) {
        toast.error(
          error?.message ||
            "Could not create call.",
        );

        return;
      }

      /*
       * Start camera/microphone.
       */

      let stream: MediaStream;

      try {
        stream =
          await getMedia(kind);
      } catch {
        await supabase
          .from("calls")
          .update({
            status: "failed",
            ended_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            data.id,
          );

        return;
      }

      /*
       * Caller profile.
       */

      const { data: me } =
        await supabase
          .from("profiles")
          .select(
            "display_name, username, avatar_url",
          )
          .eq(
            "id",
            user.id,
          )
          .maybeSingle();

      const callerName =
        me?.display_name?.trim() ||
        (me?.username
          ? `@${me.username}`
          : null) ||
        user.email?.split("@")[0] ||
        "Someone";

      const callerAvatar =
        me?.avatar_url ?? null;

      /*
       * Build WebRTC connection.
       */

      const pc =
        buildPeer(
          peer.id,
          stream,
        );

      /*
       * Create offer.
       */

      const offer =
        await pc.createOffer();

      await pc.setLocalDescription(
        offer,
      );

      /*
       * Save everything locally.
       *
       * We DO NOT send the offer immediately.
       *
       * We wait for the receiver's "ready".
       */

      outgoingCallRef.current = {
        callId: data.id,
        peerId: peer.id,
        kind,
        callerName,
        callerAvatar,
        offer,
      };

      /*
       * Show caller UI.
       */

      setState({
        phase: "outgoing",
        callId: data.id,
        peerId: peer.id,
        peerName: peer.name,
        peerAvatar: peer.avatar,
        kind,
      });

      /*
       * Send push notification.
       *
       * This is only a notification.
       * It is NOT used as WebRTC signaling.
       */

      try {
        await notifyIncomingCall({
          calleeId: peer.id,
          kind,
          callerName,
          callerAvatar,
          callId: data.id,
        });
      } catch (error) {
        console.error(
          "[WHATSXUP CALL PUSH]",
          error,
        );
      }

      /*
       * Immediately attempt a ready message.
       *
       * If receiver isn't ready yet, the database
       * polling on the receiver will eventually detect
       * the call and send "ready".
       */

      await sendSignal(
        peer.id,
        "ready-check",
        {
          callId: data.id,
        },
      );
    },
    [
      user,
      state.phase,
      getMedia,
      buildPeer,
      sendSignal,
    ],
  );

  /*
   * -------------------------------------------------------
   * ACCEPT CALL
   * -------------------------------------------------------
   */

  const accept = useCallback(
    async () => {
      if (
        state.phase !== "incoming"
      ) {
        return;
      }

      /*
       * The receiver might see the ringing UI before
       * the offer arrives.
       *
       * Wait briefly for the offer instead of failing
       * immediately.
       */

      let attempts = 0;

      while (
        !pendingOffer.current &&
        attempts < 50
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              100,
            ),
        );

        attempts++;
      }

      if (
        !pendingOffer.current
      ) {
        /*
         * The caller's offer hasn't arrived.
         *
         * Ask caller to resend it.
         */

        await sendSignal(
          state.peerId,
          "ready",
          {
            callId:
              state.callId,
          },
        );

        toast.info(
          "Connecting to caller…",
        );

        return;
      }

      let stream: MediaStream;

      try {
        stream =
          await getMedia(
            state.kind,
          );
      } catch {
        await sendSignal(
          state.peerId,
          "decline",
          {},
        );

        await supabase
          .from("calls")
          .update({
            status: "declined",
            ended_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            state.callId,
          );

        cleanup();

        return;
      }

      const pc =
        buildPeer(
          state.peerId,
          stream,
        );

      try {
        await pc.setRemoteDescription(
          pendingOffer.current,
        );

        await applyPendingIce();

        const answer =
          await pc.createAnswer();

        await pc.setLocalDescription(
          answer,
        );

        const sent =
          await sendSignal(
            state.peerId,
            "answer",
            {
              sdp: answer,
              callId:
                state.callId,
            },
          );

        if (!sent) {
          toast.error(
            "Could not connect the call.",
          );

          cleanup();

          return;
        }

        await supabase
          .from("calls")
          .update({
            status: "accepted",
          })
          .eq(
            "id",
            state.callId,
          );

        pendingOffer.current = null;

        setState((current) => ({
          ...current,
          phase: "active",
        }));
      } catch (error) {
        console.error(
          "[WHATSXUP ACCEPT]",
          error,
        );

        toast.error(
          "Could not accept the call.",
        );

        cleanup();
      }
    },
    [
      state,
      getMedia,
      buildPeer,
      sendSignal,
      cleanup,
      applyPendingIce,
    ],
  );

  /*
   * -------------------------------------------------------
   * DECLINE
   * -------------------------------------------------------
   */

  const decline = useCallback(
    async () => {
      if (
        state.phase === "idle"
      ) {
        return;
      }

      await sendSignal(
        state.peerId,
        "decline",
        {
          callId:
            state.callId,
        },
      );

      await supabase
        .from("calls")
        .update({
          status:
            state.phase ===
            "incoming"
              ? "declined"
              : "missed",
          ended_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          state.callId,
        );

      cleanup();
    },
    [
      state,
      sendSignal,
      cleanup,
    ],
  );

  /*
   * -------------------------------------------------------
   * HANG UP
   * -------------------------------------------------------
   */

  const hangUp = useCallback(
    async () => {
      if (
        state.phase === "idle"
      ) {
        return;
      }

      await sendSignal(
        state.peerId,
        "end",
        {
          callId:
            state.callId,
        },
      );

      await supabase
        .from("calls")
        .update({
          status:
            state.phase === "active"
              ? "ended"
              : "missed",
          ended_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          state.callId,
        );

      cleanup();
    },
    [
      state,
      sendSignal,
      cleanup,
    ],
  );

  /*
   * -------------------------------------------------------
   * SWITCH CAMERA
   * -------------------------------------------------------
   */

  const switchCamera = useCallback(
    async () => {
      if (
        state.phase === "idle" ||
        state.kind !== "video" ||
        !pcRef.current ||
        !localRef.current
      ) {
        return;
      }

      try {
        const currentTrack =
          localRef.current.getVideoTracks()[0];

        if (!currentTrack) {
          return;
        }

        const settings =
          currentTrack.getSettings();

        const currentFacing =
          settings.facingMode ===
          "environment"
            ? "environment"
            : "user";

        const nextFacing =
          currentFacing === "user"
            ? "environment"
            : "user";

        const newStream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: false,
              video: {
                facingMode: {
                  ideal: nextFacing,
                },
              },
            },
          );

        const newTrack =
          newStream.getVideoTracks()[0];

        if (!newTrack) {
          newStream
            .getTracks()
            .forEach((track) =>
              track.stop(),
            );

          return;
        }

        const sender =
          pcRef.current
            .getSenders()
            .find(
              (item) =>
                item.track?.kind ===
                "video",
            );

        if (sender) {
          await sender.replaceTrack(
            newTrack,
          );
        }

        currentTrack.stop();

        localRef.current.removeTrack(
          currentTrack,
        );

        localRef.current.addTrack(
          newTrack,
        );

        if (localVideo.current) {
          localVideo.current.srcObject =
            localRef.current;

          await localVideo.current
            .play()
            .catch(() => undefined);
        }

        setCamOff(false);
      } catch (error) {
        console.error(
          "[WHATSXUP CAMERA]",
          error,
        );

        toast.error(
          "Could not switch camera.",
        );
      }
    },
    [state],
  );

  /*
   * -------------------------------------------------------
   * RESTORE CAMERA
   * -------------------------------------------------------
   */

  const restoreCameraAfterScreenShare =
    useCallback(async () => {
      if (
        state.phase === "idle" ||
        state.kind !== "video" ||
        !pcRef.current
      ) {
        return;
      }

      try {
        const cameraStream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: false,
              video: {
                facingMode: "user",
              },
            },
          );

        const cameraTrack =
          cameraStream.getVideoTracks()[0];

        if (!cameraTrack) {
          cameraStream
            .getTracks()
            .forEach((track) =>
              track.stop(),
            );

          return;
        }

        const sender =
          pcRef.current
            .getSenders()
            .find(
              (item) =>
                item.track?.kind ===
                "video",
            );

        if (sender) {
          await sender.replaceTrack(
            cameraTrack,
          );
        }

        if (localRef.current) {
          const oldTrack =
            localRef.current.getVideoTracks()[0];

          if (oldTrack) {
            oldTrack.stop();

            localRef.current.removeTrack(
              oldTrack,
            );
          }

          localRef.current.addTrack(
            cameraTrack,
          );

          if (localVideo.current) {
            localVideo.current.srcObject =
              localRef.current;

            await localVideo.current
              .play()
              .catch(() => undefined);
          }
        }

        setSharingScreen(false);
        setCamOff(false);
      } catch (error) {
        console.error(
          "[WHATSXUP RESTORE CAMERA]",
          error,
        );

        toast.error(
          "Could not return to camera.",
        );
      }
    }, [state]);

  /*
   * -------------------------------------------------------
   * SCREEN SHARE
   * -------------------------------------------------------
   */

  const shareScreen = useCallback(
    async () => {
      if (
        state.phase === "idle" ||
        state.kind !== "video" ||
        !pcRef.current
      ) {
        return;
      }

      if (
        !navigator.mediaDevices?.getDisplayMedia
      ) {
        toast.error(
          "Screen sharing is not supported by this browser.",
        );

        return;
      }

      try {
        const displayStream =
          await navigator.mediaDevices.getDisplayMedia(
            {
              video: true,
              audio: false,
            },
          );

        const screenTrack =
          displayStream.getVideoTracks()[0];

        if (!screenTrack) {
          return;
        }

        const sender =
          pcRef.current
            .getSenders()
            .find(
              (item) =>
                item.track?.kind ===
                "video",
            );

        if (!sender) {
          screenTrack.stop();
          return;
        }

        await sender.replaceTrack(
          screenTrack,
        );

        if (localVideo.current) {
          localVideo.current.srcObject =
            new MediaStream([
              screenTrack,
            ]);

          await localVideo.current
            .play()
            .catch(() => undefined);
        }

        setSharingScreen(true);

        screenTrack.onended = () => {
          void restoreCameraAfterScreenShare();
        };
      } catch (error) {
        const name =
          (error as DOMException)?.name;

        if (
          name !== "NotAllowedError"
        ) {
          console.error(
            "[WHATSXUP SCREEN SHARE]",
            error,
          );

          toast.error(
            "Could not start screen sharing.",
          );
        }
      }
    },
    [
      state,
      restoreCameraAfterScreenShare,
    ],
  );

  /*
   * -------------------------------------------------------
   * ONLINE PRESENCE
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel =
      supabase.channel(
        "presence:online",
        {
          config: {
            presence: {
              key: user.id,
            },
          },
        },
      );

    channel.on(
      "presence",
      {
        event: "sync",
      },
      () => {
        setOnlineIds(
          new Set(
            Object.keys(
              channel.presenceState(),
            ),
          ),
        );
      },
    );

    channel.subscribe(
      async (status) => {
        if (
          status === "SUBSCRIBED"
        ) {
          await channel.track({
            at: Date.now(),
          });
        }
      },
    );

    void supabase
      .from("profiles")
      .update({
        is_online: true,
        last_seen:
          new Date().toISOString(),
      })
      .eq("id", user.id);

    const heartbeat =
      window.setInterval(() => {
        void supabase
          .from("profiles")
          .update({
            last_seen:
              new Date().toISOString(),
          })
          .eq("id", user.id);
      }, 60000);

    return () => {
      window.clearInterval(
        heartbeat,
      );

      void supabase
        .from("profiles")
        .update({
          is_online: false,
        })
        .eq("id", user.id);

      void supabase.removeChannel(
        channel,
      );
    };
  }, [user?.id]);

  /*
   * -------------------------------------------------------
   * CLEANUP WHEN USER LOGS OUT
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (user?.id) {
      return;
    }

    cleanup();
  }, [user?.id, cleanup]);

  /*
   * -------------------------------------------------------
   * CONTEXT
   * -------------------------------------------------------
   */

  const value = useMemo(
    () => ({
      onlineIds,
      startCall,
      state,
    }),
    [
      onlineIds,
      startCall,
      state,
    ],
  );

  /*
   * -------------------------------------------------------
   * UI
   * -------------------------------------------------------
   */

  return (
    <RealtimeContext.Provider
      value={value}
    >
      {children}

      {state.phase !== "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background app-gradient px-6 py-12 safe-bottom">
          {/* HEADER */}

          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <UserAvatar
              path={state.peerAvatar}
              name={state.peerName}
              size="xl"
            />

            <div>
              <h2 className="text-2xl font-semibold">
                {state.peerName}
              </h2>

              <p className="text-sm text-muted-foreground">
                {state.phase === "incoming"
                  ? `Incoming ${state.kind} call`
                  : state.phase === "outgoing"
                    ? "Ringing…"
                    : durationLabel(
                        seconds,
                      )}
              </p>
            </div>
          </div>

          {/* VIDEO */}

          {state.kind === "video" && (
            <div className="relative my-6 w-full max-w-md flex-1 overflow-hidden rounded-3xl