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

/*
 * WebRTC configuration.
 *
 * STUN helps devices discover their public network address.
 * TURN should be added later for reliable calls across
 * restrictive mobile networks.
 */
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
  const [sharingScreen, setSharingScreen] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);

  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);

  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);

  const pendingOffer = useRef<RTCSessionDescriptionInit | null>(
    null,
  );

  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>(
    [],
  );

  const signalChannel = useRef<RealtimeChannel | null>(null);

  const remoteDescriptionSet = useRef(false);

  const mountedRef = useRef(true);

  /*
   * ---------------------------------------------------------
   * COMPONENT MOUNT STATE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * SEND SIGNAL
   * ---------------------------------------------------------
   */

  const send = useCallback(
    async (
      to: string,
      type: string,
      payload: Record<string, unknown> = {},
    ) => {
      if (!user?.id || !to) return;

      const channel = supabase.channel(`signal:${to}`);

      try {
        const status = await channel.subscribe();

        if (status !== "SUBSCRIBED") {
          console.error(
            "[WHATSXUP SIGNAL] Subscription failed:",
            status,
          );

          return;
        }

        await channel.send({
          type: "broadcast",
          event: "signal",
          payload: {
            type,
            from: user.id,
            ...payload,
          },
        });
      } catch (error) {
        console.error(
          "[WHATSXUP SIGNAL] Send failed:",
          error,
        );
      } finally {
        setTimeout(() => {
          void supabase.removeChannel(channel);
        }, 1000);
      }
    },
    [user?.id],
  );

  /*
   * ---------------------------------------------------------
   * ATTACH LOCAL VIDEO
   * ---------------------------------------------------------
   */

  const attachLocalVideo = useCallback(() => {
    if (
      !localVideo.current ||
      !localRef.current
    ) {
      return;
    }

    localVideo.current.srcObject = localRef.current;

    void localVideo.current
      .play()
      .catch(() => undefined);
  }, []);

  /*
   * ---------------------------------------------------------
   * ATTACH REMOTE MEDIA
   * ---------------------------------------------------------
   */

  const attachRemoteMedia = useCallback(() => {
    if (!remoteRef.current) {
      return;
    }

    if (remoteVideo.current) {
      remoteVideo.current.srcObject =
        remoteRef.current;

      void remoteVideo.current
        .play()
        .catch(() => undefined);
    }

    if (remoteAudio.current) {
      remoteAudio.current.srcObject =
        remoteRef.current;

      void remoteAudio.current
        .play()
        .catch(() => undefined);
    }
  }, []);

  /*
   * ---------------------------------------------------------
   * CLEANUP CALL
   * ---------------------------------------------------------
   */

  const cleanup = useCallback(() => {
    console.log(
      "[WHATSXUP CALL] Cleaning up call",
    );

    const pc = pcRef.current;

    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;

      try {
        pc.close();
      } catch {
        // Ignore close errors.
      }
    }

    pcRef.current = null;

    localRef.current
      ?.getTracks()
      .forEach((track) => {
        track.stop();
      });

    localRef.current = null;

    remoteRef.current = null;

    pendingOffer.current = null;

    pendingIceCandidates.current = [];

    remoteDescriptionSet.current = false;

    if (localVideo.current) {
      localVideo.current.srcObject = null;
    }

    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }

    if (remoteAudio.current) {
      remoteAudio.current.srcObject = null;
    }

    setMuted(false);
    setCamOff(false);
    setSharingScreen(false);
    setSeconds(0);

    if (mountedRef.current) {
      setState({
        phase: "idle",
      });
    }
  }, []);

  /*
   * ---------------------------------------------------------
   * GET MICROPHONE / CAMERA
   * ---------------------------------------------------------
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
          "getUserMedia is not supported",
        );
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

        attachLocalVideo();

        return stream;
      } catch (error) {
        const name =
          (error as DOMException)?.name;

        if (name === "NotAllowedError") {
          toast.error(
            "Camera/microphone permission denied",
            {
              description:
                "Allow camera and microphone permissions in your browser settings.",
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
            "Your camera or microphone is already being used.",
          );
        } else {
          toast.error(
            "Could not access your camera or microphone.",
          );
        }

        throw error;
      }
    },
    [attachLocalVideo],
  );

  /*
   * ---------------------------------------------------------
   * ADD QUEUED ICE CANDIDATES
   * ---------------------------------------------------------
   */

  const flushPendingIce = useCallback(
    async () => {
      const pc = pcRef.current;

      if (
        !pc ||
        !remoteDescriptionSet.current
      ) {
        return;
      }

      const candidates =
        pendingIceCandidates.current;

      pendingIceCandidates.current = [];

      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(
            candidate,
          );
        } catch (error) {
          console.warn(
            "[WHATSXUP ICE] Could not add queued candidate:",
            error,
          );
        }
      }
    },
    [],
  );

  /*
   * ---------------------------------------------------------
   * BUILD WEBRTC PEER
   * ---------------------------------------------------------
   */

  const buildPeer = useCallback(
    (
      peerId: string,
      stream: MediaStream,
    ) => {
      /*
       * Close any previous peer.
       */

      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          // Ignore.
        }
      }

      remoteDescriptionSet.current = false;

      pendingIceCandidates.current = [];

      const pc =
        new RTCPeerConnection(ICE);

      /*
       * Add microphone and camera tracks.
       */

      stream
        .getTracks()
        .forEach((track) => {
          pc.addTrack(track, stream);
        });

      /*
       * Prepare remote stream.
       */

      const remote = new MediaStream();

      remoteRef.current = remote;

      /*
       * Remote tracks.
       */

      pc.ontrack = (event) => {
        console.log(
          "[WHATSXUP WEBRTC] Remote track received:",
          event.track.kind,
        );

        event.streams[0]
          ?.getTracks()
          .forEach((track) => {
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
          });

        attachRemoteMedia();
      };

      /*
       * ICE candidates.
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
       * Connection state.
       */

      pc.onconnectionstatechange =
        () => {
          console.log(
            "[WHATSXUP WEBRTC] Connection state:",
            pc.connectionState,
          );

          if (
            pc.connectionState ===
            "connected"
          ) {
            console.log(
              "[WHATSXUP WEBRTC] Connected successfully",
            );
          }

          if (
            pc.connectionState ===
              "failed" ||
            pc.connectionState ===
              "disconnected"
          ) {
            if (mountedRef.current) {
              toast.error(
                "The call connection was lost.",
              );
            }

            cleanup();
          }
        };

      /*
       * ICE connection state.
       */

      pc.oniceconnectionstatechange =
        () => {
          console.log(
            "[WHATSXUP WEBRTC] ICE state:",
            pc.iceConnectionState,
          );

          if (
            pc.iceConnectionState ===
            "failed"
          ) {
            if (mountedRef.current) {
              toast.error(
                "Could not establish the video connection.",
              );
            }

            cleanup();
          }
        };

      pcRef.current = pc;

      return pc;
    },
    [
      send,
      cleanup,
      attachRemoteMedia,
    ],
  );

  /*
   * ---------------------------------------------------------
   * RECEIVE SIGNALS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!user) {
      return;
    }

    const channel =
      supabase.channel(
        `signal:${user.id}`,
      );

    channel.on(
      "broadcast",
      {
        event: "signal",
      },
      async ({ payload }) => {
        const p =
          payload as Record<
            string,
            unknown
          >;

        const type = String(
          p.type ?? "",
        );

        console.log(
          "[WHATSXUP SIGNAL] Received:",
          type,
        );

        /*
         * ---------------------------------------------------
         * INCOMING OFFER
         * ---------------------------------------------------
         */

        if (type === "offer") {
          pendingOffer.current =
            p.sdp as RTCSessionDescriptionInit;

          const incomingName =
            String(
              p.name ?? "Unknown",
            );

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
            callId: String(
              p.callId,
            ),
            peerId: String(
              p.from,
            ),
            peerName:
              incomingName,
            peerAvatar:
              incomingAvatar,
            kind:
              incomingKind,
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
         * ---------------------------------------------------
         * ANSWER
         * ---------------------------------------------------
         */

        if (type === "answer") {
          const pc =
            pcRef.current;

          if (!pc) {
            console.warn(
              "[WHATSXUP WEBRTC] No peer connection for answer",
            );

            return;
          }

          try {
            await pc.setRemoteDescription(
              p.sdp as RTCSessionDescriptionInit,
            );

            remoteDescriptionSet.current =
              true;

            await flushPendingIce();

            setState((current) =>
              current.phase ===
              "outgoing"
                ? {
                    ...current,
                    phase:
                      "active",
                  }
                : current,
            );
          } catch (error) {
            console.error(
              "[WHATSXUP WEBRTC] Failed to set answer:",
              error,
            );

            toast.error(
              "Could not connect the call.",
            );

            cleanup();
          }

          return;
        }

        /*
         * ---------------------------------------------------
         * ICE CANDIDATE
         * ---------------------------------------------------
         */

        if (type === "ice") {
          const candidate =
            p.candidate as RTCIceCandidateInit;

          if (
            !candidate ||
            !candidate.candidate
          ) {
            return;
          }

          const pc =
            pcRef.current;

          if (
            !pc ||
            !remoteDescriptionSet.current
          ) {
            pendingIceCandidates.current.push(
              candidate,
            );

            return;
          }

          try {
            await pc.addIceCandidate(
              candidate,
            );
          } catch (error) {
            console.warn(
              "[WHATSXUP ICE] Failed to add candidate:",
              error,
            );
          }

          return;
        }

        /*
         * ---------------------------------------------------
         * DECLINE
         * ---------------------------------------------------
         */

        if (type === "decline") {
          toast.info(
            "Call declined",
          );

          cleanup();

          return;
        }

        /*
         * ---------------------------------------------------
         * END CALL
         * ---------------------------------------------------
         */

        if (type === "end") {
          cleanup();

          return;
        }
      },
    );

    void channel.subscribe();

    signalChannel.current =
      channel;

    return () => {
      void supabase.removeChannel(
        channel,
      );

      if (
        signalChannel.current ===
        channel
      ) {
        signalChannel.current =
          null;
      }
    };
  }, [
    user,
    cleanup,
    flushPendingIce,
  ]);

  /*
   * ---------------------------------------------------------
   * ATTACH VIDEOS AFTER UI RENDERS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (
      state.phase === "idle"
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        attachLocalVideo();
        attachRemoteMedia();
      }, 0);

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    state.phase,
    state.kind,
    attachLocalVideo,
    attachRemoteMedia,
  ]);

  /*
   * ---------------------------------------------------------
   * ONLINE PRESENCE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!user) {
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

    void channel.subscribe(
      async (status) => {
        if (
          status ===
          "SUBSCRIBED"
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
          .eq(
            "id",
            user.id,
          );
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
  }, [user]);

  /*
   * ---------------------------------------------------------
   * CALL TIMER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (
      state.phase !==
      "active"
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setSeconds(
          (current) =>
            current + 1,
        );
      }, 1000);

    return () => {
      window.clearInterval(
        timer,
      );
    };
  }, [state.phase]);

  /*
   * ---------------------------------------------------------
   * START CALL
   * ---------------------------------------------------------
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
      if (!user) {
        return;
      }

      if (
        state.phase !==
        "idle"
      ) {
        toast.info(
          "You are already in a call.",
        );

        return;
      }

      /*
       * Create database call.
       */

      const { data, error } =
        await supabase
          .from("calls")
          .insert({
            caller_id:
              user.id,
            callee_id:
              peer.id,
            kind,
            status:
              "ringing",
          })
          .select("id")
          .single();

      if (error) {
        toast.error(
          error.message,
        );

        return;
      }

      /*
       * Get local camera/microphone.
       */

      let stream: MediaStream;

      try {
        stream =
          await getMedia(
            kind,
          );
      } catch {
        await supabase
          .from("calls")
          .update({
            status:
              "failed",
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
       * Show outgoing call.
       */

      setState({
        phase:
          "outgoing",
        callId:
          data.id,
        peerId:
          peer.id,
        peerName:
          peer.name,
        peerAvatar:
          peer.avatar,
        kind,
      });

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
       * Get caller profile.
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

      /*
       * Send offer.
       */

      await send(
        peer.id,
        "offer",
        {
          sdp: offer,
          callId:
            data.id,
          kind,
          name:
            callerName,
          avatar:
            callerAvatar,
        },
      );

      /*
       * Send push notification.
       *
       * Failure here does NOT break WebRTC.
       */

      try {
        await notifyIncomingCall(
          {
            calleeId:
              peer.id,
            kind,
            callerName,
            callerAvatar,
          },
        );
      } catch (error) {
        console.error(
          "[WHATSXUP CALL PUSH] Failed:",
          error,
        );
      }
    },
    [
      user,
      state.phase,
      getMedia,
      buildPeer,
      send,
    ],
  );

  /*
   * ---------------------------------------------------------
   * ACCEPT CALL
   * ---------------------------------------------------------
   */

  const accept = useCallback(
    async () => {
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
        /*
         * Set caller's offer.
         */

        await pc.setRemoteDescription(
          pendingOffer.current,
        );

        remoteDescriptionSet.current =
          true;

        /*
         * Add any ICE candidates
         * that arrived early.
         */

        await flushPendingIce();

        /*
         * Create answer.
         */

        const answer =
          await pc.createAnswer();

        await pc.setLocalDescription(
          answer,
        );

        /*
         * Send answer.
         */

        await send(
          state.peerId,
          "answer",
          {
            sdp: answer,
          },
        );

        /*
         * Update database.
         */

        await supabase
          .from("calls")
          .update({
            status:
              "accepted",
          })
          .eq(
            "id",
            state.callId,
          );

        setState({
          ...state,
          phase:
            "active",
        });
      } catch (error) {
        console.error(
          "[WHATSXUP ACCEPT] Failed:",
          error,
        );

        toast.error(
          "Could not connect the call.",
        );

        cleanup();
      }
    },
    [
      state,
      getMedia,
      buildPeer,
      flushPendingIce,
      send,
      cleanup,
    ],
  );

  /*
   * ---------------------------------------------------------
   * DECLINE
   * ---------------------------------------------------------
   */

  const decline = useCallback(
    async () => {
      if (
        state.phase ===
        "idle"
      ) {
        return;
      }

      await send(
        state.peerId,
        "decline",
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
      send,
      cleanup,
    ],
  );

  /*
   * ---------------------------------------------------------
   * HANG UP
   * ---------------------------------------------------------
   */

  const hangUp = useCallback(
    async () => {
      if (
        state.phase ===
        "idle"
      ) {
        return;
      }

      await send(
        state.peerId,
        "end",
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
    },
    [
      state,
      send,
      cleanup,
    ],
  );

  /*
   * ---------------------------------------------------------
   * SWITCH FRONT / REAR CAMERA
   * ---------------------------------------------------------
   */

  const switchCamera =
    useCallback(
      async () => {
        if (
          state.phase ===
            "idle" ||
          state.kind !==
            "video" ||
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
            currentFacing ===
            "user"
              ? "environment"
              : "user";

          const newStream =
            await navigator.mediaDevices.getUserMedia(
              {
                audio: false,
                video: {
                  facingMode: {
                    ideal:
                      nextFacing,
                  },
                },
              },
            );

          const newTrack =
            newStream.getVideoTracks()[0];

          if (!newTrack) {
            newStream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop(),
              );

            return;
          }

          const sender =
            pcRef.current
              .getSenders()
              .find(
                (item) =>
                  item.track
                    ?.kind ===
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

          attachLocalVideo();

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
      },
      [
        state,
        attachLocalVideo,
      ],
    );

  /*
   * ---------------------------------------------------------
   * RESTORE CAMERA
   * ---------------------------------------------------------
   */

  const restoreCamera =
    useCallback(
      async () => {
        if (
          state.phase ===
            "idle" ||
          state.kind !==
            "video" ||
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
                  facingMode:
                    "user",
                },
              },
            );

          const cameraTrack =
            cameraStream.getVideoTracks()[0];

          if (!cameraTrack) {
            cameraStream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop(),
              );

            return;
          }

          const sender =
            pcRef.current
              .getSenders()
              .find(
                (item) =>
                  item.track
                    ?.kind ===
                  "video",
              );

          if (sender) {
            await sender.replaceTrack(
              cameraTrack,
            );
          }

          const oldVideoTrack =
            localRef.current?.getVideoTracks()[0];

          if (oldVideoTrack) {
            oldVideoTrack.stop();

            localRef.current?.removeTrack(
              oldVideoTrack,
            );
          }

          if (
            localRef.current
          ) {
            localRef.current.addTrack(
              cameraTrack,
            );
          }

          attachLocalVideo();

          setSharingScreen(
            false,
          );

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
      },
      [
        state,
        attachLocalVideo,
      ],
    );

  /*
   * ---------------------------------------------------------
   * SCREEN SHARING
   * ---------------------------------------------------------
   */

  const shareScreen =
    useCallback(
      async () => {
        if (
          state.phase ===
            "idle" ||
          state.kind !==
            "video" ||
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
                  item.track
                    ?.kind ===
                  "video",
              );

          if (!sender) {
            screenTrack.stop();

            return;
          }

          await sender.replaceTrack(
            screenTrack,
          );

          if (
            localVideo.current
          ) {
            const preview =
              new MediaStream([
                screenTrack,
              ]);

            localVideo.current.srcObject =
              preview;

            await localVideo.current
              .play()
              .catch(
                () =>
                  undefined,
              );
          }

          setSharingScreen(
            true,
          );

          screenTrack.onended =
            () => {
              void restoreCamera();
            };
        } catch (error) {
          const name =
            (
              error as DOMException
            )?.name;

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
      },
      [
        state,
        restoreCamera,
      ],
    );

  /*
   * ---------------------------------------------------------
   * CONTEXT VALUE
   * ---------------------------------------------------------
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
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <RealtimeContext.Provider
      value={value}
    >
      {children}

      {state.phase !==
        "idle" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background app-gradient px-6 py-12 safe-bottom">
          {/* HEADER */}

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

          {/* VIDEO */}

          {state.kind ===
            "video" && (
            <div className="relative my-6 w-full max-w-md flex-1 overflow-hidden rounded-3xl bg-black">
              {/* REMOTE VIDEO */}

              <video
                ref={
                  remoteVideo
                }
                autoPlay
                playsInline
                className="h-full w-full object-cover"
              />

              {/* LOCAL VIDEO */}

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

          {/* REMOTE AUDIO */}

          <audio
            ref={
              remoteAudio
            }
            autoPlay
          />

          {/* CONTROLS */}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {state.phase ===
              "active" && (
              <>
                {/* MIC */}

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

                {/* CAMERA */}

                {state.kind ===
                  "video" && (
                  <Button
                    size="icon"
                    variant={
                      camOff
                        ? "secondary"
                        : "outline"
                    }
                    className="h-14 w-14 rounded-full"
                    disabled={
                      sharingScreen
                    }
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

                {/* SWITCH CAMERA */}

                {state.kind ===
                  "video" && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-14 w-14 rounded-full"
                    disabled={
                      sharingScreen
                    }
                    onClick={() =>
                      void switchCamera()
                    }
                    title="Switch camera"
                  >
                    <Video />
                  </Button>
                )}

                {/* SCREEN SHARE */}

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
                        void restoreCamera();
                      } else {
                        void shareScreen();
                      }
                    }}
                    title="Share screen"
                  >
                    <MonitorUp />
                  </Button>
                )}
              </>
            )}

            {/* ACCEPT */}

            {state.phase ===
              "incoming" && (
              <Button
                size="icon"
                className="h-16 w-16 rounded-full"
                onClick={() =>
                  void accept()
                }
                title="Accept call"
              >
                <Phone />
              </Button>
            )}

            {/* DECLINE / END */}

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
              title={
                state.phase ===
                "incoming"
                  ? "Decline call"
                  : "End call"
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

export function useRealtime() {
  return useContext(
    RealtimeContext,
  );
}