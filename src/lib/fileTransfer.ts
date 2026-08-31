// src/lib/fileTransfer.ts
// A = Nearby WebRTC, signaling on GAMING Supabase Realtime
// B = Cloud upload to GAMING Storage via signed URL (server functions)

import { getGamingSupabaseBrowser } from "@/integrations/gaming-supabase/client";
import {
  beginGamingTransferUpload,
  finishGamingTransferUpload,
} from "@/lib/transfer.functions";

const CHUNK = 64 * 1024;

export function randomCode(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]!;
  }
  return s;
}

export type TransferProgress = {
  sent: number;
  total: number;
  pct: number;
};

/* ---------------- Cloud (B) — gaming storage ---------------- */

export async function uploadTransferCloud(
  _userId: string,
  file: File,
  onProgress?: (p: TransferProgress) => void,
): Promise<{ url: string; path: string; name: string; size: number }> {
  onProgress?.({ sent: 0, total: file.size, pct: 0 });

  const begin = await beginGamingTransferUpload({
    data: {
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    },
  });

  // PUT file to gaming storage signed upload URL
  const put = await fetch(begin.signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!put.ok) {
    const text = await put.text().catch(() => "");
    throw new Error(
      text || `Upload failed (${put.status}). Check gaming bucket "transfers".`,
    );
  }

  onProgress?.({ sent: file.size, total: file.size, pct: 95 });

  const finished = await finishGamingTransferUpload({
    data: { path: begin.path },
  });

  onProgress?.({ sent: file.size, total: file.size, pct: 100 });

  return {
    url: finished.url,
    path: begin.path,
    name: file.name,
    size: file.size,
  };
}

/* ---------------- Nearby WebRTC (A) — gaming Realtime ---------------- */

type SignalMsg =
  | { type: "hello"; role: "sender" | "receiver" }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit }
  | { type: "meta"; name: string; size: number; mime: string }
  | { type: "done" };

function channelName(code: string) {
  return `xfer:${code.toUpperCase()}`;
}

export async function sendNearby(
  code: string,
  file: File,
  onProgress?: (p: TransferProgress) => void,
  onStatus?: (s: string) => void,
): Promise<void> {
  const gaming = getGamingSupabaseBrowser();
  const room = gaming.channel(channelName(code), {
    config: { broadcast: { self: false } },
  });

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  const dc = pc.createDataChannel("file", { ordered: true });
  dc.binaryType = "arraybuffer";

  const iceQueue: RTCIceCandidateInit[] = [];

  const sendSignal = async (msg: SignalMsg) => {
    await room.send({ type: "broadcast", event: "sig", payload: msg });
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      void sendSignal({ type: "ice", candidate: ev.candidate.toJSON() });
    }
  };

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("Receiver did not join in time (2 min)"));
    }, 120_000);

    room.on("broadcast", { event: "sig" }, async ({ payload }) => {
      const msg = payload as SignalMsg;
      try {
        if (msg.type === "hello" && msg.role === "receiver") {
          onStatus?.("Receiver joined — connecting…");
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal({ type: "offer", sdp: offer });
        } else if (msg.type === "answer") {
          await pc.setRemoteDescription(msg.sdp);
          for (const c of iceQueue) {
            try {
              await pc.addIceCandidate(c);
            } catch {
              /* ignore */
            }
          }
          iceQueue.length = 0;
        } else if (msg.type === "ice") {
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(msg.candidate);
            } catch {
              /* ignore */
            }
          } else {
            iceQueue.push(msg.candidate);
          }
        }
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Signal error"));
      }
    });

    dc.onopen = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    dc.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Data channel error"));
    };

    void room.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        onStatus?.("Waiting for receiver… share code " + code.toUpperCase());
        await sendSignal({ type: "hello", role: "sender" });
      }
    });
  });

  onStatus?.("Sending…");
  await sendSignal({
    type: "meta",
    name: file.name,
    size: file.size,
    mime: file.type || "application/octet-stream",
  });

  await new Promise((r) => setTimeout(r, 100));

  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK);
    const buf = await slice.arrayBuffer();
    while (dc.bufferedAmount > CHUNK * 8) {
      await new Promise((r) => setTimeout(r, 20));
    }
    dc.send(buf);
    offset += buf.byteLength;
    onProgress?.({
      sent: offset,
      total: file.size,
      pct: Math.round((offset / file.size) * 100),
    });
  }

  await sendSignal({ type: "done" });
  onStatus?.("Sent");

  await new Promise((r) => setTimeout(r, 500));
  dc.close();
  pc.close();
  await gaming.removeChannel(room);
}

