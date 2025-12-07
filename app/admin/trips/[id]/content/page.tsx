"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TripContentEditor } from "@/components/trip-content-editor";
import { toast } from "sonner";
import { ArrowLeft, Upload, X, Loader2, Edit2 } from "lucide-react";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function TripContentPage() {
  const router = useRouter();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [programAtrakcje, setProgramAtrakcje] = useState("");
  const [dodatkoweSwiadczenia, setDodatkoweSwiadczenia] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [tripTitle, setTripTitle] = useState("");
  const [introText, setIntroText] = useState("");
  const [sectionPoznajTitle, setSectionPoznajTitle] = useState("");
  const [sectionPoznajDescription, setSectionPoznajDescription] = useState("");
  const [reservationInfoText, setReservationInfoText] = useState("");

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

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Wróć
        </Button>
        <div>
          <p className="text-sm text-muted-foreground">{tripTitle}</p>
        </div>
      </div>

      {/* Układ podobny do strony publicznej */}
      <div className="space-y-8 border rounded-lg p-6 bg-background">
        {/* Sekcja nagłówkowa */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default">Aktywna</Badge>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tytuł wycieczki (edytuj w podstawowych danych)</Label>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight">{tripTitle}</h1>
            </div>
            <div className="space-y-2">
              <Label htmlFor="intro-text" className="text-xs text-muted-foreground">
                Opis pod tytułem
              </Label>
              <Textarea
                id="intro-text"
                value={introText}
                onChange={(e) => setIntroText(e.target.value)}
                placeholder="Odkryj wyjątkową podróż przygotowaną przez Magię Podróżowania. Poniżej znajdziesz szczegółowy opis, informacje o dostępnych miejscach oraz możliwość rezerwacji."
                className="min-h-[80px]"
              />
            </div>
          </div>

          <Card className="w-full max-w-sm self-stretch md:self-auto">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg font-medium">Informacje o rezerwacji</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reservation-info" className="text-xs text-muted-foreground">
                  Tekst informacyjny o rezerwacji
                </Label>
                <Textarea
                  id="reservation-info"
                  value={reservationInfoText}
                  onChange={(e) => setReservationInfoText(e.target.value)}
                  placeholder="Do rezerwacji potrzebne będą dane kontaktowe oraz lista uczestników. Po złożeniu rezerwacji otrzymasz e-mail z potwierdzeniem i wzorem umowy."
                  className="min-h-[100px] text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Galeria */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Galeria</h2>
            <Label htmlFor="image-upload" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild disabled={uploading}>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Dodawanie..." : "Dodaj zdjęcie"}
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
          {galleryUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {galleryUrls.map((url, index) => (
                <div
                  key={url ?? index}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-muted"
                >
                  <Image
                    src={url}
                    alt={`Zdjęcie ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <button
                    onClick={() => handleImageDelete(url)}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Usuń zdjęcie"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Brak zdjęć w galerii</p>
          )}
        </section>

        {/* Sekcja "Poznaj wycieczkę" */}
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Tabs defaultValue="overview" className="w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Label htmlFor="section-poznaj-title" className="text-xs text-muted-foreground">
                  Nagłówek sekcji
                </Label>
                <Input
                  id="section-poznaj-title"
                  value={sectionPoznajTitle}
                  onChange={(e) => setSectionPoznajTitle(e.target.value)}
                  placeholder="Poznaj wycieczkę"
                  className="text-xl font-semibold"
                />
                <Label htmlFor="section-poznaj-description" className="text-xs text-muted-foreground">
                  Opis sekcji
                </Label>
                <Input
                  id="section-poznaj-description"
                  value={sectionPoznajDescription}
                  onChange={(e) => setSectionPoznajDescription(e.target.value)}
                  placeholder="Szczegóły programu, świadczenia oraz ważne informacje organizacyjne."
                  className="text-sm text-muted-foreground"
                />
              </div>
              <TabsList className="grid w-full grid-cols-2 sm:w-auto">
                <TabsTrigger value="overview">Opis</TabsTrigger>
                <TabsTrigger value="details">Szczegóły</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="overview">
              <Card>
                <CardHeader>
                  <CardTitle>Program i atrakcje</CardTitle>
                </CardHeader>
                <CardContent>
                  <TripContentEditor
                    content={programAtrakcje}
                    onChange={setProgramAtrakcje}
                    label="Program i atrakcje"
                  />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Najważniejsze informacje</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>Te informacje są automatycznie generowane z danych wycieczki.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Dodatkowe świadczenia</CardTitle>
            </CardHeader>
            <CardContent>
              <TripContentEditor
                content={dodatkoweSwiadczenia}
                onChange={setDodatkoweSwiadczenia}
                label="Dodatkowe świadczenia"
              />
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="flex justify-end gap-2">
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
  );
}
