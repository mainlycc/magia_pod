"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { TripContentEditor } from "@/components/trip-content-editor"
import { toast } from "sonner"
import { Upload, X, Loader2, Link as LinkIcon, Camera, GripVertical } from "lucide-react"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"

export default function DodajWycieczkePage() {
  const router = useRouter()
  const { setSelectedTrip, trips, setTrips } = useTrip()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addingFromUrl, setAddingFromUrl] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [programAtrakcje, setProgramAtrakcje] = useState("")
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [tripTitle, setTripTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [price, setPrice] = useState("")
  const [seats, setSeats] = useState("")
  const [category, setCategory] = useState("")
  const [location, setLocation] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [publicSlug, setPublicSlug] = useState("")
  const [tripInfoText, setTripInfoText] = useState("")
  const [includedInPriceLeftText, setIncludedInPriceLeftText] = useState("")
  const [baggageText, setBaggageText] = useState("")
  const [weatherText, setWeatherText] = useState("")
  const [showTripInfoConfigCard, setShowTripInfoConfigCard] = useState(true)
  const [showIncludedInPriceLeftCard, setShowIncludedInPriceLeftCard] = useState(true)
  const [showBaggageCard, setShowBaggageCard] = useState(true)
  const [showWeatherCard, setShowWeatherCard] = useState(true)
  const [showSeatsLeft, setShowSeatsLeft] = useState(false)
  const [includedInPriceText, setIncludedInPriceText] = useState("")
  const [additionalCostsText, setAdditionalCostsText] = useState("")
  const [additionalServiceText, setAdditionalServiceText] = useState("")
  const [reservationNumber, setReservationNumber] = useState("")
  const [durationText, setDurationText] = useState("")
  
  // Drag & drop i widoczność sekcji w edytorze
  type MiddleSectionId = "program"
  type RightSectionId = "bookingPreview" | "includedInPrice" | "additionalCosts" | "additionalService"

  const [middleSections, setMiddleSections] = useState<MiddleSectionId[]>([
    "program",
  ])
  const [rightSections, setRightSections] = useState<RightSectionId[]>([
    "bookingPreview",
    "includedInPrice",
    "additionalCosts",
    "additionalService",
  ])
  const [hiddenMiddleSections, setHiddenMiddleSections] = useState<MiddleSectionId[]>([])
  const [hiddenRightSections, setHiddenRightSections] = useState<RightSectionId[]>([])
  const [draggingMiddle, setDraggingMiddle] = useState<MiddleSectionId | null>(null)
  const [draggingRight, setDraggingRight] = useState<RightSectionId | null>(null)

  const effectivePublicSlug = isPublic ? (publicSlug || slug) : ""

  const validateImageUrl = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: "HEAD" })
      const contentType = response.headers.get("content-type")
      return contentType?.startsWith("image/") ?? false
    } catch {
      return false
    }
  }

  const handleAddImageFromUrl = async () => {
    if (!imageUrl.trim()) return

    try {
      if (galleryUrls.length >= 3) {
        toast.error("Możesz dodać maksymalnie 3 zdjęcia do galerii")
        return
      }

      setAddingFromUrl(true)

      try {
        new URL(imageUrl)
      } catch {
        toast.error("Nieprawidłowy adres URL")
        setAddingFromUrl(false)
        return
      }

      const isValidImage = await validateImageUrl(imageUrl)
      if (!isValidImage) {
        toast.error("Podany URL nie wskazuje na obraz")
        setAddingFromUrl(false)
        return
      }

      if (galleryUrls.includes(imageUrl)) {
        toast.error("To zdjęcie już jest w galerii")
        setAddingFromUrl(false)
        return
      }

      setGalleryUrls([...galleryUrls, imageUrl].slice(0, 3))
      setImageUrl("")
      toast.success("Zdjęcie zostało dodane z linku")
    } catch (err) {
      toast.error("Nie udało się dodać zdjęcia")
    } finally {
      setAddingFromUrl(false)
    }
  }

  const handleImageDelete = (url: string) => {
    setGalleryUrls(galleryUrls.filter((u) => u !== url))
    toast.success("Zdjęcie zostało usunięte")
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (galleryUrls.length >= 3) {
      toast.error("Możesz dodać maksymalnie 3 zdjęcia do galerii")
      e.target.value = ""
      return
    }

    // Dla nowej wycieczki, zdjęcia będą zapisane po utworzeniu wycieczki
    // Na razie tylko dodajemy je lokalnie
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      setGalleryUrls([...galleryUrls, dataUrl].slice(0, 3))
      toast.success("Zdjęcie zostało dodane (zostanie zapisane po utworzeniu wycieczki)")
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const handleSave = async () => {
    if (!tripTitle || !slug) {
      toast.error("Tytuł i slug są wymagane")
      return
    }

    try {
      setSaving(true)

      // Najpierw utwórz wycieczkę
      const tripRes = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: tripTitle,
          slug,
          description: description || null,
          start_date: startDate || null,
          end_date: endDate || null,
          price_cents: price ? Math.round(parseFloat(price) * 100) : null,
          seats_total: seats ? parseInt(seats) : 0,
          is_active: true,
          is_public: isPublic,
          public_slug: effectivePublicSlug || null,
          category: category || null,
          location: location || null,
        }),
      })

      if (!tripRes.ok) {
        const errorData = await tripRes.json().catch(() => ({}))
        toast.error(errorData.error || "Nie udało się utworzyć wycieczki")
        setSaving(false)
        return
      }

      const tripData = await tripRes.json()
      const tripId = tripData.id

      // Zapisz treść wycieczki
      const contentRes = await fetch(`/api/trips/${tripId}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_atrakcje: programAtrakcje,
          gallery_urls: galleryUrls,
          trip_info_text: tripInfoText,
          baggage_text: baggageText,
          weather_text: weatherText,
          show_seats_left: showSeatsLeft,
          included_in_price_text: includedInPriceLeftText,
          additional_costs_text: additionalCostsText,
          additional_service_text: additionalServiceText,
          reservation_number: reservationNumber,
          duration_text: durationText,
        }),
      })

      if (!contentRes.ok) {
        toast.error("Wycieczka została utworzona, ale nie udało się zapisać treści")
      }

      // Jeśli są zdjęcia z plików, zapisz je przez API
      for (const url of galleryUrls) {
        if (url.startsWith("data:")) {
          // To jest data URL z pliku - pomiń na razie, użytkownik może dodać później przez URL
          // W przyszłości można dodać upload przez API
        }
      }

      // Odśwież listę wycieczek
      const tripsRes = await fetch("/api/trips")
      if (tripsRes.ok) {
        const tripsData = await tripsRes.json()
        setTrips(tripsData)
        
        // Ustaw nowo utworzoną wycieczkę jako wybraną
        const newTrip = tripsData.find((t: { id: string }) => t.id === tripId)
        if (newTrip) {
          setSelectedTrip(newTrip)
        }
      }

      toast.success("Wycieczka została utworzona")
      router.push("/trip-dashboard/publiczny-wyglad")
    } catch (err) {
      toast.error("Nie udało się utworzyć wycieczki")
      setSaving(false)
    }
  }

  const mainImage = galleryUrls[0] || "/placeholder.svg"
  const galleryImages = galleryUrls.slice(1, 3)
  const priceDisplay = price ? parseFloat(price).toFixed(2) : "0"
  const seatsTotal = seats ? parseInt(seats) : 0
  const seatsLeft = seatsTotal

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 xl:items-start">
        {/* Lewa kolumna – galeria + informacje o wyjeździe */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <Card>
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-sm font-semibold">
                Informacje o wyjeździe i galeria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2 relative rounded-xl overflow-hidden group h-[200px] border-2 border-dashed border-muted-foreground/20">
                  {mainImage && mainImage !== "/placeholder.svg" ? (
                    <>
                      <Image
                        src={mainImage}
                        alt={tripTitle || "Główne zdjęcie"}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <Badge className="text-[10px]">
                          Główne zdjęcie
                        </Badge>
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
                        <p className="text-xs text-muted-foreground">
                          Główne zdjęcie (jak na górze strony publicznej)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {Array.from({ length: 2 }).map((_, index) => {
                  const url = galleryImages[index]
                  return (
                    <div
                      key={index}
                      className="relative rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/20 h-[100px] group"
                    >
                      {url ? (
                        <>
                          <Image
                            src={url}
                            alt={`Zdjęcie ${index + 2}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 25vw"
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
                  )
                })}
              </div>

              <div className="space-y-2">
                <Label>Dodaj zdjęcie z URL</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddImageFromUrl()
                      }
                    }}
                    disabled={addingFromUrl}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddImageFromUrl}
                    disabled={addingFromUrl || !imageUrl.trim()}
                  >
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
                <Label htmlFor="image-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
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
            </CardContent>
          </Card>

          {/* Informacje o wyjeździe */}
          {showTripInfoConfigCard && (
            <Card>
              <CardHeader className="px-3 py-2 relative flex items-center justify-between gap-2 pr-5">
                <CardTitle className="text-sm font-semibold">
                  Informacje o wyjeździe
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setShowTripInfoConfigCard(false)}
                  className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                <Textarea
                  value={tripInfoText}
                  onChange={(e) => setTripInfoText(e.target.value)}
                  placeholder="Wpisz informacje o wyjeździe..."
                  className="min-h-[120px] text-xs"
                />
              </CardContent>
            </Card>
          )}

          {/* W cenie wycieczki – osobna karta */}
          {showIncludedInPriceLeftCard && (
            <Card>
              <CardHeader className="px-3 py-2 relative flex items-center justify-between gap-2 pr-5">
                <CardTitle className="text-sm font-semibold">W cenie wycieczki</CardTitle>
                <button
                  type="button"
                  onClick={() => setShowIncludedInPriceLeftCard(false)}
                  className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                <Textarea
                  value={includedInPriceLeftText}
                  onChange={(e) => setIncludedInPriceLeftText(e.target.value)}
                  placeholder="Wpisz co jest w cenie wycieczki..."
                  className="min-h-[80px] text-xs"
                />
              </CardContent>
            </Card>
          )}

          {/* Bagaż – osobna karta */}
          {showBaggageCard && (
            <Card>
              <CardHeader className="px-3 py-2 relative flex items-center justify-between gap-2 pr-5">
                <CardTitle className="text-sm font-semibold">Bagaż</CardTitle>
                <button
                  type="button"
                  onClick={() => setShowBaggageCard(false)}
                  className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                <Textarea
                  value={baggageText}
                  onChange={(e) => setBaggageText(e.target.value)}
                  placeholder="Np. Bagaż podręczny do 8 kg + bagaż rejestrowany do 20 kg zgodnie z regulaminem przewoźnika..."
                  className="min-h-[80px] text-xs"
                />
              </CardContent>
            </Card>
          )}

          {/* Pogoda – osobna karta */}
          {showWeatherCard && (
            <Card>
              <CardHeader className="px-3 py-2 relative flex items-center justify-between gap-2 pr-5">
                <CardTitle className="text-sm font-semibold">Pogoda</CardTitle>
                <button
                  type="button"
                  onClick={() => setShowWeatherCard(false)}
                  className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                >
                  <X className="h-3 w-3" />
                </button>
              </CardHeader>
              <CardContent className="space-y-2 pt-2">
                <Textarea
                  value={weatherText}
                  onChange={(e) => setWeatherText(e.target.value)}
                  placeholder="Np. Średnia temperatura w ciągu dnia 24–28°C, wieczory chłodniejsze – zalecamy lekką kurtkę..."
                  className="min-h-[80px] text-xs"
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Środkowa kolumna – opis, informacje o wyjeździe, program */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          {/* Podstawowe informacje o wycieczce */}
          <Card>
            <CardHeader className="px-3 py-2">
              <CardTitle className="text-sm font-semibold">
                Podstawowe informacje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="grid gap-2">
                <Label>Tytuł wycieczki *</Label>
                <Input
                  value={tripTitle}
                  onChange={(e) => setTripTitle(e.target.value)}
                  placeholder="Np. Magiczna wycieczka do Włoch"
                  className="text-base"
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug *</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="np. magiczna-wycieczka-wlochy"
                  className="text-sm"
                />
              </div>
              <div className="grid gap-2">
                <Label>Opis</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Krótki opis wycieczki..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Data rozpoczęcia</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Data zakończenia</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Kategoria</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="np. Wycieczki górskie"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Miejsce</Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="np. Islandia"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Cena (PLN)</Label>
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Liczba miejsc</Label>
                  <Input
                    type="number"
                    value={seats}
                    onChange={(e) => setSeats(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="is-public"
                    checked={isPublic}
                    onCheckedChange={(checked) => setIsPublic(Boolean(checked))}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="is-public">Publiczna podstrona wycieczki</Label>
                    <p className="text-xs text-muted-foreground">
                      Gdy włączone, wycieczka będzie dostępna publicznie pod adresem URL z poniższym slugiem.
                    </p>
                  </div>
                </div>
                {isPublic && (
                  <div className="grid gap-2 ml-7">
                    <Label>Publiczny slug</Label>
                    <Input
                      placeholder="np. magicka-wycieczka-wlochy"
                      value={publicSlug}
                      onChange={(e) => setPublicSlug(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL: <span className="font-mono">/trip/{effectivePublicSlug || "twoj-slug"}</span>
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tytuł wyjazdu, numer rezerwacji, data, czas trwania, kraj */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Tytuł wyjazdu - duży nagłówek */}
              <h1 className="text-2xl font-bold text-foreground">{tripTitle || "Tytuł wycieczki"}</h1>
              
              {/* Numer rezerwacji */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Numer rezerwacji:</Label>
                <Input
                  value={reservationNumber}
                  onChange={(e) => setReservationNumber(e.target.value)}
                  placeholder="Wpisz numer rezerwacji..."
                  className="text-sm"
                />
              </div>

              {/* Data wyjazdu, czas trwania, kraj */}
              <div className="space-y-3 text-base">
                {startDate && endDate && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Data wyjazdu:</span>
                    <span className="text-foreground">
                      {new Date(startDate).toLocaleDateString("pl-PL")} – {new Date(endDate).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Czas trwania:</Label>
                  <Input
                    value={durationText}
                    onChange={(e) => setDurationText(e.target.value)}
                    placeholder="Np. 8 dni / 7 nocy"
                    className="text-base"
                  />
                </div>

                {location && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Kraj:</span>
                    <span className="text-foreground">{location}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {middleSections.map((sectionId) => {
            if (hiddenMiddleSections.includes(sectionId)) return null

            const commonHeaderProps = {
              className:
                "relative flex items-center justify-between gap-1 cursor-move px-3 py-2",
            }

            const dragHandlers = {
              draggable: true,
              onDragStart: () => setDraggingMiddle(sectionId),
              onDragOver: (e: React.DragEvent) => {
                e.preventDefault()
                if (!draggingMiddle || draggingMiddle === sectionId) return
                setMiddleSections((prev) => {
                  const fromIndex = prev.indexOf(draggingMiddle)
                  const toIndex = prev.indexOf(sectionId)
                  if (fromIndex === -1 || toIndex === -1) return prev
                  const next = [...prev]
                  next.splice(fromIndex, 1)
                  next.splice(toIndex, 0, draggingMiddle)
                  return next
                })
              },
              onDragEnd: () => setDraggingMiddle(null),
            }

            const removeSection = () =>
              setHiddenMiddleSections((prev) =>
                prev.includes(sectionId) ? prev : [...prev, sectionId]
              )

            // Jedyna sekcja: Program
            return (
              <Card key={sectionId}>
                <CardHeader {...dragHandlers} {...commonHeaderProps}>
                  <div className="flex items-center gap-2 pr-5">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">
                      Program
                    </CardTitle>
                  </div>
                  <button
                    type="button"
                    onClick={removeSection}
                    className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </CardHeader>
                <CardContent>
                  <TripContentEditor
                    content={programAtrakcje}
                    onChange={setProgramAtrakcje}
                    label=""
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Prawa kolumna – karta rezerwacji / tekst informacyjny (drag & drop) */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          {rightSections.map((sectionId) => {
            if (hiddenRightSections.includes(sectionId)) return null

            const commonHeaderProps = {
              className:
                "relative flex items-center justify-between gap-1 cursor-move px-3 py-2",
            }

            const dragHandlers = {
              draggable: true,
              onDragStart: () => setDraggingRight(sectionId),
              onDragOver: (e: React.DragEvent) => {
                e.preventDefault()
                if (!draggingRight || draggingRight === sectionId) return
                setRightSections((prev) => {
                  const fromIndex = prev.indexOf(draggingRight)
                  const toIndex = prev.indexOf(sectionId)
                  if (fromIndex === -1 || toIndex === -1) return prev
                  const next = [...prev]
                  next.splice(fromIndex, 1)
                  next.splice(toIndex, 0, draggingRight)
                  return next
                })
              },
              onDragEnd: () => setDraggingRight(null),
            }

            const removeSection = () =>
              setHiddenRightSections((prev) =>
                prev.includes(sectionId) ? prev : [...prev, sectionId]
              )

            if (sectionId === "bookingPreview") {
              return (
                <Card key={sectionId} className="border-border">
                  <CardHeader {...dragHandlers} {...commonHeaderProps}>
                    <div className="flex items-center gap-2 pr-5">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">
                        Podgląd karty rezerwacji
                      </CardTitle>
                    </div>
                    <button
                      type="button"
                      onClick={removeSection}
                      className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Cena</span>
                      <span className="font-semibold text-foreground">
                        {priceDisplay} PLN
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pozostało miejsc</span>
                      <label className="inline-flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border border-muted-foreground/60"
                          checked={showSeatsLeft}
                          onChange={(e) => setShowSeatsLeft(e.target.checked)}
                        />
                        <span className="text-xs">Pokaż na stronie</span>
                      </label>
                    </div>
                    {showSeatsLeft && (
                      <div className="text-xs text-muted-foreground">
                        Na stronie będzie widoczne: {seatsLeft} miejsc
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            }

            if (sectionId === "includedInPrice") {
              return (
                <Card key={sectionId}>
                  <CardHeader {...dragHandlers} {...commonHeaderProps}>
                    <div className="flex items-center gap-2 pr-5">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">
                        Świadczenia w cenie
                      </CardTitle>
                    </div>
                    <button
                      type="button"
                      onClick={removeSection}
                      className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={includedInPriceText}
                      onChange={(e) => setIncludedInPriceText(e.target.value)}
                      placeholder="Wpisz świadczenia w cenie wycieczki..."
                      className="min-h-[120px]"
                    />
                  </CardContent>
                </Card>
              )
            }

            if (sectionId === "additionalCosts") {
              return (
                <Card key={sectionId}>
                  <CardHeader {...dragHandlers} {...commonHeaderProps}>
                    <div className="flex items-center gap-2 pr-5">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">
                        Dodatkowe koszty
                      </CardTitle>
                    </div>
                    <button
                      type="button"
                      onClick={removeSection}
                      className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={additionalCostsText}
                      onChange={(e) => setAdditionalCostsText(e.target.value)}
                      placeholder="Wpisz dodatkowe koszty..."
                      className="min-h-[120px]"
                    />
                  </CardContent>
                </Card>
              )
            }

            if (sectionId === "additionalService") {
              return (
                <Card key={sectionId}>
                  <CardHeader {...dragHandlers} {...commonHeaderProps}>
                    <div className="flex items-center gap-2 pr-5">
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      <CardTitle className="text-sm font-semibold">
                        Dodatkowe świadczenie
                      </CardTitle>
                    </div>
                    <button
                      type="button"
                      onClick={removeSection}
                      className="absolute right-2 top-1.5 h-5 w-5 rounded-sm text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={additionalServiceText}
                      onChange={(e) => setAdditionalServiceText(e.target.value)}
                      placeholder="Wpisz dodatkowe świadczenie (opcjonalne)..."
                      className="min-h-[120px]"
                    />
                  </CardContent>
                </Card>
              )
            }

            return null
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Anuluj
        </Button>
        <Button onClick={handleSave} disabled={saving || !tripTitle || !slug}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Zapisywanie...
            </>
          ) : (
            "Utwórz wycieczkę"
          )}
        </Button>
      </div>
    </div>
  )
}

