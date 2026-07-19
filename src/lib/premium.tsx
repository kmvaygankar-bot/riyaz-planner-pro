import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Premium / RevenueCat integration.
 *
 * On native (Android/iOS via Capacitor) this talks to RevenueCat.
 * On web it stays inert — free tier only, no purchases, no crashes.
 * Premium status is cached in localStorage so it survives cold starts,
 * and re-validated from RevenueCat when the app loads.
 */

const STORAGE_KEY = "riyaz:premium:v1";
const RC_ENTITLEMENT_ID = "premium";
// Populate this in Capacitor build. Public SDK key is safe on-device.
const RC_ANDROID_API_KEY =
  (import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined) ?? "";
const RC_IOS_API_KEY =
  (import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined) ?? "";

export const MONTHLY_PRODUCT_ID = "riyaz_premium_monthly";
export const YEARLY_PRODUCT_ID = "riyaz_premium_yearly";

// Types kept structural so we don't hard-couple the web build to RC types.
export interface PremiumPackage {
  identifier: string;
  productId: string;
  priceString: string;
  title: string;
  period: "monthly" | "yearly" | "unknown";
  raw: unknown;
}

interface PremiumContextValue {
  isPremium: boolean;
  isNative: boolean;
  ready: boolean;
  loading: boolean;
  packages: PremiumPackage[];
  refresh: () => Promise<void>;
  purchase: (pkg: PremiumPackage) => Promise<void>;
  restore: () => Promise<void>;
  openManageSubscription: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | null>(null);

function readCache(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
function writeCache(v: boolean) {
  try {
    if (v) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

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

// Lazy dynamic imports so the web bundle never has to resolve native code paths.
async function getPurchases() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod;
}

function periodFromProductId(id: string): PremiumPackage["period"] {
  if (id.includes("year")) return "yearly";
  if (id.includes("month")) return "monthly";
  return "unknown";
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [isNative, setIsNative] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean>(() => readCache());
  const [packages, setPackages] = useState<PremiumPackage[]>([]);

  const applyEntitlement = useCallback((active: boolean) => {
    setIsPremium(active);
    writeCache(active);
  }, []);

  const refresh = useCallback(async () => {
    const cap = await getCapacitor();
    if (!cap?.isNativePlatform()) return;
    try {
      const { Purchases } = await getPurchases();
      const info = await Purchases.getCustomerInfo();
      const ent = info.customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
      applyEntitlement(!!ent);
      try {
        const offerings = await Purchases.getOfferings();
        const current = offerings.current;
        const list: PremiumPackage[] = (current?.availablePackages ?? []).map((p) => ({
          identifier: p.identifier,
          productId: p.product.identifier,
          priceString: p.product.priceString,
          title: p.product.title || p.product.identifier,
          period: periodFromProductId(p.product.identifier),
          raw: p,
        }));
        setPackages(list);
      } catch {
        /* offerings optional */
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[premium] refresh failed", e);
    }
  }, [applyEntitlement]);

  // Init RevenueCat once, on native only.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cap = await getCapacitor();
      const native = !!cap?.isNativePlatform();
      if (cancelled) return;
      setIsNative(native);
      if (!native) {
        setReady(true);
        return;
      }
      try {
        const { Purchases, LOG_LEVEL } = await getPurchases();
        const platform = cap!.getPlatform();
        const apiKey = platform === "ios" ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;
        if (!apiKey) {
          // eslint-disable-next-line no-console
          console.warn("[premium] RevenueCat API key missing — set VITE_REVENUECAT_ANDROID_KEY");
          setReady(true);
          return;
        }
        await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
        const { data: { user } } = await supabase.auth.getUser();
        await Purchases.configure({ apiKey, appUserID: user?.id ?? null });
        await refresh();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[premium] init failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Keep RC user identity in sync with Supabase auth.
  useEffect(() => {
    if (!isNative) return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      try {
        const { Purchases } = await getPurchases();
        if (session?.user?.id) {
          await Purchases.logIn({ appUserID: session.user.id });
        } else {
          await Purchases.logOut();
          applyEntitlement(false);
        }
        await refresh();
      } catch {
        /* ignore */
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [isNative, refresh, applyEntitlement]);

  const purchase = useCallback(async (pkg: PremiumPackage) => {
    if (!isNative) throw new Error("Purchases are only available in the Android app.");
    setLoading(true);
    try {
      const { Purchases } = await getPurchases();
      const res = await Purchases.purchasePackage({
        aPackage: pkg.raw as never,
      });
      const ent = res.customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
      applyEntitlement(!!ent);
    } finally {
      setLoading(false);
    }
  }, [isNative, applyEntitlement]);

  const restore = useCallback(async () => {
    if (!isNative) throw new Error("Restore is only available in the Android app.");
    setLoading(true);
    try {
      const { Purchases } = await getPurchases();
      const info = await Purchases.restorePurchases();
      const ent = info.customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID];
      applyEntitlement(!!ent);
    } finally {
      setLoading(false);
    }
  }, [isNative, applyEntitlement]);

  const openManageSubscription = useCallback(async () => {
    // Both web and Android open the Play Store subscription center;
    // on Android Capacitor's default browser handler routes this to the Play app.
    const url = "https://play.google.com/store/account/subscriptions";
    try {
      window.open(url, "_blank");
    } catch {
      window.location.href = url;
    }
  }, []);

  const value: PremiumContextValue = {
    isPremium,
    isNative,
    ready,
    loading,
    packages,
    refresh,
    purchase,
    restore,
    openManageSubscription,
  };

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used inside <PremiumProvider>");
  return ctx;
}
