"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Upload, X, Link as LinkIcon, Camera } from "lucide-react"
import Image from "next/image"
import type { GalleryManagerProps } from "../types"

export function GalleryManager({
  galleryUrls,
  tripTitle,
  uploading,
  addingFromUrl,
  imageUrl,
  setImageUrl,
  handleImageUpload,
  handleImageDelete,
  handleAddImageFromUrl,
  onReorder,
}: GalleryManagerProps) {
  const mainImage = galleryUrls[0] || "/placeholder.svg"
  const galleryImages = galleryUrls.slice(1, 3)

  const handleReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const next = [...galleryUrls]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    onReorder(next)
  }

  return (
    <Card className="bg-green-50/50 border-green-200">
      <CardHeader className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <CardTitle className="text-sm font-semibold">
            Informacje o wyjeździe i galeria
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <div
            className="col-span-2 relative rounded-xl overflow-hidden group h-[200px] border-2 border-dashed border-muted-foreground/20"
            draggable={!!galleryUrls[0] && galleryUrls.length > 1}
            onDragStart={(e) => {
              if (!galleryUrls[0]) return
              e.dataTransfer.setData("text/plain", "0")
            }}
            onDragOver={(e) => {
              if (!galleryUrls[0]) return
              e.preventDefault()
            }}
            onDrop={(e) => {
              if (!galleryUrls[0]) return
              e.preventDefault()
              const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10)
              if (Number.isNaN(fromIndex)) return
              handleReorder(fromIndex, 0)
            }}
          >
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
            const targetIndex = index + 1
            return (
              <div
                key={index}
                className="relative rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/20 h-[100px] group"
                draggable={!!url}
                onDragStart={(e) => {
                  if (!url) return
                  e.dataTransfer.setData("text/plain", String(targetIndex))
                }}
                onDragOver={(e) => {
                  if (!url) return
                  e.preventDefault()
                }}
                onDrop={(e) => {
                  if (!url) return
                  e.preventDefault()
                  const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10)
                  if (Number.isNaN(fromIndex)) return
                  handleReorder(fromIndex, targetIndex)
                }}
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
  )
}
