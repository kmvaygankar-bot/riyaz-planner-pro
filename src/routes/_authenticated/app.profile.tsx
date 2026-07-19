import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getProfile, updateProfile } from "@/lib/practice.functions";
import { NOTE_NAMES } from "@/lib/audio/transport";
import { usePremium } from "@/lib/premium";
import { Crown, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({ meta: [{ title: "Profile — Riyaz" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const get = useServerFn(getProfile);
  const upd = useServerFn(updateProfile);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => get() });

  const [name, setName] = useState("");
  const [tradition, setTradition] = useState<"hindustani" | "carnatic" | "both">("both");
  const [sa, setSa] = useState("C");
  const [voice, setVoice] = useState("");

  useEffect(() => {
    if (data?.profile) {
      setName(data.profile.display_name ?? "");
      setTradition((data.profile.tradition as "hindustani" | "carnatic" | "both") ?? "both");
      setSa(data.profile.default_sa ?? "C");
      setVoice(data.profile.voice_type ?? "");
    }
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      upd({ data: { display_name: name, tradition, default_sa: sa, voice_type: voice || null } }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <AppShell title="Profile">
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Voice type (optional)</Label>
            <Input value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="e.g. Baritone, Alto" />
          </div>
          <div className="space-y-2">
            <Label>Tradition</Label>
            <Select value={tradition} onValueChange={(v) => setTradition(v as typeof tradition)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hindustani">Hindustani</SelectItem>
                <SelectItem value="carnatic">Carnatic</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default Sa</Label>
            <Select value={sa} onValueChange={setSa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NOTE_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-6" onClick={() => mut.mutate()} disabled={mut.isPending}>
          Save changes
        </Button>
      </Card>
    </AppShell>
  );
}
