import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePremium, MONTHLY_PRODUCT_ID, YEARLY_PRODUCT_ID, type PremiumPackage } from "@/lib/premium";
import { Check, Crown, RefreshCw, ExternalLink, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/premium")({
  head: () => ({ meta: [{ title: "Premium — Riyaz" }] }),
  component: PremiumPage,
});

const BENEFITS = [
  "Unlock all advanced alankars, paltas, meend & raag lessons",
  "Save Studio recordings to your device",
  "Priority access to new lessons & features",
  "Ad-free forever",
  "Support independent classical music tooling",
];

function PremiumPage() {
  const {
    isPremium,
    isNative,
    ready,
    loading,
    packages,
    purchase,
    restore,
    openManageSubscription,
  } = usePremium();
  const [busy, setBusy] = useState<string | null>(null);

  const monthly =
    packages.find((p) => p.period === "monthly") ??
    packages.find((p) => p.productId === MONTHLY_PRODUCT_ID);
  const yearly =
    packages.find((p) => p.period === "yearly") ??
    packages.find((p) => p.productId === YEARLY_PRODUCT_ID);

  async function handleBuy(pkg: PremiumPackage | undefined) {
    if (!pkg) return;
    setBusy(pkg.identifier);
    try {
      await purchase(pkg);
      toast.success("Welcome to Premium");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Purchase failed";
      if (!/cancel/i.test(msg)) toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    setBusy("restore");
    try {
      await restore();
      toast.success("Purchases restored");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nothing to restore");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell title="Premium">
      <Link
        to="/app/profile"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Profile
      </Link>

      <Card className="p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/15 p-2 text-primary">
            <Crown className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {isPremium ? "You're on Riyaz Premium" : "Go Premium"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isPremium
                ? "All premium features are unlocked on this device."
                : "Deepen your riyaz with the full lesson library and Studio downloads."}
            </p>
          </div>
        </div>

        <ul className="mt-6 space-y-2">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </Card>

      {!isPremium && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <PlanCard
            title="Monthly"
            price={monthly?.priceString ?? "—"}
            note="Cancel anytime"
            highlight={false}
            disabled={!isNative || !monthly || !ready || loading || busy !== null}
            busy={busy === monthly?.identifier}
            onBuy={() => handleBuy(monthly)}
          />
          <PlanCard
            title="Yearly"
            price={yearly?.priceString ?? "—"}
            note="Best value"
            highlight
            disabled={!isNative || !yearly || !ready || loading || busy !== null}
            busy={busy === yearly?.identifier}
            onBuy={() => handleBuy(yearly)}
          />
        </div>
      )}

      {!isNative && (
        <Card className="mt-4 border-dashed p-4 text-sm text-muted-foreground">
          Subscriptions are billed through Google Play and are available in the Riyaz Android app.
          Install Riyaz from the Play Store to upgrade.
        </Card>
      )}

      <Card className="mt-4 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Manage
        </h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={handleRestore}
            disabled={!isNative || loading || busy !== null}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Restore purchases
          </Button>
          <Button variant="outline" onClick={openManageSubscription}>
            <ExternalLink className="mr-2 h-4 w-4" /> Manage subscription
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Subscriptions renew automatically until cancelled. Manage or cancel anytime from
          your Google Play account.
        </p>
      </Card>
    </AppShell>
  );
}

function PlanCard({
  title,
  price,
  note,
  highlight,
  disabled,
  busy,
  onBuy,
}: {
  title: string;
  price: string;
  note: string;
  highlight: boolean;
  disabled: boolean;
  busy: boolean;
  onBuy: () => void;
}) {
  return (
    <Card className={`p-6 ${highlight ? "border-primary/60" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {highlight && <Badge>Popular</Badge>}
      </div>
      <div className="mono-num mt-3 text-3xl font-semibold">{price}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      <Button className="mt-5 w-full" onClick={onBuy} disabled={disabled}>
        {busy ? "Processing…" : `Upgrade — ${title}`}
      </Button>
    </Card>
  );
}
