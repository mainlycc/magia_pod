"use client"

import { useEffect, useState } from "react"
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
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function PublicznyWygladPage() {
  const router = useRouter()
  const { selectedTrip } = useTrip()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addingFromUrl, setAddingFromUrl] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [programAtrakcje, setProgramAtrakcje] = useState("")
  const [dodatkoweSwiadczenia, setDodatkoweSwiadczenia] = useState("")
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [tripTitle, setTripTitle] = useState("")
  const [introText, setIntroText] = useState("")
  const [sectionPoznajTitle, setSectionPoznajTitle] = useState("")
  const [sectionPoznajDescription, setSectionPoznajDescription] = useState("")
  const [reservationInfoText, setReservationInfoText] = useState("")
  const [tripInfoText, setTripInfoText] = useState("")
  const [baggageText, setBaggageText] = useState("")
  const [weatherText, setWeatherText] = useState("")
  const [showTripInfoConfigCard, setShowTripInfoConfigCard] = useState(true)
  const [showBaggageCard, setShowBaggageCard] = useState(true)
  const [showWeatherCard, setShowWeatherCard] = useState(true)
  const [showSeatsLeft, setShowSeatsLeft] = useState(false)
  const [includedInPriceText, setIncludedInPriceText] = useState("")
  const [additionalCostsText, setAdditionalCostsText] = useState("")
  const [additionalServiceText, setAdditionalServiceText] = useState("")
  // Lewa kolumna – pola konfigurowalne
  const [whatToBring, setWhatToBring] = useState<string[]>([])
  const [includedInPrice, setIncludedInPrice] = useState<
    { id: string; title: string; content: string }[]
  >([])
  // Drag & drop i widoczność sekcji w edytorze
  type MiddleSectionId = "program"
  type RightSectionId = "bookingPreview" | "reservationInfo" | "includedInPrice" | "additionalCosts" | "additionalService"

  const [middleSections, setMiddleSections] = useState<MiddleSectionId[]>([
    "program",
  ])
  const [rightSections, setRightSections] = useState<RightSectionId[]>([
    "bookingPreview",
    "includedInPrice",
    "additionalCosts",
    "additionalService",
    "reservationInfo",
  ])
  const [hiddenMiddleSections, setHiddenMiddleSections] = useState<MiddleSectionId[]>([])
  const [hiddenRightSections, setHiddenRightSections] = useState<RightSectionId[]>([])
  const [draggingMiddle, setDraggingMiddle] = useState<MiddleSectionId | null>(null)
  const [draggingRight, setDraggingRight] = useState<RightSectionId | null>(null)
  const [tripData, setTripData] = useState<{
    start_date: string | null
    end_date: string | null
    price_cents: number | null
    seats_total: number | null
    seats_reserved: number | null
    is_active: boolean | null
    location: string | null
    description: string | null
    category?: string | null
  } | null>(null)

  useEffect(() => {
    if (!selectedTrip) {
      setLoading(false)
      return
    }

    const loadContent = async () => {
      try {
        setLoading(true)
        const [contentRes, tripRes] = await Promise.all([
          fetch(`/api/trips/${selectedTrip.id}/content`),
          fetch(`/api/trips/${selectedTrip.id}`),
        ])

        if (contentRes.ok) {
          const content = await contentRes.json()
          setProgramAtrakcje(content.program_atrakcje || "")
          setDodatkoweSwiadczenia(content.dodatkowe_swiadczenia || "")
          // Limit maksymalnie do 3 zdjęć
          setGalleryUrls((content.gallery_urls || []).slice(0, 3))
          setIntroText(content.intro_text || "")
          setSectionPoznajTitle(content.section_poznaj_title || "")
          setSectionPoznajDescription(content.section_poznaj_description || "")
          setReservationInfoText(content.reservation_info_text || "")
          setTripInfoText(content.trip_info_text || "")
          setBaggageText(content.baggage_text || "")
          setWeatherText(content.weather_text || "")
          setShowSeatsLeft(content.show_seats_left ?? false)
          setIncludedInPriceText(content.included_in_price_text || "")
          setAdditionalCostsText(content.additional_costs_text || "")
          setAdditionalServiceText(content.additional_service_text || "")
        }

        if (tripRes.ok) {
          const trip = await tripRes.json()
          setTripTitle(trip.title || "")
          setTripData({
            start_date: trip.start_date || null,
            end_date: trip.end_date || null,
            price_cents: trip.price_cents || null,
            seats_total: trip.seats_total || null,
            seats_reserved: trip.seats_reserved || null,
            is_active: trip.is_active ?? null,
            location: trip.location || null,
            description: trip.description || null,
            category: trip.category || null,
          })
        }
      } catch (err) {
        toast.error("Nie udało się wczytać treści")
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [selectedTrip])

  const handleSave = async () => {
    if (!selectedTrip) return

    try {
      setSaving(true)
      const res = await fetch(`/api/trips/${selectedTrip.id}/content`, {
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
          trip_info_text: tripInfoText,
          baggage_text: baggageText,
          weather_text: weatherText,
          show_seats_left: showSeatsLeft,
          included_in_price_text: includedInPriceText,
          additional_costs_text: additionalCostsText,
          additional_service_text: additionalServiceText,
        }),
      })

      if (res.ok) {
        toast.success("Treść została zapisana")
      } else {
        toast.error("Nie udało się zapisać treści")
      }
    } catch (err) {
      toast.error("Nie udało się zapisać treści")
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedTrip) return

    if (galleryUrls.length >= 3) {
      toast.error("Możesz dodać maksymalnie 3 zdjęcia do galerii")
      e.target.value = ""
      return
    }

    try {
      setUploading(true)
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/trips/${selectedTrip.id}/gallery`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setGalleryUrls([...galleryUrls, data.url])
        toast.success("Zdjęcie zostało dodane")
      } else {
        toast.error("Nie udało się dodać zdjęcia")
      }
    } catch (err) {
      toast.error("Nie udało się dodać zdjęcia")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const handleImageDelete = async (url: string) => {
    if (!selectedTrip) return

    try {
      const res = await fetch(
        `/api/trips/${selectedTrip.id}/gallery?url=${encodeURIComponent(url)}`,
        {
          method: "DELETE",
        }
      )

      if (res.ok) {
        setGalleryUrls(galleryUrls.filter((u) => u !== url))
        toast.success("Zdjęcie zostało usunięte")
      } else {
        toast.error("Nie udało się usunąć zdjęcia")
      }
    } catch (err) {
      toast.error("Nie udało się usunąć zdjęcia")
    }
  }

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
    if (!imageUrl.trim() || !selectedTrip) return

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
        return
      }

      const isValidImage = await validateImageUrl(imageUrl)
      if (!isValidImage) {
        toast.error("Podany URL nie wskazuje na obraz")
        return
      }

      if (galleryUrls.includes(imageUrl)) {
        toast.error("To zdjęcie już jest w galerii")
        return
      }

      const updatedUrls = [...galleryUrls, imageUrl].slice(0, 3)

      const res = await fetch(`/api/trips/${selectedTrip.id}/content`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gallery_urls: updatedUrls,
        }),
      })

      if (res.ok) {
        setGalleryUrls(updatedUrls)
        setImageUrl("")
        toast.success("Zdjęcie zostało dodane z linku")
      } else {
        toast.error("Nie udało się dodać zdjęcia")
      }
    } catch (err) {
      toast.error("Nie udało się dodać zdjęcia")
    } finally {
      setAddingFromUrl(false)
    }
  }

  if (!selectedTrip) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Wybierz wycieczkę</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const mainImage = galleryUrls[0] || "/placeholder.svg"
  // Jeden rząd miniatur – maksymalnie 2 dodatkowe zdjęcia
  const galleryImages = galleryUrls.slice(1, 3)
  const price = tripData?.price_cents
    ? (tripData.price_cents / 100).toFixed(2)
    : "0"
  const seatsLeft = tripData
    ? Math.max(0, (tripData.seats_total ?? 0) - (tripData.seats_reserved ?? 0))
    : 0
  const days =
    tripData?.start_date && tripData?.end_date
      ? Math.ceil(
          (new Date(tripData.end_date).getTime() -
            new Date(tripData.start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 0
  const nights = Math.max(0, days - 1)

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Wycieczka: <span className="font-medium">{tripTitle}</span>
      </div>

      {/* Pasek z datą i liczbą nocy – tylko podgląd, nieedytowalny */}
      {tripData && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">Termin:</span>
            <span>
              {tripData.start_date && tripData.end_date
                ? `${new Date(tripData.start_date).toLocaleDateString(
                    "pl-PL"
                  )} – ${new Date(tripData.end_date).toLocaleDateString("pl-PL")}`
                : "Do ustalenia"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-foreground">Dni / noce:</span>
            <span>
              {days > 0 ? `${days} dni / ${nights} nocy` : "W trakcie ustalania"}
            </span>
          </div>
        </div>
      )}

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
                        alt={tripTitle}
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

          {/* Co zabrać + w cenie wycieczki */}
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
              <CardContent className="space-y-4 pt-2">
                {/* Co zabrać ze sobą */}
                <div className="space-y-2">
                  <div className="space-y-2">
                    {whatToBring.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={item}
                          onChange={(e) => {
                            const next = [...whatToBring]
                            next[index] = e.target.value
                            setWhatToBring(next)
                          }}
                          placeholder="Np. Paszport, EKUZ, wydatki własne..."
                          className="text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setWhatToBring((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="h-6 w-6 rounded-sm border text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center text-xs"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setWhatToBring((prev) => [...prev, ""])}
                    >
                      Dodaj pozycję
                    </Button>
                  </div>
                </div>

                {/* Świadczenia w cenie – repeater */}
                <div className="space-y-3">
                  {includedInPrice.map((item, index) => (
                    <div key={item.id} className="rounded-md border p-2 space-y-1.5">
                      <div className="flex gap-2">
                        <Input
                          value={item.title}
                          onChange={(e) => {
                            const next = [...includedInPrice]
                            next[index] = { ...next[index], title: e.target.value }
                            setIncludedInPrice(next)
                          }}
                          placeholder="Tytuł (np. Zakwaterowanie)"
                          className="text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setIncludedInPrice((prev) =>
                              prev.filter((p) => p.id !== item.id)
                            )
                          }
                          className="h-6 w-6 rounded-sm border text-muted-foreground hover:text-destructive hover:bg-muted flex items-center justify-center text-xs"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <Textarea
                        value={item.content}
                        onChange={(e) => {
                          const next = [...includedInPrice]
                          next[index] = { ...next[index], content: e.target.value }
                          setIncludedInPrice(next)
                        }}
                        placeholder="Opis (np. 3 noclegi w hotelu *** ze śniadaniami)"
                        className="min-h-[60px] text-xs"
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() =>
                      setIncludedInPrice((prev) => [
                        ...prev,
                        {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                          title: "",
                          content: "",
                        },
                      ])
                    }
                  >
                    Dodaj blok
                  </Button>
                </div>
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

        {/* Środkowa kolumna – opis, informacje o wyjeździe, program, dodatkowe świadczenia, sekcja „Poznaj” (drag & drop) */}
        <div className="xl:col-span-5 flex flex-col gap-4">
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
                      <span>Cena (z bazy)</span>
                      <span className="font-semibold text-foreground">
                        {price} PLN
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

            // reservationInfo
            return (
              <Card key={sectionId}>
                <CardHeader {...dragHandlers} {...commonHeaderProps}>
                  <div className="flex items-center gap-2 pr-5">
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">
                      Tekst informacyjny o rezerwacji
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
                    value={reservationInfoText}
                    onChange={(e) => setReservationInfoText(e.target.value)}
                    placeholder="Do rezerwacji potrzebne będą dane kontaktowe..."
                    className="min-h-[120px]"
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
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
  )
}

