"use client"

import { Suspense } from "react"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TripCreationProgress } from "@/components/trip-creation-progress"
import { Loader2 } from "lucide-react"
import { useTripPublicAppearance } from "./hooks/use-trip-public-appearance"
import { GalleryManager } from "./components/gallery-manager"
import { TripInfoCard } from "./components/trip-info-card"
import { BaggageCard } from "./components/baggage-card"
import { WeatherCard } from "./components/weather-card"
import { AdditionalFieldsSection } from "./components/additional-fields-section"
import { TripTitleSection } from "./components/trip-title-section"
import { ProgramSection } from "./components/program-section"
import { BookingPreviewCard } from "./components/booking-preview-card"
import { IncludedInPriceCard } from "./components/included-in-price-card"
import { AdditionalCostsCard } from "./components/additional-costs-card"
import { AdditionalServiceCard } from "./components/additional-service-card"

function PublicznyWygladContent() {
  const {
    isCreateMode,
    selectedTrip,
    router,
    loading,
    saving,
    uploading,
    addingFromUrl,
    galleryUrls,
    setGalleryUrls,
    imageUrl,
    setImageUrl,
    handleImageUpload,
    handleImageDelete,
    handleAddImageFromUrl,
    tripTitle,
    tripData,
    reservationNumber,
    setReservationNumber,
    durationText,
    setDurationText,
    programAtrakcje,
    setProgramAtrakcje,
    tripInfoText,
    setTripInfoText,
    baggageText,
    setBaggageText,
    weatherText,
    setWeatherText,
    showTripInfoConfigCard,
    setShowTripInfoConfigCard,
    showBaggageCard,
    setShowBaggageCard,
    showWeatherCard,
    setShowWeatherCard,
    showSeatsLeft,
    setShowSeatsLeft,
    includedInPriceText,
    setIncludedInPriceText,
    additionalCostsText,
    setAdditionalCostsText,
    additionalServiceText,
    setAdditionalServiceText,
    additionalFieldSections,
    setAdditionalFieldSections,
    hiddenAdditionalSections,
    setHiddenAdditionalSections,
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
    handleSave,
  } = useTripPublicAppearance()

  if (!isCreateMode && !selectedTrip) {
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

  const price = tripData?.price_cents
    ? (tripData.price_cents / 100).toFixed(2)
    : "0"
  const seatsLeft = tripData
    ? Math.max(0, (tripData.seats_total ?? 0) - (tripData.seats_reserved ?? 0))
    : 0

  return (
    <div className="space-y-6">
      {isCreateMode && <TripCreationProgress currentStep={2} />}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 xl:items-start">
        {/* Lewa kolumna – galeria + informacje o wyjeździe */}
        <div className="xl:col-span-4 flex flex-col gap-4">
          <GalleryManager
            galleryUrls={galleryUrls}
            setGalleryUrls={setGalleryUrls}
            tripTitle={tripTitle}
            uploading={uploading}
            setUploading={() => {}}
            addingFromUrl={addingFromUrl}
            setAddingFromUrl={() => {}}
            imageUrl={imageUrl}
            setImageUrl={setImageUrl}
            selectedTrip={selectedTrip}
            isCreateMode={isCreateMode}
            handleImageUpload={handleImageUpload}
            handleImageDelete={handleImageDelete}
            handleAddImageFromUrl={handleAddImageFromUrl}
            onReorder={(urls) => {
              setGalleryUrls(urls)
              // W trybie edycji zapisz od razu nową kolejność do bazy
              if (!isCreateMode && selectedTrip) {
                void fetch(`/api/trips/${selectedTrip.id}/content`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ gallery_urls: urls }),
                })
              }
            }}
          />

          <TripInfoCard
            show={showTripInfoConfigCard}
            onShowChange={setShowTripInfoConfigCard}
            text={tripInfoText}
            onTextChange={setTripInfoText}
            title="Informacje o wyjeździe"
          />

          <BaggageCard
            show={showBaggageCard}
            onShowChange={setShowBaggageCard}
            text={baggageText}
            onTextChange={setBaggageText}
            title="Bagaż"
          />

          <WeatherCard
            show={showWeatherCard}
            onShowChange={setShowWeatherCard}
            text={weatherText}
            onTextChange={setWeatherText}
            title="Pogoda"
          />

          <AdditionalFieldsSection
            sections={additionalFieldSections}
            onSectionsChange={setAdditionalFieldSections}
            hiddenSections={hiddenAdditionalSections}
            onHiddenSectionsChange={setHiddenAdditionalSections}
          />
        </div>

        {/* Środkowa kolumna – opis, informacje o wyjeździe, program */}
        <div className="xl:col-span-5 flex flex-col gap-4">
          <TripTitleSection
            tripTitle={tripTitle}
            reservationNumber={reservationNumber}
            onReservationNumberChange={setReservationNumber}
            durationText={durationText}
            onDurationTextChange={setDurationText}
            tripData={tripData}
          />

          {middleSections.map((sectionId) => {
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

            return (
              <ProgramSection
                key={sectionId}
                content={programAtrakcje}
                onChange={setProgramAtrakcje}
                dragHandlers={dragHandlers}
              />
            )
          })}
        </div>

        {/* Prawa kolumna – karta rezerwacji / tekst informacyjny (drag & drop) */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          {rightSections.map((sectionId) => {
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

            // Tylko dla opcjonalnych sekcji (additionalCosts i additionalService)
            const isVisible = !hiddenRightSections.includes(sectionId)
            const toggleVisibility = (visible: boolean) => {
              if (visible) {
                setHiddenRightSections((prev) => prev.filter(id => id !== sectionId))
              } else {
                setHiddenRightSections((prev) => [...prev, sectionId])
              }
            }

            if (sectionId === "bookingPreview") {
              return (
                <BookingPreviewCard
                  key={sectionId}
                  price={price}
                  seatsLeft={seatsLeft}
                  showSeatsLeft={showSeatsLeft}
                  onShowSeatsLeftChange={setShowSeatsLeft}
                  dragHandlers={dragHandlers}
                />
              )
            }

            if (sectionId === "includedInPrice") {
              return (
                <IncludedInPriceCard
                  key={sectionId}
                  content={includedInPriceText}
                  onChange={setIncludedInPriceText}
                  dragHandlers={dragHandlers}
                />
              )
            }

            if (sectionId === "additionalCosts") {
              return (
                <AdditionalCostsCard
                  key={sectionId}
                  text={additionalCostsText}
                  onChange={setAdditionalCostsText}
                  isVisible={isVisible}
                  onVisibilityChange={toggleVisibility}
                  dragHandlers={dragHandlers}
                />
              )
            }

            if (sectionId === "additionalService") {
              return (
                <AdditionalServiceCard
                  key={sectionId}
                  text={additionalServiceText}
                  onChange={setAdditionalServiceText}
                  isVisible={isVisible}
                  onVisibilityChange={toggleVisibility}
                  dragHandlers={dragHandlers}
                />
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
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Zapisywanie...
            </>
          ) : isCreateMode ? (
            "Zapisz i przejdź dalej"
          ) : (
            "Zapisz zmiany"
          )}
        </Button>
      </div>
    </div>
  )
}

export default function PublicznyWygladPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <PublicznyWygladContent />
    </Suspense>
  )
}
