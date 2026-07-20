import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePremium } from "@/lib/premium";

/**
 * Google AdMob integration for the Capacitor Android build.
 *
 * - Web: fully inert. All calls are no-ops so `bun run build` and the
 *   deployed web version behave exactly as before.
 * - Native (Android): initializes AdMob once, exposes helpers to show/hide
 *   a banner and to fire an interstitial after every N completed practice
 *   sessions. Premium users never see ads.
 *
 * Change AdMob IDs in ADMOB_CONFIG below — nothing else in the app needs
 * to change.
 */

export const ADMOB_CONFIG = {
  appId: "ca-app-pub-5229984747218768~1557456372",
  bannerAdUnitId: "ca-app-pub-5229984747218768/6538320315",
  interstitialAdUnitId: "ca-app-pub-5229984747218768/7608427624",
  // Show an interstitial after every N completed practice sessions.
  interstitialEveryNSessions: 3,
  // Local storage key for the completed-session counter.
  sessionCounterKey: "riyaz:ads:sessionCount:v1",
} as const;

interface CapacitorLike {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
}

async function getCapacitor(): Promise<CapacitorLike | null> {
  try {
    const mod = await import("@capacitor/core");
    return mod.Capacitor as unknown as CapacitorLike;
  } catch {
    return null;
  }
}

async function getAdMob() {
  const mod = await import("@capacitor-community/admob");
  return mod;
}

let initPromise: Promise<boolean> | null = null;
let bannerVisible = false;
let interstitialPrepared = false;

async function ensureInitialized(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const cap = await getCapacitor();
    if (!cap?.isNativePlatform()) return false;
    try {
      const { AdMob } = await getAdMob();
      await AdMob.initialize({
        initializeForTesting: false,
      });
      return true;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[ads] init failed", e);
      return false;
    }
  })();
  return initPromise;
}

async function prepareInterstitial() {
  if (interstitialPrepared) return;
  const ok = await ensureInitialized();
  if (!ok) return;
  try {
    const { AdMob } = await getAdMob();
    await AdMob.prepareInterstitial({
      adId: ADMOB_CONFIG.interstitialAdUnitId,
    });
    interstitialPrepared = true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[ads] prepareInterstitial failed", e);
  }
}

export async function showBanner() {
  const ok = await ensureInitialized();
  if (!ok || bannerVisible) return;
  try {
    const { AdMob, BannerAdPosition, BannerAdSize } = await getAdMob();
    await AdMob.showBanner({
      adId: ADMOB_CONFIG.bannerAdUnitId,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 56, // leave room above the mobile bottom nav
      isTesting: false,
    });
    bannerVisible = true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[ads] showBanner failed", e);
  }
}

export async function hideBanner() {
  if (!bannerVisible) return;
  try {
    const { AdMob } = await getAdMob();
    await AdMob.hideBanner();
    await AdMob.removeBanner().catch(() => undefined);
  } catch {
    /* ignore */
  } finally {
    bannerVisible = false;
  }
}

async function showInterstitial() {
  const ok = await ensureInitialized();
  if (!ok) return;
  try {
    await prepareInterstitial();
    if (!interstitialPrepared) return;
    const { AdMob } = await getAdMob();
    await AdMob.showInterstitial();
    interstitialPrepared = false;
    // Warm the next one up.
    void prepareInterstitial();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[ads] showInterstitial failed", e);
  }
}

function readSessionCounter(): number {
  try {
    return Number(localStorage.getItem(ADMOB_CONFIG.sessionCounterKey) ?? "0") || 0;
  } catch {
    return 0;
  }
}
function writeSessionCounter(n: number) {
  try {
    localStorage.setItem(ADMOB_CONFIG.sessionCounterKey, String(n));
  } catch {
    /* ignore */
  }
}

interface AdsContextValue {
  /** Free-user screens call this once mounted to show a banner. */
  useBannerOnScreen: () => void;
  /** Call after a practice session is logged. Shows an interstitial every N sessions. */
  notifyPracticeSessionCompleted: () => Promise<void>;
}

const AdsContext = createContext<AdsContextValue | null>(null);

export function AdsProvider({ children }: { children: ReactNode }) {
  const { isPremium, ready } = usePremium();
  const isPremiumRef = useRef(isPremium);
  isPremiumRef.current = isPremium;

  // Initialize AdMob for free users; hide banner immediately if premium.
  useEffect(() => {
    if (!ready) return;
    if (isPremium) {
      void hideBanner();
      return;
    }
    void ensureInitialized().then((ok) => {
      if (ok) void prepareInterstitial();
    });
  }, [isPremium, ready]);

  const value: AdsContextValue = {
    useBannerOnScreen: () => {
      // Hook-like helper; safe to call from any screen component.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      useEffect(() => {
        if (isPremiumRef.current) return;
        void showBanner();
        return () => {
          void hideBanner();
        };
      }, []);
    },
    notifyPracticeSessionCompleted: async () => {
      if (isPremiumRef.current) return;
      const next = readSessionCounter() + 1;
      writeSessionCounter(next);
      if (next % ADMOB_CONFIG.interstitialEveryNSessions === 0) {
        await showInterstitial();
      }
    },
  };

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds() {
  const ctx = useContext(AdsContext);
  if (!ctx) throw new Error("useAds must be used inside <AdsProvider>");
  return ctx;
}

/** Convenience hook: show a banner on this screen while it's mounted (free users only). */
export function useScreenBanner() {
  const { isPremium } = usePremium();
  useEffect(() => {
    if (isPremium) return;
    void showBanner();
    return () => {
      void hideBanner();
    };
  }, [isPremium]);
}
