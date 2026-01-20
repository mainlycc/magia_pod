"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, use } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Users,
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"

type Trip = {
  id: string
  title: string
  slug: string
  public_slug?: string | null
  description: string | null
  start_date: string | null
  end_date: string | null
  price_cents: number | null
  seats_total: number | null
  seats_reserved: number | null
  is_active: boolean | null
  is_public: boolean | null
  gallery_urls: string[] | null
  program_atrakcje: string | null
  dodatkowe_swiadczenia: string | null
  intro_text: string | null
  section_poznaj_title: string | null
  section_poznaj_description: string | null
  location: string | null
  show_seats_left: boolean | null
  included_in_price_text: string | null
  additional_costs_text: string | null
  additional_service_text: string | null
  trip_info_text: string | null
  baggage_text: string | null
  weather_text: string | null
  reservation_number: string | null
  duration_text: string | null
}

function calculateDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1 // +1 to include both start and end day
}


export default function TripPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const { slug } = use(params instanceof Promise ? params : Promise.resolve(params))
  const [trip, setTrip] = useState<Trip | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [selectedImage, setSelectedImage] = useState<number | null>(null)

  useEffect(() => {
    async function loadTrip() {
      try {
        const supabase = createClient()
        
        // Try to find by slug first
        let { data: tripData, error: tripError } = await supabase
          .from("trips")
          .select(
            "id,title,slug,public_slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,is_public,gallery_urls,location"
          )
          .eq("slug", slug)
          .maybeSingle<Trip>()

        if (!tripData && !tripError) {
          // Try public_slug
          const { data: tripByPublicSlug, error: errorByPublicSlug } = await supabase
            .from("trips")
            .select(
              "id,title,slug,public_slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,is_public,gallery_urls,location"
            )
            .eq("public_slug", slug)
            .maybeSingle<Trip>()
          
          if (tripByPublicSlug) {
            tripData = tripByPublicSlug
          } else {
            tripError = errorByPublicSlug
          }
        }

        if (tripError) {
          setError(tripError)
          setLoading(false)
          return
        }

        if (!tripData) {
          setError(new Error("Trip not found"))
          setLoading(false)
          return
        }

        // Load additional content fields
        try {
          const { data: contentData } = await supabase
            .from("trips")
            .select("program_atrakcje,dodatkowe_swiadczenia,intro_text,section_poznaj_title,section_poznaj_description,show_seats_left,included_in_price_text,additional_costs_text,additional_service_text,trip_info_text,baggage_text,weather_text,reservation_number,duration_text")
            .eq("id", tripData.id)
            .maybeSingle()
          
          if (contentData) {
            tripData = {
              ...tripData,
              ...contentData,
            }
          }
        } catch (e) {
          // Ignore errors for optional fields
        }

        setTrip(tripData)
      } catch (err) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    loadTrip()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Ładowanie...</div>
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-card border-b border-border">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
            <ol className="flex items-center gap-2 text-xs text-muted-foreground">
              <li>
                <Link href="/" className="hover:text-foreground transition-colors">
                  Strona główna
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/trip" className="hover:text-foreground transition-colors">
                  Wycieczki
                </Link>
              </li>
              <li>/</li>
              <li className="text-foreground font-medium">Nie znaleziono</li>
            </ol>
          </div>
        </nav>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <CardContent className="p-6">
              <h1 className="text-xl font-semibold mb-2">Wycieczka nie została znaleziona</h1>
              <p className="text-muted-foreground mb-4">
                Sprawdź poprawność linku lub skontaktuj się z naszym biurem podróży.
              </p>
              <Button asChild>
                <Link href="/">Wróć na stronę główną</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const seatsLeft = Math.max(0, (trip.seats_total ?? 0) - (trip.seats_reserved ?? 0))
  const price = trip.price_cents ? (trip.price_cents / 100).toFixed(2) : "0"
  const days = calculateDays(trip.start_date, trip.end_date)
  const nights = Math.max(0, days - 1)
  const galleryUrls = Array.isArray(trip.gallery_urls) ? trip.gallery_urls : []
  const mainImage = galleryUrls[0] || "/placeholder.svg"
  // Maksymalnie 2 dodatkowe zdjęcia (tak jak w panelu edycji)
  const galleryImages = galleryUrls.slice(1, 3)

  const openImage = (index: number) => setSelectedImage(index)
  const closeImage = () => setSelectedImage(null)
  const nextImage = () => setSelectedImage((prev) => (prev !== null ? (prev + 1) % galleryUrls.length : null))
  const prevImage = () =>
    setSelectedImage((prev) => (prev !== null ? (prev - 1 + galleryUrls.length) % galleryUrls.length : null))

  return (
    <main className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-2">
          <ol className="flex items-center gap-2 text-xs text-muted-foreground">
            <li>
              <Link href="/" className="hover:text-foreground transition-colors">
                Strona główna
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/trip" className="hover:text-foreground transition-colors">
                Wycieczki
              </Link>
            </li>
            <li>/</li>
            <li className="text-foreground font-medium">{trip.title}</li>
          </ol>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
        {/* Pasek z datą i liczbą nocy - tak jak w panelu edycji */}
        {trip.start_date && trip.end_date && (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 px-3 py-2 text-xs text-muted-foreground mb-6">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">Termin:</span>
              <span>
                {new Date(trip.start_date).toLocaleDateString("pl-PL")} – {new Date(trip.end_date).toLocaleDateString("pl-PL")}
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
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-2">
                  {/* Główne zdjęcie */}
                  <div className="col-span-2 relative rounded-xl overflow-hidden group h-[200px] border-2 border-dashed border-muted-foreground/20">
                    {mainImage && mainImage !== "/placeholder.svg" ? (
                      <>
                        <Image
                          src={mainImage}
                          alt={trip.title}
                          fill
                          className="object-cover cursor-pointer"
                          sizes="(max-width: 768px) 100vw, 50vw"
                          onClick={() => openImage(0)}
                        />
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <Badge className="text-[10px]">
                            Główne zdjęcie
                          </Badge>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">
                            Główne zdjęcie
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2 miniatury */}
                  {Array.from({ length: 2 }).map((_, index) => {
                    const url = galleryImages[index]
                    return (
                      <div
                        key={index}
                        className="relative rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/20 h-[100px] group cursor-pointer"
                        onClick={() => url && openImage(index + 1)}
                      >
                        {url ? (
                          <Image
                            src={url}
                            alt={`Zdjęcie ${index + 2}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 50vw, 25vw"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Informacje o wyjeździe */}
            {(() => {
              if (!trip.trip_info_text) return null
              
              let hasWhatToBring = false
              let hasIncludedInPrice = false
              let isJson = false
              let parsed: any = null
              
              try {
                parsed = JSON.parse(trip.trip_info_text)
                isJson = true
                hasWhatToBring = parsed.whatToBring && Array.isArray(parsed.whatToBring) && parsed.whatToBring.length > 0
                // Nie wyświetlaj includedInPrice z trip_info_text, jeśli istnieje included_in_price_text (unika duplikacji)
                hasIncludedInPrice = !trip.included_in_price_text && parsed.includedInPrice && Array.isArray(parsed.includedInPrice) && parsed.includedInPrice.length > 0
              } catch {
                // Nie jest JSON
              }
              
              // Wyświetl tylko jeśli są dane do wyświetlenia
              if (!isJson || (!hasWhatToBring && !hasIncludedInPrice)) {
                if (!isJson && trip.trip_info_text.trim()) {
                  // Wyświetl jako zwykły tekst
                  return (
                    <Card>
                      <CardHeader className="px-3 py-2">
                        <CardTitle className="text-sm font-semibold">
                          Informacje o wyjeździe
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2">
                        <div 
                          className="prose prose-sm max-w-none text-sm text-muted-foreground"
                          dangerouslySetInnerHTML={{ __html: trip.trip_info_text }}
                        />
                      </CardContent>
                    </Card>
                  )
                }
                return null
              }
              
              return (
                <Card>
                  <CardHeader className="px-3 py-2">
                    <CardTitle className="text-sm font-semibold">
                      Informacje o wyjeździe
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    {/* Co zabrać ze sobą - jako lista inputów (read-only) */}
                    {hasWhatToBring && (
                      <div className="space-y-2">
                        {parsed.whatToBring.map((item: string, index: number) => (
                          item && (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                value={item}
                                readOnly
                                disabled
                                className="text-xs bg-muted"
                              />
                            </div>
                          )
                        ))}
                      </div>
                    )}

                    {/* Świadczenia w cenie – repeater (read-only) - tylko jeśli nie ma included_in_price_text */}
                    {hasIncludedInPrice && (
                      <div className="space-y-3">
                        {parsed.includedInPrice.map((item: { id: string; title: string; content: string }, index: number) => (
                          <div key={item.id || index} className="rounded-md border p-2 space-y-1.5">
                            <Input
                              value={item.title || ""}
                              readOnly
                              disabled
                              placeholder="Tytuł (np. Zakwaterowanie)"
                              className="text-xs bg-muted"
                            />
                            <Textarea
                              value={item.content || ""}
                              readOnly
                              disabled
                              placeholder="Opis (np. 3 noclegi w hotelu *** ze śniadaniami)"
                              className="min-h-[60px] text-xs bg-muted"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })()}

            {/* Bagaż */}
            {trip.baggage_text && trip.baggage_text.trim() && (
              <Card>
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-sm font-semibold">Bagaż</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div 
                    className="prose prose-sm max-w-none text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: trip.baggage_text }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Pogoda */}
            {trip.weather_text && trip.weather_text.trim() && (
              <Card>
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-sm font-semibold">Pogoda</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div 
                    className="prose prose-sm max-w-none text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: trip.weather_text }}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Środkowa kolumna – program */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            {/* Tytuł wyjazdu, numer rezerwacji, data, czas trwania, kraj */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                {/* Tytuł wyjazdu - duży nagłówek */}
                <h1 className="text-2xl font-bold text-foreground">{trip.title}</h1>
                
                {/* Numer rezerwacji */}
                {trip.reservation_number && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Numer rezerwacji:</div>
                    <div className="text-base text-foreground">{trip.reservation_number}</div>
                  </div>
                )}

                {/* Data wyjazdu, czas trwania, kraj - większy rozmiar czcionki */}
                <div className="space-y-3 text-base">
                  {trip.start_date && trip.end_date && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Data wyjazdu:</span>
                      <span className="text-foreground">
                        {new Date(trip.start_date).toLocaleDateString("pl-PL")} – {new Date(trip.end_date).toLocaleDateString("pl-PL")}
                      </span>
                    </div>
                  )}
                  
                  {trip.duration_text && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Czas trwania:</span>
                      <span className="text-foreground">{trip.duration_text}</span>
                    </div>
                  )}

                  {trip.location && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">Kraj:</span>
                      <span className="text-foreground">{trip.location}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {trip.program_atrakcje && (
              <Card>
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-sm font-semibold">
                    Program
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-sm max-w-none text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: trip.program_atrakcje }}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Prawa kolumna – karta rezerwacji */}
          <div className="xl:col-span-3 flex flex-col gap-4">
            {/* Podgląd karty rezerwacji */}
            <Card className="border-border">
              <CardHeader className="px-3 py-2">
                <CardTitle className="text-sm font-semibold">
                  Podgląd karty rezerwacji
                </CardTitle>
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
                  {trip.show_seats_left && (
                    <span className="text-xs text-muted-foreground">
                      Na stronie będzie widoczne: {seatsLeft} miejsc
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Świadczenia w cenie */}
            {trip.included_in_price_text && (
              <Card>
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-sm font-semibold">
                    Świadczenia w cenie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-sm max-w-none text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: trip.included_in_price_text }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Dodatkowe koszty */}
            {trip.additional_costs_text && (
              <Card>
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-sm font-semibold">
                    Dodatkowe koszty
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-sm max-w-none text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: trip.additional_costs_text }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Dodatkowe świadczenie */}
            {trip.additional_service_text && (
              <Card>
                <CardHeader className="px-3 py-2">
                  <CardTitle className="text-sm font-semibold">
                    Dodatkowe świadczenie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="prose prose-sm max-w-none text-sm text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: trip.additional_service_text }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Karta rezerwacji z przyciskiem */}
            <Card className="border-border shadow-lg overflow-hidden flex flex-col self-start w-full">
              <div className="bg-primary text-primary-foreground p-3">
                <div className="text-xs uppercase tracking-wide opacity-80 mb-0.5">Cena za osobę</div>
                <div className="text-2xl font-bold font-sans">
                  {parseFloat(price).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-normal">PLN</span>
                </div>
              </div>

              <CardContent className="p-3 flex flex-col gap-3">
                {trip.show_seats_left && (
                  <>
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
                  </>
                )}

                <div className="space-y-2">
                  <Button 
                    asChild 
                    className="w-full py-3 text-sm font-semibold" 
                    size="default"
                    disabled={seatsLeft <= 0}
                  >
                    <Link href={`/trip/${trip.slug}/reserve`}>
                      {seatsLeft > 0 ? "Zarezerwuj" : "Brak wolnych miejsc"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Lightbox Dialog */}
      {galleryUrls.length > 0 && (
        <Dialog open={selectedImage !== null} onOpenChange={() => closeImage()}>
          <DialogContent className="max-w-4xl p-0 bg-black/95 border-none" showCloseButton={false}>
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
                onClick={closeImage}
              >
                <X className="w-6 h-6" />
              </Button>

              {selectedImage !== null && galleryUrls[selectedImage] && (
                <Image
                  src={galleryUrls[selectedImage]}
                  alt={`Zdjęcie ${selectedImage + 1}`}
                  width={1200}
                  height={800}
                  className="w-full h-auto max-h-[80vh] object-contain"
                />
              )}

              {galleryUrls.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20"
                    onClick={nextImage}
                  >
                    <ChevronRight className="w-8 h-8" />
                  </Button>

                  {selectedImage !== null && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
                      {selectedImage + 1} / {galleryUrls.length}
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </main>
  )
}
