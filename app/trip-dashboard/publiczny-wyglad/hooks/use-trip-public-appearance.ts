"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTrip } from "@/contexts/trip-context"
import { toast } from "sonner"
import type { AdditionalFieldSection, MiddleSectionId, RightSectionId, TripData } from "../types"

export function useTripPublicAppearance() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCreateMode = searchParams.get("mode") === "create"
  const { selectedTrip, tripFullData, tripContentData, isLoadingTripData, invalidateTripCache } = useTrip()

  // Stan ładowania i zapisywania
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [addingFromUrl, setAddingFromUrl] = useState(false)

  // Treści i dane
  const [imageUrl, setImageUrl] = useState("")
  const [programAtrakcje, setProgramAtrakcje] = useState("")
  const [dodatkoweSwiadczenia, setDodatkoweSwiadczenia] = useState("")
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [tripTitle, setTripTitle] = useState("")
  const [introText, setIntroText] = useState("")
  const [sectionPoznajTitle, setSectionPoznajTitle] = useState("")
  const [sectionPoznajDescription, setSectionPoznajDescription] = useState("")
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
  const [reservationNumber, setReservationNumber] = useState("")
  const [durationText, setDurationText] = useState("")
  const [additionalFieldSections, setAdditionalFieldSections] = useState<AdditionalFieldSection[]>([])
  const [hiddenAdditionalSections, setHiddenAdditionalSections] = useState<string[]>([])
  const [whatToBring, setWhatToBring] = useState<string[]>([])
  const [includedInPrice, setIncludedInPrice] = useState<
    { id: string; title: string; content: string }[]
  >([])

  // Drag & drop i widoczność sekcji
  const [middleSections, setMiddleSections] = useState<MiddleSectionId[]>(["program"])
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
  const [tripData, setTripData] = useState<TripData | null>(null)

  // W trybie tworzenia sprawdź czy są dane z kroku 1
  useEffect(() => {
    if (isCreateMode) {
      if (typeof window !== "undefined") {
        const step1Data = localStorage.getItem("tripCreation_step1")
        if (!step1Data) {
          toast.error("Najpierw uzupełnij informacje ogólne")
          router.push("/trip-dashboard/dodaj-wycieczke")
          return
        }
        
        try {
          const data = JSON.parse(step1Data)
          setTripTitle(data.tripTitle || "")
          setTripData({
            start_date: data.startDate || null,
            end_date: data.endDate || null,
            price_cents: data.price ? Math.round(parseFloat(data.price) * 100) : null,
            seats_total: data.seats ? parseInt(data.seats) : 0,
            seats_reserved: 0,
            is_active: true,
            location: data.location || null,
            description: data.description || null,
            category: data.category || null,
          })
        } catch (e) {
          console.error("Error loading step1 data:", e)
          toast.error("Błąd wczytywania danych")
          router.push("/trip-dashboard/dodaj-wycieczke")
          return
        }
      }
      setLoading(false)
      return
    }
  }, [isCreateMode, router])

  // Użyj cache'owanych danych z kontekstu (tylko w trybie edycji)
  useEffect(() => {
    if (isCreateMode) return
    
    if (!selectedTrip) {
      setLoading(false)
      return
    }

    if (tripFullData && tripContentData && tripFullData.id === selectedTrip.id) {
      const content = tripContentData as typeof tripContentData & {
        public_middle_sections?: MiddleSectionId[] | null
        public_right_sections?: RightSectionId[] | null
        public_hidden_middle_sections?: MiddleSectionId[] | null
        public_hidden_right_sections?: RightSectionId[] | null
        public_hidden_additional_sections?: string[] | null
      }
      const trip = tripFullData
      
      setProgramAtrakcje(content.program_atrakcje || "")
      setDodatkoweSwiadczenia(content.dodatkowe_swiadczenia || "")
      setGalleryUrls((content.gallery_urls || []).slice(0, 3))
      setIntroText(content.intro_text || "")
      setSectionPoznajTitle(content.section_poznaj_title || "")
      setSectionPoznajDescription(content.section_poznaj_description || "")
      setTripInfoText(content.trip_info_text || "")
      setBaggageText(content.baggage_text || "")
      setWeatherText(content.weather_text || "")
      setShowTripInfoConfigCard(content.show_trip_info_card ?? true)
      setShowBaggageCard(content.show_baggage_card ?? true)
      setShowWeatherCard(content.show_weather_card ?? true)
      setShowSeatsLeft(content.show_seats_left ?? false)
      setIncludedInPriceText(content.included_in_price_text || "")
      setAdditionalCostsText(content.additional_costs_text || "")
      setAdditionalServiceText(content.additional_service_text || "")
      setReservationNumber(content.reservation_number || "")
      setDurationText(content.duration_text || "")
      
      if (content.additional_fields && Array.isArray(content.additional_fields)) {
        if (content.additional_fields.length > 0 && 'sectionTitle' in content.additional_fields[0]) {
          setAdditionalFieldSections(content.additional_fields as AdditionalFieldSection[])
        } else {
          const oldFields = (content.additional_fields as unknown) as Array<{ title: string; value: string }>
          if (oldFields.length > 0) {
            setAdditionalFieldSections([{
              id: `section-${Date.now()}`,
              sectionTitle: "Pola dodatkowe",
              fields: oldFields
            }])
          } else {
            setAdditionalFieldSections([])
          }
        }
      } else {
        setAdditionalFieldSections([])
      }

      // Layout i widoczność sekcji (z bazy lub domyślne)
      setMiddleSections(
        (content.public_middle_sections as MiddleSectionId[] | null) ?? ["program"]
      )
      setRightSections(
        (content.public_right_sections as RightSectionId[] | null) ?? [
          "bookingPreview",
          "includedInPrice",
          "additionalCosts",
          "additionalService",
        ]
      )
      setHiddenMiddleSections(
        (content.public_hidden_middle_sections as MiddleSectionId[] | null) ?? []
      )
      setHiddenRightSections(
        (content.public_hidden_right_sections as RightSectionId[] | null) ?? []
      )
      setHiddenAdditionalSections(content.public_hidden_additional_sections ?? [])
      
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
      setLoading(false)
    } else if (isLoadingTripData) {
      setLoading(true)
    } else {
      setLoading(false)
    }
  }, [selectedTrip, tripFullData, tripContentData, isLoadingTripData, isCreateMode])

  const handleSave = async () => {
    if (isCreateMode) {
      try {
        setSaving(true)
        const step2Data = {
          programAtrakcje,
          dodatkoweSwiadczenia,
          galleryUrls,
          introText,
          sectionPoznajTitle,
          sectionPoznajDescription,
          tripInfoText,
          baggageText,
          weatherText,
          showTripInfoConfigCard,
          showBaggageCard,
        showWeatherCard,
          showSeatsLeft,
          includedInPriceText,
          additionalCostsText,
          additionalServiceText,
          reservationNumber,
          durationText,
          additionalFieldSections,
        }
        localStorage.setItem("tripCreation_step2", JSON.stringify(step2Data))
        toast.success("Dane zostały zapisane")
        router.push("/trip-dashboard/informacje/formularz?mode=create")
      } catch (err) {
        toast.error("Nie udało się zapisać danych")
        setSaving(false)
      }
      return
    }

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
          trip_info_text: tripInfoText,
          baggage_text: baggageText,
          weather_text: weatherText,
          show_trip_info_card: showTripInfoConfigCard,
          show_baggage_card: showBaggageCard,
          show_weather_card: showWeatherCard,
          show_seats_left: showSeatsLeft,
          included_in_price_text: includedInPriceText,
          additional_costs_text: additionalCostsText,
          additional_service_text: additionalServiceText,
          reservation_number: reservationNumber,
          duration_text: durationText,
          additional_fields: additionalFieldSections,
          public_middle_sections: middleSections,
          public_right_sections: rightSections,
          public_hidden_middle_sections: hiddenMiddleSections,
          public_hidden_right_sections: hiddenRightSections,
          public_hidden_additional_sections: hiddenAdditionalSections,
        }),
      })

      if (res.ok) {
        invalidateTripCache()
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

  return {
    // Context i routing
    isCreateMode,
    selectedTrip,
    router,
    
    // Status stanu
    loading,
    saving,
    uploading,
    addingFromUrl,
    
    // Gallery
    galleryUrls,
    setGalleryUrls,
    imageUrl,
    setImageUrl,
    handleImageUpload,
    handleImageDelete,
    handleAddImageFromUrl,
    
    // Dane wycieczki
    tripTitle,
    setTripTitle,
    tripData,
    setTripData,
    reservationNumber,
    setReservationNumber,
    durationText,
    setDurationText,
    
    // Treści tekstowe
    programAtrakcje,
    setProgramAtrakcje,
    dodatkoweSwiadczenia,
    setDodatkoweSwiadczenia,
    introText,
    setIntroText,
    sectionPoznajTitle,
    setSectionPoznajTitle,
    sectionPoznajDescription,
    setSectionPoznajDescription,
    tripInfoText,
    setTripInfoText,
    baggageText,
    setBaggageText,
    weatherText,
    setWeatherText,
    includedInPriceText,
    setIncludedInPriceText,
    additionalCostsText,
    setAdditionalCostsText,
    additionalServiceText,
    setAdditionalServiceText,
    
    // Widoczność kart
    showTripInfoConfigCard,
    setShowTripInfoConfigCard,
    showBaggageCard,
    setShowBaggageCard,
    showWeatherCard,
    setShowWeatherCard,
    showSeatsLeft,
    setShowSeatsLeft,
    
    // Pola dodatkowe
    additionalFieldSections,
    setAdditionalFieldSections,
    hiddenAdditionalSections,
    setHiddenAdditionalSections,
    whatToBring,
    setWhatToBring,
    includedInPrice,
    setIncludedInPrice,
    
    // Drag & drop sekcji
    middleSections,
    setMiddleSections,
    rightSections,
    setRightSections,
    hiddenMiddleSections,
    setHiddenMiddleSections,
    hiddenRightSections,
    setHiddenRightSections,
    draggingMiddle,
    setDraggingMiddle,
    draggingRight,
    setDraggingRight,
    
    // Actions
    handleSave,
  }
}
