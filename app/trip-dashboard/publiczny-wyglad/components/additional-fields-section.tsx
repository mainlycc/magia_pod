"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { TripContentEditor } from "@/components/trip-content-editor"
import { Plus, RotateCcw, X } from "lucide-react"
import type { AdditionalFieldsSectionProps, AdditionalFieldSection } from "../types"
import { getAdditionalSectionContent, setAdditionalSectionContent } from "../utils/additional-field-section"

export function AdditionalFieldsSection({
  sections,
  onSectionsChange,
  hiddenSections,
  onHiddenSectionsChange,
}: AdditionalFieldsSectionProps) {
  const handleSectionTitleChange = (sectionId: string, newTitle: string) => {
    onSectionsChange(
      sections.map((s) => (s.id === sectionId ? { ...s, sectionTitle: newTitle } : s)),
    )
  }

  const handleSectionContentChange = (sectionId: string, content: string) => {
    onSectionsChange(
      sections.map((s) =>
        s.id === sectionId ? setAdditionalSectionContent(s, content) : s,
      ),
    )
  }

  const handleToggleSectionVisibility = (sectionId: string) => {
    if (hiddenSections.includes(sectionId)) {
      onHiddenSectionsChange(hiddenSections.filter((id) => id !== sectionId))
    } else {
      onHiddenSectionsChange([...hiddenSections, sectionId])
    }
  }

  const handleRestoreHidden = () => {
    onHiddenSectionsChange([])
  }

  const handleDeleteSection = (sectionId: string) => {
    onSectionsChange(sections.filter((s) => s.id !== sectionId))
    onHiddenSectionsChange(hiddenSections.filter((id) => id !== sectionId))
  }

  const handleAddSection = () => {
    const newSection: AdditionalFieldSection = {
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sectionTitle: "",
      fields: [{ title: "", value: "" }],
    }
    onSectionsChange([...sections, newSection])
  }

  return (
    <>
      {hiddenSections.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleRestoreHidden}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Przywróć usunięte sekcje
            </Button>
          </CardContent>
        </Card>
      )}

      {sections.map((section) => {
        const isVisible = !hiddenSections.includes(section.id)
        return (
          <Card
            key={section.id}
            className={isVisible ? "bg-green-50/50 border-green-200" : "bg-gray-50/50 border-gray-200"}
          >
            <CardHeader className="relative px-3 py-2 pr-[4.5rem]">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isVisible ? "bg-green-500" : "bg-gray-300"}`} />
                <Input
                  value={section.sectionTitle}
                  onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                  placeholder="Tytuł sekcji (np. Zakwaterowanie)..."
                  className="text-sm font-semibold border-none shadow-none px-0 h-auto"
                />
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteSection(section.id)}
                  aria-label="Usuń sekcję"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Switch
                  checked={isVisible}
                  onCheckedChange={() => handleToggleSectionVisibility(section.id)}
                  className="scale-75"
                  aria-label="Pokaż na stronie publicznej"
                />
              </div>
            </CardHeader>
            {isVisible && (
              <CardContent className="space-y-2 pt-2">
                <TripContentEditor
                  content={getAdditionalSectionContent(section)}
                  onChange={(content) => handleSectionContentChange(section.id, content)}
                  label=""
                  showToolbar={false}
                  minHeightClass="min-h-[52px]"
                  maxHeightClass="max-h-96"
                  autoGrow
                  resizable
                />
              </CardContent>
            )}
          </Card>
        )
      })}

      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" size="sm" className="w-full" onClick={handleAddSection}>
            <Plus className="h-4 w-4 mr-2" />
            Dodaj sekcję pól dodatkowych
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
