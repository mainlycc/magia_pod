"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { X, Plus, RotateCcw } from "lucide-react"
import type { AdditionalFieldsSectionProps, AdditionalFieldSection } from "../types"

export function AdditionalFieldsSection({
  sections,
  onSectionsChange,
  hiddenSections,
  onHiddenSectionsChange,
}: AdditionalFieldsSectionProps) {
  const handleSectionTitleChange = (sectionId: string, newTitle: string) => {
    onSectionsChange(
      sections.map(s => (s.id === sectionId ? { ...s, sectionTitle: newTitle } : s))
    )
  }

  const handleToggleSectionVisibility = (sectionId: string) => {
    if (hiddenSections.includes(sectionId)) {
      onHiddenSectionsChange(hiddenSections.filter(id => id !== sectionId))
    } else {
      onHiddenSectionsChange([...hiddenSections, sectionId])
    }
  }

  const handleRestoreHidden = () => {
    onHiddenSectionsChange([])
  }

  const handleFieldTitleChange = (sectionId: string, fieldIndex: number, newTitle: string) => {
    onSectionsChange(
      sections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f, i) => (i === fieldIndex ? { ...f, title: newTitle } : f))
            }
          : s
      )
    )
  }

  const handleFieldValueChange = (sectionId: string, fieldIndex: number, newValue: string) => {
    onSectionsChange(
      sections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              fields: s.fields.map((f, i) => (i === fieldIndex ? { ...f, value: newValue } : f))
            }
          : s
      )
    )
  }

  const handleRemoveField = (sectionId: string, fieldIndex: number) => {
    onSectionsChange(
      sections.map(s =>
        s.id === sectionId ? { ...s, fields: s.fields.filter((_, i) => i !== fieldIndex) } : s
      )
    )
  }

  const handleAddField = (sectionId: string) => {
    onSectionsChange(
      sections.map(s =>
        s.id === sectionId ? { ...s, fields: [...s.fields, { title: "", value: "" }] } : s
      )
    )
  }

  const handleAddSection = () => {
    const newSection: AdditionalFieldSection = {
      id: `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sectionTitle: "",
      fields: [{ title: "", value: "" }]
    }
    onSectionsChange([...sections, newSection])
  }

  return (
    <>
      {/* Przycisk przywracania ukrytych sekcji */}
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

      {/* Pola dodatkowe - sekcje */}
      {sections.map((section) => {
        const isVisible = !hiddenSections.includes(section.id)
        return (
          <Card key={section.id} className={isVisible ? "bg-green-50/50 border-green-200" : "bg-gray-50/50 border-gray-200"}>
            <CardHeader className="relative px-3 py-2 pr-12">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isVisible ? 'bg-green-500' : 'bg-gray-300'}`} />
                <Input
                  value={section.sectionTitle}
                  onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                  placeholder="Tytuł sekcji (np. Bagaż)..."
                  className="text-sm font-semibold border-none shadow-none px-0 h-auto"
                />
              </div>
              <div className="absolute top-2 right-2">
                <Switch 
                  checked={isVisible}
                  onCheckedChange={() => handleToggleSectionVisibility(section.id)}
                  className="scale-75"
                />
              </div>
            </CardHeader>
            {isVisible && (
              <CardContent className="space-y-3 pt-2">
              {section.fields.map((field, fieldIndex) => (
                <div key={fieldIndex} className="space-y-2 p-3 border rounded-lg">
                  <div className="flex items-center justify-between gap-2">
                    <Input
                      value={field.title}
                      onChange={(e) => handleFieldTitleChange(section.id, fieldIndex, e.target.value)}
                      placeholder="Tytuł pola..."
                      className="text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveField(section.id, fieldIndex)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={field.value}
                    onChange={(e) => handleFieldValueChange(section.id, fieldIndex, e.target.value)}
                    placeholder="Wartość..."
                    className="text-xs"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleAddField(section.id)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Dodaj pole
              </Button>
              </CardContent>
            )}
          </Card>
        )
      })}

      {/* Przycisk dodawania nowej sekcji */}
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={handleAddSection}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj sekcję pól dodatkowych
          </Button>
        </CardContent>
      </Card>
    </>
  )
}
