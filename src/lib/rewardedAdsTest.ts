const GOOGLE_WEB_TEST_AD_UNIT_PATH = "/22639388115/rewarded_web_example";
const GOOGLE_PUBLISHER_TAG_URL = "https://securepubads.g.doubleclick.net/tag/js/gpt.js";

interface GoogleRewardedSlot {
  addService(service: GooglePubadsService): GoogleRewardedSlot;
}

interface GoogleSlotEvent {
  slot: GoogleRewardedSlot;
}

interface GoogleRewardedReadyEvent extends GoogleSlotEvent {
  makeRewardedVisible(): void;
}

interface GoogleRewardedGrantedEvent extends GoogleSlotEvent {
  payload?: { amount: number; type: string };
}

interface GoogleSlotRenderEndedEvent extends GoogleSlotEvent {
  isEmpty: boolean;
}

type GoogleRewardedEvent =
  | GoogleRewardedReadyEvent
  | GoogleRewardedGrantedEvent
  | GoogleSlotRenderEndedEvent
  | GoogleSlotEvent;
type GoogleEventListener = (event: GoogleRewardedEvent) => void;

interface GooglePubadsService {
  addEventListener(eventName: string, listener: GoogleEventListener): void;
  removeEventListener(eventName: string, listener: GoogleEventListener): void;
}

interface GooglePublisherTag {
  cmd: { push(command: () => void): number };
  enums: { OutOfPageFormat: { REWARDED: number } };
  defineOutOfPageSlot(adUnitPath: string, format: number): GoogleRewardedSlot | null;
  pubads(): GooglePubadsService;
  enableServices(): void;
  display(slot: GoogleRewardedSlot): void;
  destroySlots(slots?: GoogleRewardedSlot[]): boolean;
}

type WindowWithGooglePublisherTag = Window & {
  googletag?: GooglePublisherTag;
};

export interface GoogleWebRewardedTestCallbacks {
  onReady(show: () => void): void;
  onReward(payload: { amount: number; type: string } | null): void;
  onClosed(earned: boolean): void;
  onError(message: string): void;
}

let publisherTagPromise: Promise<GooglePublisherTag> | null = null;
let publisherServicesEnabled = false;

function loadGooglePublisherTag(): Promise<GooglePublisherTag> {
  const taggedWindow = window as WindowWithGooglePublisherTag;
  const existingTag = taggedWindow.googletag;
  if (existingTag?.defineOutOfPageSlot) {
    return Promise.resolve(existingTag);
  }
  if (publisherTagPromise) return publisherTagPromise;

  const queuedTag = existingTag ?? ({ cmd: [] } as unknown as GooglePublisherTag);
  taggedWindow.googletag = queuedTag;

  publisherTagPromise = new Promise<GooglePublisherTag>((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = GOOGLE_PUBLISHER_TAG_URL;
    script.dataset["rewardedAdsTest"] = "true";
    script.onload = () => resolve(taggedWindow.googletag ?? queuedTag);
    script.onerror = () => reject(new Error("Google Publisher Tag could not load."));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    publisherTagPromise = null;
    throw error;
  });

  return publisherTagPromise;
}

/**
 * Requests Google's documented GPT rewarded-web example slot. A reward is
 * reported only when Google fires rewardedSlotGranted; this helper never
 * persists or applies reward data.
 */
export function requestGoogleWebRewardedTestAd(
  callbacks: GoogleWebRewardedTestCallbacks,
): () => void {
  let cancelled = false;
  let settled = false;
  let rewardGranted = false;
  let readyReceived = false;
  let slot: GoogleRewardedSlot | null = null;
  let pubads: GooglePubadsService | null = null;
  let tag: GooglePublisherTag | null = null;
  let loadTimeout: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (loadTimeout !== null) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
    if (pubads) {
      pubads.removeEventListener("rewardedSlotReady", readyListener);
      pubads.removeEventListener("rewardedSlotGranted", grantedListener);
      pubads.removeEventListener("rewardedSlotClosed", closedListener);
      pubads.removeEventListener("slotRenderEnded", renderEndedListener);
    }
    if (slot && tag) {
      tag.destroySlots([slot]);
      slot = null;
    }
  };

  const fail = (message: string) => {
    if (cancelled || settled) return;
    settled = true;
    cleanup();
    callbacks.onError(message);
  };

  const matchesSlot = (event: GoogleRewardedEvent) => slot !== null && event.slot === slot;

  const readyListener: GoogleEventListener = (event) => {
    if (!matchesSlot(event) || !("makeRewardedVisible" in event) || readyReceived) {
      return;
    }
    readyReceived = true;
    if (loadTimeout !== null) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
    callbacks.onReady(() => {
      if (cancelled || settled) return;
      try {
        event.makeRewardedVisible();
      } catch (error) {
        fail(error instanceof Error ? error.message : "Could not show the test ad.");
      }
    });
  };

  const grantedListener: GoogleEventListener = (event) => {
    if (!matchesSlot(event) || !("payload" in event) || rewardGranted) return;
    rewardGranted = true;
    callbacks.onReward(event.payload ?? null);
  };

  const closedListener: GoogleEventListener = (event) => {
    if (!matchesSlot(event) || settled || cancelled) return;
    settled = true;
    cleanup();
    callbacks.onClosed(rewardGranted);
  };

  const renderEndedListener: GoogleEventListener = (event) => {
    if (matchesSlot(event) && "isEmpty" in event && event.isEmpty && !readyReceived) {
      fail("Google did not return a web rewarded test ad for this page.");
    }
  };

  loadTimeout = setTimeout(
    () => fail("Timed out waiting for Google's web rewarded test ad."),
    30_000,
  );

  void loadGooglePublisherTag()
    .then((loadedTag) => {
      if (cancelled || settled) return;
      tag = loadedTag;
      tag.cmd.push(() => {
        if (cancelled || settled || !tag) return;
        try {
          slot = tag.defineOutOfPageSlot(
            GOOGLE_WEB_TEST_AD_UNIT_PATH,
            tag.enums.OutOfPageFormat.REWARDED,
          );
          if (!slot) {
            fail("Google reports rewarded ads are not supported on this page.");
            return;
          }

          pubads = tag.pubads();
          slot.addService(pubads);
          pubads.addEventListener("rewardedSlotReady", readyListener);
          pubads.addEventListener("rewardedSlotGranted", grantedListener);
          pubads.addEventListener("rewardedSlotClosed", closedListener);
          pubads.addEventListener("slotRenderEnded", renderEndedListener);

          if (!publisherServicesEnabled) {
            tag.enableServices();
            publisherServicesEnabled = true;
          }
          tag.display(slot);
        } catch (error) {
          fail(
            error instanceof Error
              ? error.message
              : "Could not request Google's web rewarded test ad.",
          );
        }
      });
    })
    .catch((error: unknown) => {
      fail(error instanceof Error ? error.message : "Google Publisher Tag could not load.");
    });

  return () => {
    cancelled = true;
    cleanup();
  };
}