export async function receiveNearby(
  code: string,
  onProgress?: (p: TransferProgress) => void,
  onStatus?: (s: string) => void,
): Promise<{ blob: Blob; name: string; mime: string }> {
  const gaming = getGamingSupabaseBrowser();
  const room = gaming.channel(channelName(code), {
    config: { broadcast: { self: false } },
  });

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  const iceQueue: RTCIceCandidateInit[] = [];
  let meta: { name: string; size: number; mime: string } | null = null;
  const chunks: ArrayBuffer[] = [];
  let received = 0;

  const sendSignal = async (msg: SignalMsg) => {
    await room.send({ type: "broadcast", event: "sig", payload: msg });
  };

  pc.onicecandidate = (ev) => {
    if (ev.candidate) {
      void sendSignal({ type: "ice", candidate: ev.candidate.toJSON() });
    }
  };

  const result = await new Promise<{ blob: Blob; name: string; mime: string }>(
    (resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Transfer timed out"));
      }, 300_000);

      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        dc.binaryType = "arraybuffer";
        dc.onmessage = (mev) => {
          const data = mev.data as ArrayBuffer;
          chunks.push(data);
          received += data.byteLength;
          if (meta) {
            onProgress?.({
              sent: received,
              total: meta.size,
              pct: Math.min(100, Math.round((received / meta.size) * 100)),
            });
            if (received >= meta.size) {
              window.clearTimeout(timeout);
              resolve({
                blob: new Blob(chunks, {
                  type: meta.mime || "application/octet-stream",
                }),
                name: meta.name,
                mime: meta.mime,
              });
            }
          }
        };
      };

      room.on("broadcast", { event: "sig" }, async ({ payload }) => {
        const msg = payload as SignalMsg;
        try {
          if (msg.type === "offer") {
            await pc.setRemoteDescription(msg.sdp);
            for (const c of iceQueue) {
              try {
                await pc.addIceCandidate(c);
              } catch {
                /* ignore */
              }
            }
            iceQueue.length = 0;
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal({ type: "answer", sdp: answer });
            onStatus?.("Connected — receiving…");
          } else if (msg.type === "ice") {
            if (pc.remoteDescription) {
              try {
                await pc.addIceCandidate(msg.candidate);
              } catch {
                /* ignore */
              }
            } else {
              iceQueue.push(msg.candidate);
            }
          } else if (msg.type === "meta") {
            meta = { name: msg.name, size: msg.size, mime: msg.mime };
            onStatus?.(`Receiving ${msg.name}…`);
          } else if (msg.type === "done" && meta && received >= meta.size) {
            window.clearTimeout(timeout);
            resolve({
              blob: new Blob(chunks, {
                type: meta.mime || "application/octet-stream",
              }),
              name: meta.name,
              mime: meta.mime,
            });
          }
        } catch (e) {
          window.clearTimeout(timeout);
          reject(e instanceof Error ? e : new Error("Receive failed"));
        }
      });

      void room.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          onStatus?.("Joined — waiting for sender…");
          await sendSignal({ type: "hello", role: "receiver" });
        }
      });
    },
  );

  pc.close();
  await gaming.removeChannel(room);
  return result;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
