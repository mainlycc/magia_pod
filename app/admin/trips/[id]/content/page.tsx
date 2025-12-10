"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TripContentEditor } from "@/components/trip-content-editor";
import { toast } from "sonner";
import { ArrowLeft, Upload, X, Loader2, Edit2, Link as LinkIcon, Camera, Calendar, MapPin, Clock, Users, CheckCircle, Sparkles, Briefcase, Thermometer, Plane, Hotel, Utensils, Shield, AlertCircle, Headphones } from "lucide-react";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

function calculateDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "Termin do ustalenia";
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startDay = start.getDate().toString().padStart(2, "0");
  const startMonth = (start.getMonth() + 1).toString().padStart(2, "0");
  const endDay = end.getDate().toString().padStart(2, "0");
  const endMonth = (end.getMonth() + 1).toString().padStart(2, "0");
  const year = start.getFullYear();
  
  return `${startDay}-${endDay}.${startMonth}.${year}`;
}

export default function TripContentPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingFromUrl, setAddingFromUrl] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [programAtrakcje, setProgramAtrakcje] = useState("");
  const [dodatkoweSwiadczenia, setDodatkoweSwiadczenia] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [tripTitle, setTripTitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [sectionPoznajTitle, setSectionPoznajTitle] = useState("");
  const [sectionPoznajDescription, setSectionPoznajDescription] = useState("");
  const [reservationInfoText, setReservationInfoText] = useState("");
  
  // Additional trip data for display
  const [tripData, setTripData] = useState<{
    start_date: string | null;
    end_date: string | null;
    price_cents: number | null;
    seats_total: number | null;
    seats_reserved: number | null;
    is_active: boolean | null;
    location: string | null;
    description: string | null;
  } | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const loadContent = async () => {
      try {
        setLoading(true);
        const [contentRes, tripRes] = await Promise.all([
          fetch(`/api/trips/${id}/content`),
          fetch(`/api/trips/${id}`),
        ]);

        if (contentRes.ok) {
          const content = await contentRes.json();
          setProgramAtrakcje(content.program_atrakcje || "");
          setDodatkoweSwiadczenia(content.dodatkowe_swiadczenia || "");
          setGalleryUrls(content.gallery_urls || []);
          setIntroText(content.intro_text || "");
          setSectionPoznajTitle(content.section_poznaj_title || "");
          setSectionPoznajDescription(content.section_poznaj_description || "");
          setReservationInfoText(content.reservation_info_text || "");
        }

        if (tripRes.ok) {
          const trip = await tripRes.json();
          setTripTitle(trip.title || "");
          setTripData({
            start_date: trip.start_date || null,
            end_date: trip.end_date || null,
            price_cents: trip.price_cents || null,
            seats_total: trip.seats_total || null,
            seats_reserved: trip.seats_reserved || null,
            is_active: trip.is_active ?? null,
            location: trip.location || null,
            description: trip.description || null,
          });
        }
      } catch (err) {
        toast.error("Nie udało się wczytać treści");
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/trips/${id}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_atrakcje: programAtrakcje,
          dodatkowe_swiadczenia: dodatkoweSwiadczenia,
          gallery_urls: galleryUrls,
          intro_text: introText,
          section_poznaj_title: sectionPoznajTitle,
          section_poznaj_description: sectionPoznajDescription,
          reservation_info_text: reservationInfoText,
        }),
      });

      if (res.ok) {
        toast.success("Treść została zapisana");
      } else {
        toast.error("Nie udało się zapisać treści");
      }
    } catch (err) {
      toast.error("Nie udało się zapisać treści");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/trips/${id}/gallery`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setGalleryUrls([...galleryUrls, data.url]);
        toast.success("Zdjęcie zostało dodane");
      } else {
        toast.error("Nie udało się dodać zdjęcia");
      }
    } catch (err) {
      toast.error("Nie udało się dodać zdjęcia");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleImageDelete = async (url: string) => {
    if (!id) return;

    try {
      const res = await fetch(`/api/trips/${id}/gallery?url=${encodeURIComponent(url)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setGalleryUrls(galleryUrls.filter((u) => u !== url));
        toast.success("Zdjęcie zostało usunięte");
      } else {
        toast.error("Nie udało się usunąć zdjęcia");
      }
    } catch (err) {
      toast.error("Nie udało się usunąć zdjęcia");
    }
  };

  const validateImageUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: "HEAD" });
      const contentType = response.headers.get("content-type");
      return contentType?.startsWith("image/") ?? false;
    } catch {
      return false;
    }
  };

  const handleAddImageFromUrl = async () => {
    if (!imageUrl.trim() || !id) return;

    try {
      setAddingFromUrl(true);

      // Walidacja URL
      try {
        new URL(imageUrl);
      } catch {
        toast.error("Nieprawidłowy adres URL");
        return;
      }

      // Sprawdź czy to obraz
      const isValidImage = await validateImageUrl(imageUrl);
      if (!isValidImage) {
        toast.error("Podany URL nie wskazuje na obraz");
        return;
      }

      // Sprawdź czy URL już istnieje w galerii
      if (galleryUrls.includes(imageUrl)) {
        toast.error("To zdjęcie już jest w galerii");
        return;
      }

      // Dodaj URL do galerii
      const updatedUrls = [...galleryUrls, imageUrl];
      
      // Zapisz do bazy
      const res = await fetch(`/api/trips/${id}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gallery_urls: updatedUrls,
        }),
      });

      if (res.ok) {
        setGalleryUrls(updatedUrls);
        setImageUrl("");
        toast.success("Zdjęcie zostało dodane z linku");
      } else {
        toast.error("Nie udało się dodać zdjęcia");
      }
    } catch (err) {
      toast.error("Nie udało się dodać zdjęcia");
    } finally {
      setAddingFromUrl(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mainImage = galleryUrls[0] || "/placeholder.svg";
  const galleryImages = galleryUrls.slice(1, 5);
  const days = tripData ? calculateDays(tripData.start_date, tripData.end_date) : 0;
  const nights = Math.max(0, days - 1);
  const dateRange = tripData ? formatDateRange(tripData.start_date, tripData.end_date) : "Termin do ustalenia";
  const price = tripData?.price_cents ? (tripData.price_cents / 100).toFixed(2) : "0";
  const seatsLeft = tripData ? Math.max(0, (tripData.seats_total ?? 0) - (tripData.seats_reserved ?? 0)) : 0;

  return (
    <main className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <ol className="flex items-center gap-2 text-xs text-muted-foreground">
            <li>
              <Link href="/admin" className="hover:text-foreground transition-colors">
                Panel administracyjny
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/admin/trips" className="hover:text-foreground transition-colors">
                Wycieczki
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground font-medium">Edycja treści</li>
          </ol>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 xl:items-stretch">
          {/* Left Column - Bento Gallery + Intro + Highlights */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              {/* Main hero image - spans 2 columns */}
              <div className="col-span-2 relative rounded-xl overflow-hidden group h-[140px] border-2 border-dashed border-muted-foreground/20">
                {mainImage && mainImage !== "/placeholder.svg" ? (
                  <>
                    <Image
                      src={mainImage}
                      alt={tripTitle}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1280px) 100vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-2 left-2 right-2">
                      <Badge className={`${tripData?.is_active ? "bg-green-500" : "bg-gray-500"} text-white text-[10px] mb-1`}>
                        {tripData?.is_active ? "Aktywna" : "W przygotowaniu"}
                      </Badge>
                      <h1 className="font-sans text-lg font-bold text-white leading-tight">{tripTitle}</h1>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleImageDelete(mainImage)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">Główne zdjęcie</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4 gallery images in 2x2 grid */}
              {Array.from({ length: 4 }).map((_, index) => {
                const url = galleryImages[index];
                return (
                  <div
                    key={index}
                    className="relative rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/20 h-[80px] group"
                  >
                    {url ? (
                      <>
                        <Image
                          src={url}
                          alt={`Zdjęcie ${index + 2}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 1280px) 50vw, 16vw"
                        />
                        <div className="absolute top-1 right-1">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => url && handleImageDelete(url)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Camera className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Gallery upload controls */}
            <div className="space-y-2 p-3 border rounded-lg bg-card">
              <Label className="text-xs font-semibold">Zarządzanie galerią</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddImageFromUrl();
                      }
                    }}
                    className="flex-1 text-xs"
                    disabled={addingFromUrl}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddImageFromUrl}
                    disabled={addingFromUrl || !imageUrl.trim()}
                  >
                    <LinkIcon className="h-3 w-3" />
                  </Button>
                </div>
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" className="w-full" asChild disabled={uploading}>
                    <span>
                      <Upload className="h-3 w-3 mr-2" />
                      {uploading ? "Dodawanie..." : "Dodaj z pliku"}
                    </span>
                  </Button>
                </Label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </div>
            </div>

            {/* Intro text editor */}
            <div className="space-y-2">
              <Label htmlFor="intro-text" className="text-xs font-semibold">
                Opis pod tytułem
              </Label>
              <Textarea
                id="intro-text"
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                placeholder="Odkryj wyjątkową podróż przygotowaną przez Magię Podróżowania..."
                className="min-h-[80px] text-sm"
              />
            </div>

            {/* Highlights section - editable */}
            <div className="bg-primary/5 rounded-xl p-3 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-sans text-sm font-semibold text-foreground">Atrakcje wycieczki</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                (Wygenerowane automatycznie z programu)
              </p>
            </div>
          </div>

          {/* Middle Column - Info + Program + Details */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            {/* Quick Info Bar */}
            <div className="flex flex-wrap gap-3 text-sm">
              {tripData?.start_date && tripData?.end_date && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>{dateRange}</span>
                </div>
              )}
              {days > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-4 h-4 text-primary" />
                  <span>{days} dni / {nights} nocy</span>
                </div>
              )}
              {tripData?.location && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{tripData.location}</span>
                </div>
              )}
            </div>

            {/* Program and attractions editor */}
            <div className="bg-card rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Hotel className="w-4 h-4 text-primary" />
                <h3 className="font-sans text-sm font-semibold text-foreground">Program i atrakcje</h3>
              </div>
              <TripContentEditor
                content={programAtrakcje}
                onChange={setProgramAtrakcje}
                label="Program i atrakcje"
              />
            </div>

            {/* Additional Services */}
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground mb-2">Dodatkowe świadczenia</h2>
              <TripContentEditor
                content={dodatkoweSwiadczenia}
                onChange={setDodatkoweSwiadczenia}
                label="Dodatkowe świadczenia"
              />
            </div>
          </div>

          {/* Right Column - Booking Card */}
          <div className="xl:col-span-3 flex flex-col">
            <Card className="border-border shadow-lg overflow-hidden flex-1 flex flex-col">
              <div className="bg-primary text-primary-foreground p-3">
                <div className="text-xs uppercase tracking-wide opacity-80 mb-0.5">Cena za osobę</div>
                <div className="text-2xl font-bold font-sans">
                  {parseFloat(price).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal">PLN</span>
                </div>
              </div>

              <CardContent className="p-3 flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                    <Users className="w-4 h-4" />
                    <span>Pozostało miejsc</span>
                  </div>
                  <Badge variant="secondary" className="font-semibold text-sm">
                    {seatsLeft}
                  </Badge>
                </div>

                <Separator />

                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground mb-1.5">W cenie:</div>
                  <ul className="space-y-1">
                    {[
                      "Przelot w obie strony",
                      `${nights} noclegów hotel`,
                      "Wyżywienie zgodnie z programem",
                      "Opieka pilota",
                      "Ubezpieczenie KL i NNW",
                      "Transfery lotnisko-hotel",
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto space-y-2">
                  <div className="space-y-2">
                    <Label htmlFor="reservation-info" className="text-xs font-semibold">
                      Tekst informacyjny o rezerwacji
                    </Label>
                    <Textarea
                      id="reservation-info"
                      value={reservationInfoText}
                      onChange={(e) => setReservationInfoText(e.target.value)}
                      placeholder="Do rezerwacji potrzebne będą dane kontaktowe..."
                      className="min-h-[80px] text-xs"
                    />
                  </div>

                  <div className="bg-secondary/50 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Headphones className="w-4 h-4 text-primary" />
                      </div>
                      <div className="text-sm">
                        <div className="font-medium text-foreground">Masz pytania?</div>
                        <div className="text-muted-foreground">Skontaktuj się z nami</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Save buttons */}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Zapisywanie...
              </>
            ) : (
              "Zapisz zmiany"
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
