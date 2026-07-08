export type AdditionalFieldSectionData = {
  id: string
  sectionTitle: string
  fields: Array<{ title: string; value: string }>
}

export function getAdditionalSectionContent(section: AdditionalFieldSectionData): string {
  const parts = section.fields
    .map((field) => field.value?.trim() || field.title?.trim() || "")
    .filter(Boolean)

  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  return parts.join("\n\n")
}

export function setAdditionalSectionContent(
  section: AdditionalFieldSectionData,
  content: string,
): AdditionalFieldSectionData {
  return {
    ...section,
    fields: [{ title: "", value: content }],
  }
}

export function normalizeAdditionalFieldSections(
  sections: AdditionalFieldSectionData[],
): AdditionalFieldSectionData[] {
  return sections.map((section) =>
    setAdditionalSectionContent(section, getAdditionalSectionContent(section)),
  )
}

export function hasAdditionalSectionContent(section: AdditionalFieldSectionData): boolean {
  return Boolean(getAdditionalSectionContent(section).trim())
}
