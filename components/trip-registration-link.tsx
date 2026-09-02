"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrip } from "@/contexts/trip-context";
import { buildTripClientUrl } from "@/lib/trips/registration-access";
import { resolvePublicBaseUrl } from "@/lib/url/resolve-public-base-url";
import { toast } from "sonner";

export function TripRegistrationLink() {
  const { selectedTrip, tripFullData } = useTrip();
  const [copied, setCopied] = useState(false);

  const clientUrl = useMemo(() => {
    if (!selectedTrip?.slug || !tripFullData?.registration_token) {
      return null;
    }
    const baseUrl =
      typeof window !== "undefined" ? window.location.origin : resolvePublicBaseUrl();
    return buildTripClientUrl(
      selectedTrip.slug,
      tripFullData.registration_token,
      undefined,
      baseUrl,
    );
  }, [selectedTrip?.slug, tripFullData?.registration_token]);

  if (!selectedTrip || !clientUrl) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(clientUrl);
      setCopied(true);
      toast.success("Link skopiowany do schowka");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nie udało się skopiować linku");
    }
  };

  return (
    <Button
      type="button"
      variant="default"
      size="default"
      className="inline-flex items-center gap-2"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      Kopiuj link dla klienta
    </Button>
  );
}
