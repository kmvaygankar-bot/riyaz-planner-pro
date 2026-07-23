/**
 * Safe initialization wrappers for AdMob, RevenueCat, and Supabase
 * Each function wraps startup logic in try/catch to prevent app crashes
 */

/**
 * Safely initialize Supabase
 * Returns true if successful, false if there was an error
 */
export async function initializeSupabase(): Promise<{ success: boolean; error?: Error }> {
  try {
    // The Supabase client is lazy-loaded via proxy in src/integrations/supabase/client.ts
    // This just ensures it's properly initialized
    const { supabase } = await import("@/integrations/supabase/client");
    // Touch the client to ensure it initializes
    await supabase.auth.getSession();
    console.log("[startup] Supabase initialized successfully");
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[startup] Supabase initialization failed:", err);
    return { success: false, error: err };
  }
}

/**
 * Safely initialize AdMob
 * This is a no-op on web, but on native it initializes the AdMob service
 */
export async function initializeAdMob(): Promise<{ success: boolean; error?: Error }> {
  try {
    // Check if we're on native platform
    let isNative = false;
    try {
      const { Capacitor } = await import("@capacitor/core");
      isNative = Capacitor.isNativePlatform();
    } catch {
      isNative = false;
    }

    if (!isNative) {
      console.log("[startup] AdMob skipped (web platform)");
      return { success: true };
    }

    // Try to initialize AdMob
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.initialize({ initializeForTesting: false });
    console.log("[startup] AdMob initialized successfully");
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn("[startup] AdMob initialization failed (non-critical):", err);
    // Don't fail the app if AdMob fails - it's not critical
    return { success: false, error: err };
  }
}

/**
 * Safely initialize RevenueCat
 * This is a no-op on web, but on native it initializes the RevenueCat SDK
 */
export async function initializeRevenueCat(): Promise<{ success: boolean; error?: Error }> {
  try {
    // Check if we're on native platform
    let isNative = false;
    try {
      const { Capacitor } = await import("@capacitor/core");
      isNative = Capacitor.isNativePlatform();
    } catch {
      isNative = false;
    }

    if (!isNative) {
      console.log("[startup] RevenueCat skipped (web platform)");
      return { success: true };
    }

    // Get API key from environment
    const apiKey =
      (import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined) ?? "";

    if (!apiKey) {
      console.warn("[startup] RevenueCat API key not configured");
      return { success: false, error: new Error("RevenueCat API key not configured") };
    }

    // RevenueCat initialization is handled by the PremiumProvider
    // This just validates the setup
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    await Purchases.configure({
      apiKey,
    });
    console.log("[startup] RevenueCat initialized successfully");
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.warn("[startup] RevenueCat initialization failed (non-critical):", err);
    // Don't fail the app if RevenueCat fails - it's not critical
    return { success: false, error: err };
  }
}

/**
 * Run all startup initializations safely
 * Returns results for each service; partial failures don't crash the app
 */
export async function initializeAllServices(): Promise<{
  supabase: { success: boolean; error?: Error };
  admob: { success: boolean; error?: Error };
  revenuecat: { success: boolean; error?: Error };
  hasSuccessfulInit: boolean;
  hasAnyError: boolean;
}> {
  console.log("[startup] Starting service initialization...");

  const results: {
    supabase: { success: boolean; error?: Error };
    admob: { success: boolean; error?: Error };
    revenuecat: { success: boolean; error?: Error };
  } = {
    supabase: { success: false },
    admob: { success: false },
    revenuecat: { success: false },
  };

  try {
    // Initialize Supabase first (critical - can throw)
    results.supabase = await initializeSupabase();

    // Initialize optional services in parallel
    const [admobResult, revenuecatResult] = await Promise.all([
      initializeAdMob(),
      initializeRevenueCat(),
    ]);

    results.admob = admobResult;
    results.revenuecat = revenuecatResult;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[startup] Unexpected error during initialization:", err);
    // If something goes really wrong, ensure Supabase at least tried
    if (!results.supabase.success) {
      results.supabase.error = err;
    }
  }

  const hasSuccessfulInit =
    results.supabase.success || results.admob.success || results.revenuecat.success;
  const hasAnyError =
    !!results.supabase.error || !!results.admob.error || !!results.revenuecat.error;

  console.log("[startup] Service initialization complete:", {
    supabase: results.supabase.success,
    admob: results.admob.success,
    revenuecat: results.revenuecat.success,
    hasSuccessfulInit,
    hasAnyError,
  });

  return {
    ...results,
    hasSuccessfulInit,
    hasAnyError,
  };
}
