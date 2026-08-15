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
  state: {
    phase: "idle",
  },
});

/*
 * =========================================================
 * WEBRTC ICE CONFIGURATION
 * =========================================================
 *
 * STUN:
 * Helps browsers discover a direct peer-to-peer route.
 *
 * TURN:
 * Relays audio/video when a direct connection cannot be
 * established, especially across different networks.
 *
 * IMPORTANT:
 * TURN username and credential come from environment
 * variables so they are not hard-coded into this file.
 *
 * Required environment variables:
 *
 * VITE_TURN_USERNAME
 * VITE_TURN_CREDENTIAL
 *
 * The rstream credentials are temporary and expire based
 * on the TTL supplied by rstream.
 * =========================================================
 */

const TURN_USERNAME =
  import.meta.env['VITE_TURN_USERNAME']?.trim() || "";

const TURN_CREDENTIAL =
  import.meta.env['VITE_TURN_CREDENTIAL']?.trim() || "";

const ICE: RTCConfiguration = {
  iceServers: [
    /*
     * Google STUN
     */
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },

    /*
     * rstream TURN
     *
     * UDP
     */
    ...(TURN_USERNAME && TURN_CREDENTIAL
      ? [
          {
            urls: [
              "turn:aws-global-1.c.rstream.io:3478?transport=udp",
              "turn:aws-global-1.c.rstream.io:3478?transport=tcp",

              /*
               * TURN over TLS.
               *
               * TLS TURN uses TCP transport.
               */
              "turns:aws-global-1.c.rstream.io:5349?transport=tcp",
            ],
            username: TURN_USERNAME,
            credential: TURN_CREDENTIAL,
          },
        ]
      : []),
  ],
};

/*
 * Log whether TURN credentials were loaded.
 *
 * We deliberately DO NOT log the username or credential.
 */
if (typeof window !== "undefined") {
  console.log(
    "[WHATSXUP WEBRTC] TURN configured:",
    Boolean(TURN_USERNAME && TURN_CREDENTIAL),
  );
}

/*
 * =========================================================
 * PROVIDER
 * =========================================================
 */

