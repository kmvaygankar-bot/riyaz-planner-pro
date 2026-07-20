# Riyaz — Android Release Guide

## AdMob (Google AdMob)

All AdMob IDs live in **`src/lib/ads.tsx`** under the `ADMOB_CONFIG` constant — change them there and rebuild.

Current IDs:

- App ID: `ca-app-pub-5229984747218768~1557456372`
- Banner Ad Unit: `ca-app-pub-5229984747218768/6538320315`
- Interstitial Ad Unit: `ca-app-pub-5229984747218768/7608427624`

Behaviour:

- Banner shows at the bottom of **Today, Lessons, Tanpura, Tala** (free users only).
- Interstitial fires after **every 3 completed practice sessions** (quick log, Studio save, or lesson complete).
- Premium users (`isPremium === true`) never see either.
- On the web build everything is inert — no ads, no crashes.

**Required Android manifest entry** (add once, after `bunx cap add android`):

Open `android/app/src/main/AndroidManifest.xml` and inside `<application>` add:

```xml
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-5229984747218768~1557456372"/>
```

Without this, the app will crash on launch. The plugin `@capacitor-community/admob` is already installed and picked up by `bunx cap sync android`.



Riyaz is a TanStack Start web app wrapped with **Capacitor** for Android and monetised with **RevenueCat + Google Play Billing**. This guide covers everything from a first Android Studio build to a signed AAB on the Play Store.

---

## 1. Prerequisites

- Node 20+ and Bun (already used by this repo)
- **Android Studio** (Hedgehog or newer) with the Android SDK + Platform Tools
- Java 17 (bundled with recent Android Studio)
- A **Google Play Console** developer account ($25 one-off)
- A **RevenueCat** account (free tier is fine)

---

## 2. Project structure

```
capacitor.config.ts      ← Capacitor config (appId, webDir, etc.)
android/                 ← generated native project (created by `cap add android`)
dist/client/             ← web build output that Capacitor bundles into the APK
src/lib/premium.tsx      ← RevenueCat integration (no-ops on web)
src/routes/_authenticated/app.premium.tsx  ← Premium page
```

The web build (`vite build`) outputs to `dist/client`. `capacitor.config.ts` points `webDir` at that path.

---

## 3. First-time Android setup

Run these on a machine with Android Studio installed (the Lovable sandbox cannot do native builds — treat this as your local checkout after `git clone`):

```bash
# 1. Install deps
bun install

# 2. Build the web app
bun run build

# 3. Add the Android platform (only the first time)
bunx cap add android

# 4. Copy web assets and sync native plugins
bunx cap sync android

# 5. Open in Android Studio
bunx cap open android
```

After the first `cap add android`, commit the generated `android/` folder to your repo so subsequent CI builds don't need to regenerate it.

Whenever you change web code, re-run:

```bash
bun run build && bunx cap sync android
```

### App identity

