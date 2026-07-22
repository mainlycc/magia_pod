"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, use } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  AzureBtnPrimary,
  AzureCard,
  ClientPanelHeader,
  ClientPanelShell,
  ClientPanelTitleAccent,
  azureClasses,
} from "@/components/client-panel"
import { cn } from "@/lib/utils"
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import {
  getAdditionalSectionContent,
  hasAdditionalSectionContent,
} from "@/lib/trip-additional-field-section"

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
  show_trip_info_card?: boolean | null
  show_baggage_card?: boolean | null
  show_weather_card?: boolean | null
  included_in_price_text: string | null
  additional_costs_text: string | null
  additional_service_text: string | null
  trip_info_text: string | null
  baggage_text: string | null
  weather_text: string | null
  reservation_number: string | null
  duration_text: string | null
  public_middle_sections?: string[] | null
  public_right_sections?: string[] | null
  public_hidden_middle_sections?: string[] | null
  public_hidden_right_sections?: string[] | null
  public_hidden_additional_sections?: string[] | null
  additional_fields?: Array<{
    id: string
    sectionTitle: string
    fields: Array<{ title: string; value: string }>
  }> | null
}

function calculateDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1 // +1 to include both start and end day
}

function stripTripNumberFromTitle(
  title: string,
  ...tripNumbers: Array<string | null | undefined>
): string {
  let result = title.trim()
  for (const tripNumber of tripNumbers) {
    const num = tripNumber?.trim()
    if (!num || !result.includes(num)) continue
    const escaped = num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    result = result
      .replace(new RegExp(`^${escaped}\\s*[-–—:|]\\s*`, "i"), "")
      .replace(new RegExp(`\\s*[-–—:|]\\s*${escaped}$`, "i"), "")
      .replace(new RegExp(`\\s+${escaped}(?=\\s|$)`, "i"), "")
      .replace(new RegExp(`(?<=^|\\s)${escaped}\\s+`, "i"), "")
      .replace(/\s{2,}/g, " ")
      .trim()
  }
  return result || title.trim()
}

function TripInfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 xl:flex-row xl:items-center xl:gap-2">
      <span className="shrink-0 font-semibold text-[#0a0a0a]">{label}</span>
      <span className="min-w-0 text-[#3f3f46]">{children}</span>
    </div>
  )
}

function TripBookingPanel({
  price,
  seatsLeft,
  showSeatsLeft,
  reserveHref,
  variant = "default",
}: {
  price: string
  seatsLeft: number
  showSeatsLeft: boolean
  reserveHref: string
  variant?: "default" | "compact"
}) {
  const formattedPrice = parseFloat(price).toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#3f3f46]">
            Cena za osobę
          </div>
          <div className={cn(azureClasses.mono, "text-xl font-semibold leading-none text-[#0a0a0a]")}>
            {formattedPrice} <span className="text-sm font-medium text-[#3f3f46]">PLN</span>
          </div>
        </div>
        <Button
          asChild
          className={cn(
            azureClasses.btnSecondary,
            "h-auto shrink-0 rounded-[14px] px-5 py-3 text-sm shadow-none",
          )}
          disabled={seatsLeft <= 0}
        >
          <Link href={reserveHref}>
            {seatsLeft > 0 ? "Zarezerwuj" : "Brak miejsc"}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className={azureClasses.pricePanel}>
        <div className="p-4 sm:p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/90">
            Cena za osobę
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={cn(
                azureClasses.mono,
                "text-[32px] font-semibold leading-none text-white sm:text-[44px]",
              )}
            >
              {formattedPrice}
            </span>
            <span className="text-base font-medium text-white/85 sm:text-lg">PLN</span>
          </div>

          {showSeatsLeft && (
            <div className="mt-4 flex items-center justify-between border-t border-white/25 pt-4">
              <span className="text-sm font-medium text-white/90">Pozostało miejsc</span>
              <span className={cn(azureClasses.mono, "text-base font-semibold text-white")}>
                {seatsLeft}
              </span>
            </div>
          )}
        </div>
      </div>

      <Button
        asChild
        className={cn(
          azureClasses.btnSecondary,
          "h-auto w-full rounded-[14px] py-3.5 text-sm shadow-none",
        )}
        disabled={seatsLeft <= 0}
      >
        <Link href={reserveHref}>
          {seatsLeft > 0 ? "Zarezerwuj" : "Brak wolnych miejsc"}
        </Link>
      </Button>
    </div>
  )
}

