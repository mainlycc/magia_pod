"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type InsuranceConfig = {
  id?: string;
  environment: "test" | "production";
  api_key: string | null;
  api_secret: string | null;
  api_url: string | null;
  policy_parameters: any;
  is_active: boolean;
};

export default function InsuranceConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const [config, setConfig] = useState<InsuranceConfig>({
    environment: "test",
    api_key: null,
    api_secret: null,
    api_url: null,
    policy_parameters: {},
    is_active: true,
  });

  useEffect(() => {
    loadConfig();
  }, [environment]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/insurance/config?environment=${environment}`);
      if (res.ok) {
        const data = await res.json();
        setConfig({
          ...data,
          policy_parameters: typeof data.policy_parameters === "string"
            ? data.policy_parameters
            : JSON.stringify(data.policy_parameters || {}, null, 2),
        });
      } else if (res.status === 404) {
        // Brak konfiguracji - wyświetl pusty formularz
        setConfig({
          environment,
          api_key: null,
          api_secret: null,
          api_url: null,
          policy_parameters: "{}",
          is_active: true,
        });
      } else {
        toast.error("Nie udało się wczytać konfiguracji");
      }
    } catch (err) {
      toast.error("Błąd podczas ładowania konfiguracji");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Waliduj JSON policy_parameters
      let parsedPolicyParams;
      try {
        parsedPolicyParams = JSON.parse(config.policy_parameters || "{}");
      } catch (err) {
        toast.error("Nieprawidłowy format JSON w parametrach polis");
        return;
      }

      const payload = {
        environment,
        api_key: config.api_key || null,
        api_secret: config.api_secret || null,
        api_url: config.api_url || null,
        policy_parameters: parsedPolicyParams,
        is_active: config.is_active,
      };

      const res = await fetch("/api/insurance/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success("Konfiguracja została zapisana");
        await loadConfig();
      } else {
        const error = await res.json();
        toast.error(`Nie udało się zapisać konfiguracji: ${error.error || "Nieznany błąd"}`);
      }
    } catch (err) {
      toast.error("Błąd podczas zapisywania konfiguracji");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>Ładowanie...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => router.back()}>
          Wstecz
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="environment">Środowisko</Label>
          <Select
            value={environment}
            onValueChange={(value: "test" | "production") => setEnvironment(value)}
          >
            <SelectTrigger id="environment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Testowe</SelectItem>
              <SelectItem value="production">Produkcyjne</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_url">URL API</Label>
          <Input
            id="api_url"
            type="text"
            placeholder="https://api.hdi.example.com"
            value={config.api_url || ""}
            onChange={(e) => setConfig({ ...config, api_url: e.target.value || null })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_key">Klucz API</Label>
          <Input
            id="api_key"
            type="password"
            placeholder="Wprowadź klucz API"
            value={config.api_key || ""}
            onChange={(e) => setConfig({ ...config, api_key: e.target.value || null })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api_secret">Sekret API</Label>
          <Input
            id="api_secret"
            type="password"
            placeholder="Wprowadź sekret API"
            value={config.api_secret || ""}
            onChange={(e) => setConfig({ ...config, api_secret: e.target.value || null })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="policy_parameters">Parametry polis (JSON)</Label>
          <Textarea
            id="policy_parameters"
            placeholder='{"param1": "value1", "param2": "value2"}'
            rows={10}
            value={typeof config.policy_parameters === "string" ? config.policy_parameters : JSON.stringify(config.policy_parameters || {}, null, 2)}
            onChange={(e) => setConfig({ ...config, policy_parameters: e.target.value })}
            className="font-mono text-sm"
          />
          <p className="text-sm text-muted-foreground">
            Wprowadź parametry polis w formacie JSON
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie..." : "Zapisz konfigurację"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

