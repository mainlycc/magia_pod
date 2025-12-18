"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect, use } from "react"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  CheckCircle,
  Plane,
  Hotel,
  Utensils,
  Shield,
  Headphones,
  FileText,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
  Briefcase,
  Thermometer,
  AlertCircle,
  Sparkles,
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
  reservation_info_text: string | null
  location: string | null
  category: string | null
  show_seats_left: boolean | null
  included_in_price_text: string | null
  additional_costs_text: string | null
  additional_service_text: string | null
}

function calculateDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) return 0
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays + 1 // +1 to include both start and end day
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "Termin do ustalenia"
  const start = new Date(startDate)
  const end = new Date(endDate)
  
  const startDay = start.getDate().toString().padStart(2, "0")
  const startMonth = (start.getMonth() + 1).toString().padStart(2, "0")
  const endDay = end.getDate().toString().padStart(2, "0")
  const endMonth = (end.getMonth() + 1).toString().padStart(2, "0")
  const year = start.getFullYear()
  
  return `${startDay}-${endDay}.${startMonth}.${year}`
}

function parseProgramDays(programHtml: string | null): Array<{ day: number; title: string; highlight: string }> {
  if (!programHtml || typeof window === "undefined") return []
  
  try {
    // Try to parse HTML and extract day information
    // This is a simple parser - you might want to enhance it based on your HTML structure
    const parser = new DOMParser()
    const doc = parser.parseFromString(programHtml, "text/html")
    const items = doc.querySelectorAll("li, p, div")
    
    const days: Array<{ day: number; title: string; highlight: string }> = []
    items.forEach((item, index) => {
      const text = item.textContent?.trim() || ""
      if (text && text.length > 0 && index < 6) {
        // Simple extraction - split by common patterns
        const parts = text.split(/[:\-–]/)
        const title = parts[0]?.trim() || `Dzień ${index + 1}`
        const highlight = parts.slice(1).join(" ").trim() || title
        days.push({
          day: index + 1,
          title: title.substring(0, 30), // Limit length
          highlight: highlight.substring(0, 40), // Limit length
        })
      }
    })
    
    // If no days found, create default ones
    if (days.length === 0) {
      return [
        { day: 1, title: "Przyjazd", highlight: "Transfer + zakwaterowanie" },
        { day: 2, title: "Zwiedzanie", highlight: "Program wycieczki" },
      ]
    }
    
    return days.slice(0, 6) // Limit to 6 days
  } catch (e) {
    // If parsing fails, return default
    return [
      { day: 1, title: "Przyjazd", highlight: "Transfer + zakwaterowanie" },
      { day: 2, title: "Zwiedzanie", highlight: "Program wycieczki" },
    ]
  }
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
            "id,title,slug,public_slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,is_public,gallery_urls,location,category"
          )
          .eq("slug", slug)
          .maybeSingle<Trip>()

        if (!tripData && !tripError) {
          // Try public_slug
          const { data: tripByPublicSlug, error: errorByPublicSlug } = await supabase
            .from("trips")
            .select(
              "id,title,slug,public_slug,description,start_date,end_date,price_cents,seats_total,seats_reserved,is_active,is_public,gallery_urls,location,category"
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
            .select("program_atrakcje,dodatkowe_swiadczenia,intro_text,section_poznaj_title,section_poznaj_description,reservation_info_text,show_seats_left,included_in_price_text,additional_costs_text,additional_service_text")
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
  const dateRange = formatDateRange(trip.start_date, trip.end_date)
  const galleryUrls = Array.isArray(trip.gallery_urls) ? trip.gallery_urls : []
  const mainImage = galleryUrls[0] || "/placeholder.svg"
  const galleryImages = galleryUrls.slice(1, 5) // Next 4 images for gallery grid
  
  const programDays = parseProgramDays(trip.program_atrakcje)
  
  const whatToBring = [
    "Wygodne buty do zwiedzania",
    "Strój odpowiedni do pogody",
    "Dokumenty podróży",
    "Aparat fotograficzny",
  ]

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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 xl:items-stretch">
          {/* Left Column - Bento Gallery + What to bring */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              {/* Main hero image - spans 2 columns */}
              <div
                className="col-span-2 relative rounded-xl overflow-hidden cursor-pointer group h-[140px]"
                onClick={() => openImage(0)}
              >
                <Image
                  src={mainImage}
                  alt={trip.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 1280px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-2 right-2">
                  <Badge className={`${trip.is_active ? "bg-green-500" : "bg-gray-500"} text-white text-[10px] mb-1`}>
                    {trip.is_active ? "Aktywna" : "W przygotowaniu"}
                  </Badge>
                  <h1 className="font-sans text-lg font-bold text-white leading-tight">{trip.title}</h1>
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              {/* 4 gallery images in 2x2 grid - smaller */}
              {galleryImages.map((url, index) => (
                <div
                  key={index}
                  className="relative rounded-lg overflow-hidden cursor-pointer group h-[80px]"
                  onClick={() => openImage(index + 1)}
                >
                  <Image
                    src={url}
                    alt={`Zdjęcie ${index + 2}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-110"
                    sizes="(max-width: 1280px) 50vw, 16vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
              
              {/* Fill empty slots if less than 4 images */}
              {galleryImages.length < 4 && Array.from({ length: 4 - galleryImages.length }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="relative rounded-lg overflow-hidden bg-muted h-[80px]"
                />
              ))}
            </div>

            {trip.intro_text && (
              <p className="text-muted-foreground leading-relaxed text-sm">
                {trip.intro_text}
              </p>
            )}

            <div className="bg-secondary/50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <h3 className="font-sans text-sm font-semibold text-foreground">Co zabrać ze sobą</h3>
              </div>
              <ul className="grid grid-cols-2 gap-1.5">
                {whatToBring.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                <Briefcase className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Bagaż</div>
                  <div className="text-sm font-medium text-foreground">Zgodnie z przewoźnikiem</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                <Thermometer className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Pogoda</div>
                  <div className="text-sm font-medium text-foreground">Sprawdź przed wyjazdem</div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Info + Program + Details */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            {/* Quick Info Bar */}
            <div className="flex flex-wrap gap-3 text-sm">
              {trip.start_date && trip.end_date && (
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
              {trip.location && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>{trip.location}</span>
                </div>
              )}
            </div>

            {trip.description && (
              <div className="space-y-2">
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {trip.description}
                </p>
              </div>
            )}

            {!trip.intro_text && !trip.description && (
              <p className="text-muted-foreground leading-relaxed text-sm">
                Odkryj wyjątkową podróż przygotowaną przez Magię Podróżowania. Relaks i zwiedzanie z programem obejmującym najpiękniejsze miejsca.
              </p>
            )}

            {/* Informacje o wyjeździe */}
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground mb-2">
                Informacje o wyjeździe
              </h2>
              <div className="grid grid-cols-2 gap-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>
                    {trip.start_date && trip.end_date
                      ? dateRange
                      : "Termin do ustalenia"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>
                    {days > 0
                      ? `${days} dni / ${nights} nocy`
                      : "Liczba dni w trakcie ustalania"}
                  </span>
                </div>
                {trip.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{trip.location}</span>
                  </div>
                )}
                {trip.category && (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{trip.category}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Program - Compact 2-column grid */}
            {programDays.length > 0 && (
              <div>
                <h2 className="font-sans text-sm font-semibold text-foreground mb-2">Program wycieczki</h2>
                <div className="grid grid-cols-2 gap-1.5">
                  {programDays.map((day) => (
                    <div key={day.day} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                        {day.day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-foreground text-sm">{day.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{day.highlight}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details Grid - 2x2 */}
            <div>
              <h2 className="font-sans text-sm font-semibold text-foreground mb-2">W cenie wycieczki</h2>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                  <Plane className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Transport</div>
                    <div className="text-sm font-medium text-foreground truncate">Przelot + transfery</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                  <Hotel className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Zakwaterowanie</div>
                    <div className="text-sm font-medium text-foreground truncate">Hotel {nights} nocy</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                  <Utensils className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Wyżywienie</div>
                    <div className="text-sm font-medium text-foreground truncate">Zgodnie z programem</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                  <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Ubezpieczenie</div>
                    <div className="text-sm font-medium text-foreground truncate">KL i NNW w cenie</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Services */}
            {trip.dodatkowe_swiadczenia && (
              <div>
                <h2 className="font-sans text-sm font-semibold text-foreground mb-2">Dodatkowe świadczenia</h2>
                <div 
                  className="prose prose-sm max-w-none text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: trip.dodatkowe_swiadczenia }}
                />
              </div>
            )}


            {trip.program_atrakcje && (
              <div className="bg-card rounded-xl p-3 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Hotel className="w-4 h-4 text-primary" />
                  <h3 className="font-sans text-sm font-semibold text-foreground">Program i atrakcje</h3>
                </div>
                <div 
                  className="prose prose-sm max-w-none text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: trip.program_atrakcje }}
                />
              </div>
            )}
          </div>

          {/* Right Column - Booking Card */}
          <div className="xl:col-span-3 flex flex-col">
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

                {trip.included_in_price_text && (
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1.5">Świadczenia w cenie:</div>
                    <div 
                      className="prose prose-sm max-w-none text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: trip.included_in_price_text }}
                    />
                  </div>
                )}

                {trip.additional_costs_text && (
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1.5">Dodatkowe koszty:</div>
                    <div 
                      className="prose prose-sm max-w-none text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: trip.additional_costs_text }}
                    />
                  </div>
                )}

                {trip.additional_service_text && (
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1.5">Dodatkowe świadczenie:</div>
                    <div 
                      className="prose prose-sm max-w-none text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{ __html: trip.additional_service_text }}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Button 
                    asChild 
                    className="w-full py-3 text-sm font-semibold" 
                    size="default"
                    disabled={seatsLeft <= 0}
                  >
                    <Link href={`/trip/${trip.slug}/reserve`}>
                      {seatsLeft > 0 ? "Przejdź do rezerwacji" : "Brak wolnych miejsc"}
                    </Link>
                  </Button>

                  <p className="text-xs text-center text-muted-foreground leading-tight">
                    {trip.reservation_info_text || "Do rezerwacji potrzebne będą dane kontaktowe oraz lista uczestników. Po złożeniu rezerwacji otrzymasz e-mail z potwierdzeniem i wzorem umowy."}
                  </p>
                </div>

                <div className="bg-secondary/50 rounded-lg p-2 mt-1">
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