function TripSectionCard({
  title,
  children,
  className,
  innerClassName,
  accent = "none",
}: {
  title?: string
  children: React.ReactNode
  className?: string
  innerClassName?: string
  accent?: "blue" | "black" | "success" | "danger" | "none"
}) {
  return (
    <AzureCard
      accent={accent}
      className={className}
      innerClassName={cn("px-4 py-4 sm:px-5", innerClassName)}
    >
      {title && (
        <h2 className="mb-3 flex items-center gap-2.5 text-base font-semibold tracking-tight text-[#0a0a0a] max-xl:mb-3 xl:mb-4 xl:text-xl">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e90ff]" aria-hidden />
          {title}
        </h2>
      )}
      {children}
    </AzureCard>
  )
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
        
        // Wszystkie pola w jednym zapytaniu — unikamy cichego błędu drugiego zapytania
        const basicFields = "id,title,slug,public_slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,is_public,gallery_urls,location"
        const contentFields = "program_atrakcje,dodatkowe_swiadczenia,intro_text,section_poznaj_title,section_poznaj_description,show_seats_left,show_trip_info_card,show_baggage_card,show_weather_card,included_in_price_text,additional_costs_text,additional_service_text,trip_info_text,baggage_text,weather_text,reservation_number,duration_text,public_middle_sections,public_right_sections,public_hidden_middle_sections,public_hidden_right_sections,public_hidden_additional_sections,additional_fields"
        const allFields = `${basicFields},${contentFields}`

        async function queryTrip(fields: string, slugField: string, slugValue: string) {
          return supabase
            .from("trips")
            .select(fields)
            .eq(slugField, slugValue)
            .maybeSingle<Trip>()
        }

        // Try to find by slug first (with all fields)
        let { data: tripData, error: tripError } = await queryTrip(allFields, "slug", slug)

        if (!tripData && !tripError) {
          // Try public_slug
          const res = await queryTrip(allFields, "public_slug", slug)
          tripData = res.data
          tripError = res.error
        }

        // Jeśli zapytanie z pełnymi polami nie zadziałało (np. brak kolumny), spróbuj z podstawowymi
        if (tripError && !tripData) {
          console.warn("Full query failed, falling back to basic fields:", tripError.message)
          const { data: basicData, error: basicError } = await queryTrip(basicFields, "slug", slug)
          if (!basicData && !basicError) {
            const res = await queryTrip(basicFields, "public_slug", slug)
            tripData = res.data
            tripError = res.error
          } else {
            tripData = basicData
            tripError = basicError
          }
        }

        if (tripError) {
          console.error("Error loading trip:", tripError)
          setError(tripError)
          setLoading(false)
          return
        }

        if (!tripData) {
          setError(new Error("Trip not found"))
          setLoading(false)
          return
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
      <ClientPanelShell>
        <AzureCard accent="blue" title="Ładowanie">
          <p className="text-sm text-[#3f3f46]">Ładowanie danych wycieczki...</p>
        </AzureCard>
      </ClientPanelShell>
    )
  }

  if (error || !trip) {
    return (
      <ClientPanelShell>
        <ClientPanelHeader
          title={
            <>
              Wycieczka <ClientPanelTitleAccent>niedostępna</ClientPanelTitleAccent>
            </>
          }
          backHref="/trip"
          backLabel="Wróć do wycieczek"
        />
        <AzureCard accent="danger" title="Nie znaleziono wycieczki">
          <p className="mb-4 text-sm text-[#3f3f46]">
            Sprawdź poprawność linku lub skontaktuj się z naszym biurem podróży.
          </p>
          <AzureBtnPrimary asChild>
            <Link href="/">Wróć na stronę główną</Link>
          </AzureBtnPrimary>
        </AzureCard>
      </ClientPanelShell>
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

  const rightSections: string[] =
    (Array.isArray(trip.public_right_sections) && trip.public_right_sections.length > 0
      ? trip.public_right_sections
      : ["bookingPreview", "includedInPrice", "additionalCosts", "additionalService"])

  const hiddenRightSections: string[] =
    (Array.isArray(trip.public_hidden_right_sections) ? trip.public_hidden_right_sections : [])

  const hiddenAdditionalSections: string[] =
    (Array.isArray(trip.public_hidden_additional_sections) ? trip.public_hidden_additional_sections : [])

  const additionalFieldSections = Array.isArray(trip.additional_fields) ? trip.additional_fields : []

  const openImage = (index: number) => setSelectedImage(index)
  const closeImage = () => setSelectedImage(null)
  const nextImage = () => setSelectedImage((prev) => (prev !== null ? (prev + 1) % galleryUrls.length : null))
  const prevImage = () =>
    setSelectedImage((prev) => (prev !== null ? (prev - 1 + galleryUrls.length) % galleryUrls.length : null))

  return (
    <ClientPanelShell containerClassName="max-w-[1600px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6 max-xl:!px-4 max-xl:!py-5">
      <ClientPanelHeader
        title={stripTripNumberFromTitle(trip.title, trip.reservation_number, trip.slug)}
        backHref="/trip"
        backLabel="Wróć do wycieczek"
      />

      <div className="grid grid-cols-1 gap-4 lg:gap-6 xl:grid-cols-12 xl:items-start">
        {/* Lewa kolumna – galeria + informacje o wyjeździe */}
        <div className="contents xl:flex xl:flex-col xl:col-span-4 xl:gap-4">
          <div className="order-1 xl:order-none">
            <TripSectionCard innerClassName="pt-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative col-span-2 h-[220px] overflow-hidden rounded-xl border-2 border-dashed border-[#dadce3] group xl:h-[200px]">
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
                        <span className={cn(azureClasses.kicker, "text-[10px]")}>
                          <span className={azureClasses.kickerDot} aria-hidden />
                          Główne zdjęcie
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Camera className="w-8 h-8 text-[#a1a1aa] mx-auto mb-2" />
                        <p className="text-xs text-[#3f3f46]">Główne zdjęcie</p>
                      </div>
                    </div>
                  )}
                </div>

                {Array.from({ length: 2 }).map((_, index) => {
                  const url = galleryImages[index]
                  return (
                    <div
                      key={index}
                      className="relative h-[110px] overflow-hidden rounded-lg border-2 border-dashed border-[#dadce3] group cursor-pointer xl:h-[100px]"
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
                          <Camera className="w-4 h-4 text-[#a1a1aa]" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </TripSectionCard>
          </div>

          <div className="order-5 flex flex-col gap-4 xl:order-none">
            {trip.show_trip_info_card !== false && (() => {
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
                    <TripSectionCard title="Informacje o wyjeździe">
                      <div 
                        className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                        dangerouslySetInnerHTML={{ __html: trip.trip_info_text }}
                      />
                    </TripSectionCard>
                  )
                }
                return null
              }
              
              return (
                <TripSectionCard title="Informacje o wyjeździe">
                  <div className="space-y-4">
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
                                className="text-xs bg-[#f7f8fb]"
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
                          <div key={item.id || index} className="rounded-[14px] border border-[#dadce3] p-2 space-y-1.5">
                            <Input
                              value={item.title || ""}
                              readOnly
                              disabled
                              placeholder="Tytuł (np. Zakwaterowanie)"
                              className="text-xs bg-[#f7f8fb]"
                            />
                            <Textarea
                              value={item.content || ""}
                              readOnly
                              disabled
                              placeholder="Opis (np. 3 noclegi w hotelu *** ze śniadaniami)"
                              className="min-h-[60px] text-xs bg-[#f7f8fb]"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TripSectionCard>
              )
            })()}

            {/* Bagaż */}
            {trip.baggage_text && trip.baggage_text.trim() && trip.show_baggage_card !== false && (
              <TripSectionCard title="Bagaż">
                <div 
                  className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                  dangerouslySetInnerHTML={{ __html: trip.baggage_text }}
                />
              </TripSectionCard>
            )}

            {/* Pogoda */}
            {trip.weather_text && trip.weather_text.trim() && trip.show_weather_card !== false && (
              <TripSectionCard title="Pogoda">
                <div 
                  className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                  dangerouslySetInnerHTML={{ __html: trip.weather_text }}
                />
              </TripSectionCard>
            )}

            {/* Sekcje dodatkowe (np. Zakwaterowanie) */}
            {additionalFieldSections
              .filter((section) => !hiddenAdditionalSections.includes(section.id))
              .map((section) => {
                const content = getAdditionalSectionContent(section)
                if (!section.sectionTitle && !hasAdditionalSectionContent(section)) return null

                return (
                  <TripSectionCard key={section.id} title={section.sectionTitle || undefined}>
                    {content && (
                      <div
                        className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                        dangerouslySetInnerHTML={{ __html: content }}
                      />
                    )}
                  </TripSectionCard>
                )
              })}
          </div>
        </div>

        {/* Środkowa kolumna – dane + program */}
        <div className="contents xl:flex xl:flex-col xl:col-span-5 xl:gap-4">
          {(trip.reservation_number ||
            (trip.start_date && trip.end_date) ||
            trip.duration_text ||
            trip.location) && (
            <div className="order-2">
              <AzureCard accent="blue" innerClassName="px-4 py-4 sm:py-5">
                <div className="space-y-3 text-sm sm:text-base">
                  {trip.reservation_number && (
                    <TripInfoRow label="Numer rezerwacji:">{trip.reservation_number}</TripInfoRow>
                  )}

                  {trip.start_date && trip.end_date && (
                    <TripInfoRow label="Termin:">
                      {new Date(trip.start_date).toLocaleDateString("pl-PL")} –{" "}
                      {new Date(trip.end_date).toLocaleDateString("pl-PL")}
                    </TripInfoRow>
                  )}

                  {trip.start_date && trip.end_date && (
                    <TripInfoRow label="Dni / noce:">
                      {days > 0 ? `${days} dni / ${nights} nocy` : "W trakcie ustalania"}
                    </TripInfoRow>
                  )}

                  {trip.duration_text && (
                    <TripInfoRow label="Czas trwania:">{trip.duration_text}</TripInfoRow>
                  )}

                  {trip.location && <TripInfoRow label="Kraj:">{trip.location}</TripInfoRow>}
                </div>
              </AzureCard>
            </div>
          )}

          <div className="order-3 xl:hidden">
            <TripBookingPanel
              price={price}
              seatsLeft={seatsLeft}
              showSeatsLeft={Boolean(trip.show_seats_left)}
              reserveHref={`/trip/${trip.slug}/reserve`}
            />
          </div>

          {trip.program_atrakcje && (
            <div className="order-4">
              <TripSectionCard title="Program">
                <div
                  className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                  dangerouslySetInnerHTML={{ __html: trip.program_atrakcje }}
                />
              </TripSectionCard>
            </div>
          )}
        </div>

        {/* Prawa kolumna – sekcje + rezerwacja */}
        <div className="contents xl:flex xl:flex-col xl:col-span-3 xl:gap-4">
          <div className="order-6 flex flex-col gap-4 xl:order-none">
            {rightSections.map((sectionId) => {
              const isHidden = hiddenRightSections.includes(sectionId)

              if (sectionId === "bookingPreview") {
                return null
              }

              if (sectionId === "includedInPrice") {
                if (!trip.included_in_price_text || isHidden) return null
                return (
                  <TripSectionCard key={sectionId} title="Świadczenia w cenie">
                    <div
                      className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                      dangerouslySetInnerHTML={{ __html: trip.included_in_price_text }}
                    />
                  </TripSectionCard>
                )
              }

              if (sectionId === "additionalCosts") {
                if (!trip.additional_costs_text || isHidden) return null
                return (
                  <TripSectionCard key={sectionId} title="Dodatkowe koszty">
                    <div
                      className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                      dangerouslySetInnerHTML={{ __html: trip.additional_costs_text }}
                    />
                  </TripSectionCard>
                )
              }

              if (sectionId === "additionalService") {
                if (!trip.additional_service_text || isHidden) return null
                return (
                  <TripSectionCard key={sectionId} title="Dodatkowe świadczenie">
                    <div
                      className="prose prose-sm max-w-none text-sm text-[#3f3f46]"
                      dangerouslySetInnerHTML={{ __html: trip.additional_service_text }}
                    />
                  </TripSectionCard>
                )
              }

              return null
            })}

            <div className="hidden xl:block">
              <TripBookingPanel
                price={price}
                seatsLeft={seatsLeft}
                showSeatsLeft={Boolean(trip.show_seats_left)}
                reserveHref={`/trip/${trip.slug}/reserve`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Dialog */}
      {galleryUrls.length > 0 && (
        <Dialog open={selectedImage !== null} onOpenChange={() => closeImage()}>
          <DialogContent
            className="w-[calc(100vw-1.5rem)] max-w-[min(96vw,1400px)] border-none bg-black/95 p-0 shadow-2xl sm:max-w-[min(92vw,1400px)]"
            showCloseButton={false}
          >
            <div className="relative flex w-full items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 z-10 text-white hover:bg-white/20 sm:top-4 sm:right-4"
                    onClick={closeImage}
                  >
                    <X className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>

              {selectedImage !== null && galleryUrls[selectedImage] && (
                <Image
                  src={galleryUrls[selectedImage]}
                  alt={`Zdjęcie ${selectedImage + 1}`}
                  width={1920}
                  height={1280}
                  className="h-auto max-h-[92vh] w-full object-contain"
                  sizes="92vw"
                  priority
                />
              )}

              {galleryUrls.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 left-1 -translate-y-1/2 text-white hover:bg-white/20 sm:left-4"
                    onClick={prevImage}
                  >
                    <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-1 -translate-y-1/2 text-white hover:bg-white/20 sm:right-4"
                    onClick={nextImage}
                  >
                    <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" />
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
    </ClientPanelShell>
  )
}