- `appId`: `app.lovable.riyaz` (edit in `capacitor.config.ts` and in `android/app/build.gradle` if you change it)
- `appName`: `Riyaz`
- Icons & splash: replace files in `android/app/src/main/res/` (use Android Studio's *Image Asset Studio* for a full icon set).

---

## 4. RevenueCat setup

RevenueCat is the recommended path — it handles receipt validation, restores, and cross-device entitlements out of the box.

### 4a. In the RevenueCat dashboard

1. Create a new **project** called `Riyaz`.
2. Add an **Android app** with package name `app.lovable.riyaz`.
3. Under *API keys* copy the **Google Play public SDK key** (starts with `goog_`).
4. Create an **entitlement** with identifier exactly `premium` — this is the string the app checks.
5. Create two **products** in Google Play Console (see next section), then link them in RevenueCat under *Products*:
   - `riyaz_premium_monthly`
   - `riyaz_premium_yearly`
6. Create an **offering** named `default`, add both products as packages, and mark it *Current*.
7. Attach both products to the `premium` entitlement.

### 4b. In Google Play Console

1. Create the app (internal draft is enough to start).
2. In *Monetize → Subscriptions*, create two subscriptions with these **exact product IDs**:
   - `riyaz_premium_monthly` — 1 month base plan
   - `riyaz_premium_yearly` — 1 year base plan
3. Set localized pricing, activate both, and add them to the app's active subscriptions.
4. In *Monetize → Setup → Licensing*, copy the **Google Play service account** credentials JSON into RevenueCat (*Project settings → Apps → your Android app → Service Credentials*). This is what lets RevenueCat validate receipts server-side.

### 4c. Wire the API key into the app

The RevenueCat Android key is read from a Vite env var at build time. Add it to your local `.env` (or CI secrets) **before** running `bun run build`:

```
VITE_REVENUECAT_ANDROID_KEY=goog_XXXXXXXXXXXXXXXXXX
```

The web build must be redone after this changes:

```bash
bun run build && bunx cap sync android
```

### 4d. Testing purchases

1. In Play Console → *Setup → License testing*, add your Google account as a license tester.
2. Upload a signed AAB to the **Internal testing** track and add yourself as a tester.
3. Install via the testing opt-in link. Purchases will complete with a test card and no real money moves.
4. Verify in the app: open **Profile → Premium → Upgrade**, complete the purchase, confirm advanced lessons and the Studio download unlock. Uninstall/reinstall, tap **Restore purchases** — premium should come back.

---

## 5. Building an APK / AAB

### Debug APK (for local testing on a device)

```bash
bun run build
bunx cap sync android
cd android
./gradlew assembleDebug
# APK lands in android/app/build/outputs/apk/debug/app-debug.apk
```

### Release AAB (for the Play Store)

1. Generate an upload keystore (once):

   ```bash
   keytool -genkey -v -keystore riyaz-upload.keystore \
     -alias riyaz -keyalg RSA -keysize 2048 -validity 10000
   ```

   Store the file **outside** the repo and back it up — losing it means losing your ability to update the app.

2. Add credentials to `android/gradle.properties` (do not commit):

   ```
   RIYAZ_STORE_FILE=/absolute/path/riyaz-upload.keystore
   RIYAZ_STORE_PASSWORD=...
   RIYAZ_KEY_ALIAS=riyaz
   RIYAZ_KEY_PASSWORD=...
   ```

3. In `android/app/build.gradle`, add a `signingConfigs.release` block that reads those properties, then reference it from `buildTypes.release`. Android Studio's *Build → Generate Signed Bundle* wizard will do this for you the first time.

4. Build the bundle:

   ```bash
   cd android
   ./gradlew bundleRelease
   # AAB lands in android/app/build/outputs/bundle/release/app-release.aab
   ```

---

## 6. Publishing to Google Play

1. In Play Console, create a release under **Testing → Internal testing** and upload the AAB.
2. Fill in the *Store listing* — title, short/long description, screenshots (phone + 7" tablet minimum), feature graphic, privacy policy URL.
3. Complete **App content**: data safety, ads declaration (Riyaz has no ads), content rating, target audience.
4. Once internal testing is stable, promote the release to **Closed → Open → Production** tracks.
5. Every subsequent release: bump `versionCode` and `versionName` in `android/app/build.gradle`, rebuild the AAB, and upload as a new release.

---

## 7. Known constraints

- **Microphone permission**: Capacitor auto-generates the Android manifest with `RECORD_AUDIO` because the app uses `getUserMedia`. Verify it appears in `android/app/src/main/AndroidManifest.xml` before your first Play upload.
- **Deep links**: Not configured. Add an `<intent-filter>` in `AndroidManifest.xml` if you need share/return URLs.
- **Web build parity**: Everything on the web still works; RevenueCat code is dynamically imported and no-ops when `Capacitor.isNativePlatform()` is `false`, so the deployed web app never tries to talk to native billing APIs.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `Purchases.configure` warns "API key missing" | `VITE_REVENUECAT_ANDROID_KEY` wasn't set at build time. Re-run `bun run build && bunx cap sync android`. |
| Products don't appear on the Premium page | The Play Console subscription isn't **active**, or isn't linked to the RC `default` offering, or the app was installed outside the tester track. |
| Restore does nothing after reinstall | Sign in to the same Google account used for the original purchase; RC keys entitlements to the Play account. |
| Purchases work but premium locks reappear next launch | The `premium` entitlement identifier in RevenueCat doesn't match `premium` in `src/lib/premium.tsx`. They must match exactly. |