export function RealtimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();

  /*
   * =======================================================
   * STATE
   * =======================================================
   */

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

  /*
   * =======================================================
   * WEBRTC REFERENCES
   * =======================================================
   */

  const pcRef = useRef<RTCPeerConnection | null>(null);

  const localRef = useRef<MediaStream | null>(null);

  const remoteRef = useRef<MediaStream | null>(null);

  const localVideo = useRef<HTMLVideoElement | null>(null);

  const remoteVideo = useRef<HTMLVideoElement | null>(null);

  const remoteAudio = useRef<HTMLAudioElement | null>(null);

  /*
   * =======================================================
   * SIGNALING REFERENCES
   * =======================================================
   */

  const signalChannel = useRef<RealtimeChannel | null>(null);

  const outgoingChannels = useRef(
    new Map<string, RealtimeChannel>(),
  );

  const pendingOffer =
    useRef<RTCSessionDescriptionInit | null>(null);

  const pendingIceCandidates =
    useRef<RTCIceCandidateInit[]>([]);

  /*
   * =======================================================
   * GET / CREATE OUTGOING SIGNAL CHANNEL
   * =======================================================
   */

  const getOutgoingChannel = useCallback(
    async (peerId: string) => {
      const existing =
        outgoingChannels.current.get(peerId);

      if (existing) {
        return existing;
      }

      const channel = supabase.channel(
        `signal:${peerId}`,
      );

      const status = await new Promise<string>(
        (resolve) => {
          let resolved = false;

          channel.subscribe(
            (subscriptionStatus) => {
              if (
                subscriptionStatus ===
                  "SUBSCRIBED" ||
                subscriptionStatus ===
                  "CHANNEL_ERROR" ||
                subscriptionStatus ===
                  "TIMED_OUT"
              ) {
                if (!resolved) {
                  resolved = true;
                  resolve(
                    subscriptionStatus,
                  );
                }
              }
            },
          );
        },
      );

      if (status !== "SUBSCRIBED") {
        await supabase.removeChannel(
          channel,
        );

        throw new Error(
          `Could not connect to realtime signaling channel: ${status}`,
        );
      }

      outgoingChannels.current.set(
        peerId,
        channel,
      );

      return channel;
    },
    [],
  );

  /*
   * =======================================================
   * SEND SIGNAL
   * =======================================================
   */

  const send = useCallback(
    async (
      to: string,
      type: string,
      payload: Record<string, unknown> = {},
    ) => {
      if (!user?.id || !to) {
        return false;
      }

      try {
        const channel =
          await getOutgoingChannel(to);

        const message: SignalPayload = {
          type,
          from: user.id,
          to,
          ...(payload as Partial<SignalPayload>),
        };

        const result =
          await channel.send({
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

        return true;
      } catch (error) {
        console.error(
          "[WHATSXUP SIGNAL] Error:",
          error,
        );

        return false;
      }
    },
    [user?.id, getOutgoingChannel],
  );

  /*
   * =======================================================
   * CLEANUP SIGNAL CHANNELS
   * =======================================================
   */

  const cleanupSignalChannels =
    useCallback(async () => {
      const channels = Array.from(
        outgoingChannels.current.values(),
      );

      outgoingChannels.current.clear();

      for (const channel of channels) {
        try {
          await supabase.removeChannel(
            channel,
          );
        } catch {
          // Ignore cleanup errors.
        }
      }
    }, []);

  /*
   * =======================================================
   * CLEANUP CALL
   * =======================================================
   */

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localRef.current) {
      localRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });
    }

    localRef.current = null;

    remoteRef.current = null;

    pendingOffer.current = null;

    pendingIceCandidates.current = [];

    setMuted(false);
    setCamOff(false);
    setSeconds(0);
    setSharingScreen(false);

    setState({
      phase: "idle",
    });
  }, []);

  /*
   * =======================================================
   * GET CAMERA + MICROPHONE
   * =======================================================
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

        throw new Error(
          "getUserMedia unavailable",
        );
      }

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true,

              video:
                kind === "video"
                  ? {
                      facingMode: "user",
                    }
                  : false,
            },
          );

        localRef.current = stream;

        if (
          localVideo.current &&
          kind === "video"
        ) {
          localVideo.current.srcObject =
            stream;

          await localVideo.current
            .play()
            .catch(() => undefined);
        }

        return stream;
      } catch (error) {
        const name =
          (error as DOMException)?.name;

        if (
          name === "NotAllowedError"
        ) {
          toast.error(
            "Camera or microphone permission denied.",
            {
              description:
                "Allow camera and microphone access in your browser settings.",
            },
          );
        } else if (
          name === "NotFoundError"
        ) {
          toast.error(
            "No camera or microphone was found.",
          );
        } else if (
          name === "NotReadableError"
        ) {
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
   * =======================================================
   * SHOW LOCAL CAMERA
   * =======================================================
   */

  useEffect(() => {
    if (state.phase === "idle") return;
    if (state.kind !== "video") return;

    if (
      !localVideo.current ||
      !localRef.current
    ) {
      return;
    }

    localVideo.current.srcObject =
      localRef.current;

    void localVideo.current
      .play()
      .catch(() => undefined);
  }, [
    state.phase,
    state.kind,
    sharingScreen,
  ]);

  /*
   * =======================================================
   * APPLY PENDING ICE
   * =======================================================
   */

  const applyPendingIce = useCallback(
    async () => {
      if (
        !pcRef.current ||
        !pcRef.current.remoteDescription
      ) {
        return;
      }

      const candidates = [
        ...pendingIceCandidates.current,
      ];

      pendingIceCandidates.current = [];

      for (const candidate of candidates) {
        try {
          await pcRef.current.addIceCandidate(
            candidate,
          );
        } catch (error) {
          console.warn(
            "[WHATSXUP ICE] Failed pending candidate:",
            error,
          );
        }
      }
    },
    [],
  );

  /*
   * =======================================================
   * BUILD WEBRTC PEER
   * =======================================================
   */

  const buildPeer = useCallback(
    (
      peerId: string,
      stream: MediaStream,
    ) => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      /*
       * IMPORTANT:
       *
       * This RTCPeerConnection now uses:
       *
       * STUN + rstream TURN
       */
      const pc =
        new RTCPeerConnection(ICE);

      stream
        .getTracks()
        .forEach((track) => {
          pc.addTrack(track, stream);
        });

      const remote =
        new MediaStream();

      remoteRef.current = remote;

      pc.ontrack = (event) => {
        const incomingTracks =
          event.streams[0]?.getTracks();

        if (incomingTracks) {
          incomingTracks.forEach(
            (track) => {
              if (
                !remote
                  .getTracks()
                  .some(
                    (existing) =>
                      existing.id ===
                      track.id,
                  )
              ) {
                remote.addTrack(track);
              }
            },
          );
        } else {
          if (
            !remote
              .getTracks()
              .some(
                (existing) =>
                  existing.id ===
                  event.track.id,
              )
          ) {
            remote.addTrack(
              event.track,
            );
          }
        }

        if (remoteVideo.current) {
          remoteVideo.current.srcObject =
            remote;

          void remoteVideo.current
            .play()
            .catch(() => undefined);
        }

        if (remoteAudio.current) {
          remoteAudio.current.srcObject =
            remote;

          void remoteAudio.current
            .play()
            .catch(() => undefined);
        }
      };

      /*
       * Send ICE candidates through Supabase
       * signaling.
       */
      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }

        void send(peerId, "ice", {
          candidate:
            event.candidate.toJSON(),
        });
      };

      /*
       * Useful debugging information.
       */
      pc.oniceconnectionstatechange =
        () => {
          console.log(
            "[WHATSXUP WEBRTC] ICE connection:",
            pc.iceConnectionState,
          );
        };

      pc.onconnectionstatechange =
        () => {
          console.log(
            "[WHATSXUP WEBRTC] Connection:",
            pc.connectionState,
          );

          if (
            pc.connectionState ===
              "failed" ||
            pc.connectionState ===
              "closed"
          ) {
            console.warn(
              "[WHATSXUP WEBRTC] Connection lost.",
            );
          }
        };

      pcRef.current = pc;

      return pc;
    },
    [send],
  );

  /*
   * =======================================================
   * PERSISTENT INCOMING SIGNALING CHANNEL
   * =======================================================
   */

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const channel =
      supabase.channel(
        `signal:${user.id}`,
      );

    signalChannel.current =
      channel;

    channel.on(
      "broadcast",
      {
        event: "signal",
      },
      async ({ payload }) => {
        if (cancelled) {
          return;
        }

        const p =
          payload as SignalPayload;

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
        );

        /*
         * =================================================
         * INCOMING OFFER
         * =================================================
         */

        if (p.type === "offer") {
          if (
            !p.sdp ||
            !p.from ||
            !p.callId
          ) {
            console.error(
              "[WHATSXUP] Invalid offer received.",
            );

            return;
          }

          if (
            state.phase !== "idle"
          ) {
            await send(
              p.from,
              "busy",
              {},
            );

            return;
          }

          pendingOffer.current =
            p.sdp;

          pendingIceCandidates.current =
            [];

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

          setState({
            phase: "incoming",
            callId: p.callId,
            peerId: p.from,
            peerName: incomingName,
            peerAvatar:
              incomingAvatar,
            kind: incomingKind,
          });

          toast.info(
            `Incoming ${incomingKind} call`,
            {
              description:
                incomingName,
            },
          );

          return;
        }

        /*
         * =================================================
         * ANSWER
         * =================================================
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
              current.phase ===
              "outgoing"
                ? {
                    ...current,
                    phase: "active",
                  }
                : current,
            );
          } catch (error) {
            console.error(
              "[WHATSXUP ANSWER]",
              error,
            );
          }

          return;
        }

        /*
         * =================================================
         * ICE
         * =================================================
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
         * =================================================
         * DECLINE
         * =================================================
         */

        if (p.type === "decline") {
          toast.info(
            "Call declined",
          );

          cleanup();

          return;
        }

        /*
         * =================================================
         * END
         * =================================================
         */

        if (p.type === "end") {
          cleanup();

          return;
        }

        /*
         * =================================================
         * BUSY
         * =================================================
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

      if (
        status === "SUBSCRIBED"
      ) {
        console.log(
          "[WHATSXUP] Incoming call signaling is READY.",
        );
      }

      if (
        status === "CHANNEL_ERROR"
      ) {
        console.error(
          "[WHATSXUP] Signal channel error.",
        );
      }

      if (
        status === "TIMED_OUT"
      ) {
        console.error(
          "[WHATSXUP] Signal channel timed out.",
        );
      }
    });

    return () => {
      cancelled = true;

      if (
        signalChannel.current ===
        channel
      ) {
        signalChannel.current =
          null;
      }

      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    user?.id,
    cleanup,
    send,
    applyPendingIce,
  ]);

  /*
   * =======================================================
   * ONLINE PRESENCE
   * =======================================================
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
      setInterval(() => {
        void supabase
          .from("profiles")
          .update({
            last_seen:
              new Date().toISOString(),
          })
          .eq("id", user.id);
      }, 60000);

    return () => {
      clearInterval(
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
   * =======================================================
   * CALL TIMER
   * =======================================================
   */

  useEffect(() => {
    if (
      state.phase !== "active"
    ) {
      return;
    }

    const timer =
      setInterval(() => {
        setSeconds(
          (current) =>
            current + 1,
        );
      }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [state.phase]);

  /*
   * =======================================================
   * SWITCH CAMERA
   * =======================================================
   */

  const switchCamera =
    useCallback(async () => {
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
          "[WHATSXUP CAMERA SWITCH]",
          error,
        );

        toast.error(
          "Could not switch camera.",
        );
      }
    }, [state]);

  /*
   * =======================================================
   * RESTORE CAMERA AFTER SCREEN SHARE
   * =======================================================
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
   * =======================================================
   * SCREEN SHARING
   * =======================================================
   */

  const shareScreen =
    useCallback(async () => {
      if (
        state.phase === "idle" ||
        state.kind !== "video" ||
        !pcRef.current
      ) {
        return;
      }

      if (
        !navigator.mediaDevices
          ?.getDisplayMedia
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
          const preview =
            new MediaStream([
              screenTrack,
            ]);

          localVideo.current.srcObject =
            preview;

          await localVideo.current
            .play()
            .catch(() => undefined);
        }

        setSharingScreen(true);

        screenTrack.onended =
          () => {
            void restoreCameraAfterScreenShare();
          };
      } catch (error) {
        const name =
          (error as DOMException)?.name;

        if (
          name !==
          "NotAllowedError"
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
    }, [
      state,
      restoreCameraAfterScreenShare,
    ]);

  /*
   * =======================================================
   * START CALL
   * =======================================================
   */

  const startCall =
    useCallback(
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

        if (
          state.phase !== "idle"
        ) {
          toast.info(
            "You are already in a call.",
          );

          return;
        }

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

        if (error) {
          toast.error(
            error.message,
          );

          return;
        }

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

        setState({
          phase: "outgoing",
          callId: data.id,
          peerId: peer.id,
          peerName: peer.name,
          peerAvatar:
            peer.avatar,
          kind,
        });

        const pc =
          buildPeer(
            peer.id,
            stream,
          );

        const offer =
          await pc.createOffer();

        await pc.setLocalDescription(
          offer,
        );

        const {
          data: me,
        } = await supabase
          .from("profiles")
          .select(
            "display_name, username, avatar_url",
          )
          .eq(
            "id",
            user.id,
          )
          .single();

        const callerName =
          me?.display_name?.trim() ||
          me?.username?.trim() ||
          user.email?.split(
            "@",
          )[0] ||
          "Someone";

        const callerAvatar =
          me?.avatar_url ??
          null;

        const sent =
          await send(
            peer.id,
            "offer",
            {
              sdp: offer,
              callId: data.id,
              kind,
              name: callerName,
              avatar:
                callerAvatar,
            },
          );

        if (!sent) {
          toast.error(
            "Could not connect to the other user.",
          );

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

          cleanup();

          return;
        }

        try {
          await notifyIncomingCall({
            data: {
              calleeId: peer.id,
              kind,
              callerName,
              callerAvatar,
            },
          });
        } catch (error) {
          console.error(
            "[WHATSXUP CALL PUSH]",
            error,
          );
        }
      },
      [
        user?.id,
        user,
        state.phase,
        getMedia,
        buildPeer,
        send,
        cleanup,
      ],
    );

  /*
   * =======================================================
   * ACCEPT CALL
   * =======================================================
   */

  const accept =
    useCallback(async () => {
      if (
        state.phase !==
          "incoming" ||
        !pendingOffer.current
      ) {
        return;
      }

      let stream: MediaStream;

      try {
        stream =
          await getMedia(
            state.kind,
          );
      } catch {
        await send(
          state.peerId,
          "decline",
          {},
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
          await send(
            state.peerId,
            "answer",
            {
              sdp: answer,
            },
          );

        if (!sent) {
          toast.error(
            "Could not send call answer.",
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

        setState({
          ...state,
          phase: "active",
        });

        pendingOffer.current =
          null;
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
    }, [
      state,
      getMedia,
      buildPeer,
      send,
      cleanup,
      applyPendingIce,
    ]);

  /*
   * =======================================================
   * DECLINE
   * =======================================================
   */

  const decline =
    useCallback(async () => {
      if (
        state.phase === "idle"
      ) {
        return;
      }

      await send(
        state.peerId,
        "decline",
        {},
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
    }, [
      state,
      send,
      cleanup,
    ]);

  /*
   * =======================================================
   * HANG UP
   * =======================================================
   */

  const hangUp =
    useCallback(async () => {
      if (
        state.phase === "idle"
      ) {
        return;
      }

      await send(
        state.peerId,
        "end",
        {},
      );

      await supabase
        .from("calls")
        .update({
          status:
            state.phase ===
            "active"
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
    }, [
      state,
      send,
      cleanup,
    ]);

  /*
   * =======================================================
   * CLEANUP OUTGOING SIGNAL CHANNELS
   * =======================================================
   */

  useEffect(() => {
    return () => {
      void cleanupSignalChannels();
    };
  }, [cleanupSignalChannels]);

  /*
   * =======================================================
   * CONTEXT VALUE
   * =======================================================
   */

  const value =
    useMemo(
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
   * =======================================================
   * CALL UI
   * =======================================================
   */

  return (
    <RealtimeContext.Provider
      value={value}
    >
      {children}

      {state.phase !==
        "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background app-gradient px-6 py-12 safe-bottom">
          <div className="flex flex-col items-center gap-4 pt-10 text-center">
            <UserAvatar
              path={
                state.peerAvatar
              }
              name={
                state.peerName
              }
              size="xl"
            />

            <div>
              <h2 className="text-2xl font-semibold">
                {
                  state.peerName
                }
              </h2>

              <p className="text-sm text-muted-foreground">
                {state.phase ===
                "incoming"
                  ? `Incoming ${state.kind} call`
                  : state.phase ===
                    "outgoing"
                    ? "Ringing…"
                    : durationLabel(
                        seconds,
                      )}
              </p>
            </div>
          </div>

          {state.kind ===
            "video" && (
            <div className="relative my-6 w-full max-w-md flex-1 overflow-hidden rounded-3xl bg-black">
              <video
                ref={
                  remoteVideo
                }
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />

              <div className="absolute right-3 top-3 h-36 w-28 overflow-hidden rounded-2xl border-2 border-white/30 bg-black shadow-xl">
                <video
                  ref={
                    localVideo
                  }
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />

                <div className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] text-white">
                  You
                </div>
              </div>

              {sharingScreen && (
                <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                  Sharing screen
                </div>
              )}
            </div>
          )}

          <audio
            ref={
              remoteAudio
            }
            autoPlay
          />

          <div className="flex flex-wrap items-center justify-center gap-3">
            {state.phase ===
              "active" && (
              <>
                <Button
                  size="icon"
                  variant={
                    muted
                      ? "secondary"
                      : "outline"
                  }
                  className="h-14 w-14 rounded-full"
                  onClick={() => {
                    const next =
                      !muted;

                    setMuted(
                      next,
                    );

                    localRef.current
                      ?.getAudioTracks()
                      .forEach(
                        (
                          track,
                        ) => {
                          track.enabled =
                            !next;
                        },
                      );
                  }}
                >
                  {muted ? (
                    <MicOff />
                  ) : (
                    <Mic />
                  )}
                </Button>

                {state.kind ===
                  "video" && (
                  <Button
                    size="icon"
                    variant={
                      camOff
                        ? "secondary"
                        : "outline"
                    }
                    disabled={
                      sharingScreen
                    }
                    className="h-14 w-14 rounded-full"
                    onClick={() => {
                      const next =
                        !camOff;

                      setCamOff(
                        next,
                      );

                      localRef.current
                        ?.getVideoTracks()
                        .forEach(
                          (
                            track,
                          ) => {
                            track.enabled =
                              !next;
                          },
                        );
                    }}
                  >
                    {camOff ? (
                      <CameraOff />
                    ) : (
                      <Camera />
                    )}
                  </Button>
                )}

                {state.kind ===
                  "video" && (
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={
                      sharingScreen
                    }
                    className="h-14 w-14 rounded-full"
                    onClick={() =>
                      void switchCamera()
                    }
                  >
                    <Video />
                  </Button>
                )}

                {state.kind ===
                  "video" && (
                  <Button
                    size="icon"
                    variant={
                      sharingScreen
                        ? "secondary"
                        : "outline"
                    }
                    className="h-14 w-14 rounded-full"
                    onClick={() => {
                      if (
                        sharingScreen
                      ) {
                        void restoreCameraAfterScreenShare();
                      } else {
                        void shareScreen();
                      }
                    }}
                  >
                    <MonitorUp />
                  </Button>
                )}
              </>
            )}

            {state.phase ===
              "incoming" && (
              <Button
                size="icon"
                className="h-16 w-16 rounded-full"
                onClick={() =>
                  void accept()
                }
              >
                <Phone />
              </Button>
            )}

            <Button
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={() =>
                void (
                  state.phase ===
                  "incoming"
                    ? decline()
                    : hangUp()
                )
              }
            >
              <PhoneOff />
            </Button>
          </div>
        </div>
      )}
    </RealtimeContext.Provider>
  );
}

/*
 * =========================================================
 * HOOK
 * =========================================================
 */

export function useRealtime() {
  return useContext(
    RealtimeContext,
  );
}