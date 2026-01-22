export type AdditionalFieldSection = {
  id: string
  sectionTitle: string
  fields: Array<{ title: string; value: string }>
}

export type MiddleSectionId = "program"

export type RightSectionId = "bookingPreview" | "includedInPrice" | "additionalCosts" | "additionalService"

export type TripData = {
  start_date: string | null
  end_date: string | null
  price_cents: number | null
  seats_total: number | null
  seats_reserved: number | null
  is_active: boolean | null
  location: string | null
  description: string | null
  category?: string | null
}

export type DragHandlers = {
  draggable: boolean
  onDragStart: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
}

// Component Props Types
export interface GalleryManagerProps {
  galleryUrls: string[]
  setGalleryUrls: (urls: string[]) => void
  tripTitle: string
  uploading: boolean
  setUploading: (uploading: boolean) => void
  addingFromUrl: boolean
  setAddingFromUrl: (adding: boolean) => void
  imageUrl: string
  setImageUrl: (url: string) => void
  selectedTrip: { id: string } | null
  isCreateMode: boolean
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  handleImageDelete: (url: string) => Promise<void>
  handleAddImageFromUrl: () => Promise<void>
}

export interface ToggleableCardProps {
  show: boolean
  onShowChange: (show: boolean) => void
  text: string
  onTextChange: (text: string) => void
  title: string
}

export interface AdditionalFieldsSectionProps {
  sections: AdditionalFieldSection[]
  onSectionsChange: (sections: AdditionalFieldSection[]) => void
  hiddenSections: string[]
  onHiddenSectionsChange: (hidden: string[]) => void
}

export interface TripTitleSectionProps {
  tripTitle: string
  reservationNumber: string
  onReservationNumberChange: (value: string) => void
  durationText: string
  onDurationTextChange: (value: string) => void
  tripData: TripData | null
}

export interface ProgramSectionProps {
  content: string
  onChange: (content: string) => void
  dragHandlers: DragHandlers
}

export interface BookingPreviewCardProps {
  price: string
  seatsLeft: number
  showSeatsLeft: boolean
  onShowSeatsLeftChange: (show: boolean) => void
  dragHandlers: DragHandlers
}

export interface IncludedInPriceCardProps {
  content: string
  onChange: (content: string) => void
  dragHandlers: DragHandlers
}

export interface AdditionalCostsCardProps {
  text: string
  onChange: (text: string) => void
  isVisible: boolean
  onVisibilityChange: (visible: boolean) => void
  dragHandlers: DragHandlers
}

export interface AdditionalServiceCardProps {
  text: string
  onChange: (text: string) => void
  isVisible: boolean
  onVisibilityChange: (visible: boolean) => void
  dragHandlers: DragHandlers
}
