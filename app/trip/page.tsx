import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { DestinationCard } from "@/components/destination-card";

// Theme colors array for variety
const themeColors = [
  "200 80% 40%", // Blue
  "150 60% 35%", // Green
  "30 90% 50%",  // Orange
  "280 70% 45%", // Purple
  "0 80% 50%",   // Red
  "210 70% 45%", // Cyan
  "340 75% 50%", // Pink
  "45 90% 55%",  // Yellow
];

// Helper function to get theme color based on trip id
function getThemeColor(tripId: string): string {
  // Use hash of id to consistently assign colors
  let hash = 0;
  for (let i = 0; i < tripId.length; i++) {
    hash = tripId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return themeColors[Math.abs(hash) % themeColors.length];
}

export default async function TripsIndexPage() {
  const supabase = await createClient();
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id,title,slug,public_slug,start_date,end_date,price_cents,gallery_urls,location")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="container mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold mb-2">Błąd wczytywania</h1>
        <p className="text-muted-foreground">Spróbuj ponownie później.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">Wycieczki</h1>
      {(!trips || trips.length === 0) ? (
        <Card className="p-5">
          <p className="text-muted-foreground">Brak aktywnych wycieczek. Dodaj rekord w tabeli <code>trips</code>.</p>
        </Card>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((t) => {
            const price = t.price_cents ? (t.price_cents / 100).toFixed(2) : "-";
            const dateRange = t.start_date && t.end_date
              ? `${new Date(t.start_date).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })} — ${new Date(t.end_date).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}`
              : t.start_date
                ? new Date(t.start_date).toLocaleDateString("pl-PL")
                : "";
            
            const stats = `${dateRange}${dateRange && price !== "-" ? " • " : ""}${price !== "-" ? `${price} PLN` : ""}`;
            
            // Get first image from gallery_urls or use placeholder
            const galleryUrls = Array.isArray(t.gallery_urls) ? t.gallery_urls : [];
            const imageUrl = galleryUrls.length > 0 && galleryUrls[0] 
              ? galleryUrls[0] 
              : "https://images.unsplash.com/photo-1469853083085-37ca0889b6d0?w=800&h=600&fit=crop";
            
            // Use location if available, otherwise use title
            const location = t.location || t.title;
            
            // Simple flag emoji (can be enhanced later)
            const flag = "✈️";
            
            return (
              <DestinationCard
                key={t.id}
                imageUrl={imageUrl}
                location={location}
                flag={flag}
                stats={stats}
                href={`/trip/${t.slug}`}
                themeColor={getThemeColor(t.id)}
                className="h-[400px]"
              />
            );
          })}
        </div>
      )}
    </div>
  );
}


