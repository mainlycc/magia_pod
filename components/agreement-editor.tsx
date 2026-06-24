"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { TripContentEditor, type TripContentEditorHandle } from "@/components/trip-content-editor";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AgreementTemplate, AgreementSection, AgreementField } from "@/lib/agreement-template-parser";
import { resolveRichTextContent } from "@/lib/agreements/rich-text-html";

interface AgreementEditorProps {
  template: AgreementTemplate;
  onChange: (template: AgreementTemplate) => void;
  onSave: (template: AgreementTemplate) => void;
  saving?: boolean;
}

// Lista placeholderów, które są automatycznie wypełniane z danych formularza/wycieczki
const AUTO_FILLED_PLACEHOLDERS = [
  // Dane zgłaszającego
  'contact_first_name',
  'contact_last_name',
  'contact_full_name',
  'contact_address',
  'contact_street',
  'contact_city',
  'contact_zip',
  'contact_pesel',
  'contact_phone',
  'contact_email',
  // Dane firmy
  'company_name',
  'company_nip',
  'company_address',
  // Dane uczestników
  'participants_count',
  'participants_list',
  // Informacje o wycieczce
  'trip_title',
  'trip_location',
  'trip_start_date',
  'trip_end_date',
  'trip_duration',
  'trip_price_per_person',
  'trip_total_price',
  'trip_deposit_amount',
  'trip_deposit_deadline',
  'trip_final_payment_deadline',
  'reservation_number',
  'nights_count',
  'accommodation_location',
  'room_type',
  'meals_info',
  'transfer_info',
  'insurance_scope',
  'transport_type',
  'flight_info',
  'baggage_info',
  'additional_services',
  'additional_costs',
  // Usługi
  'selected_services',
];

// Funkcja sprawdzająca, czy wartość pola zawiera automatycznie wypełniany placeholder
function hasAutoFilledPlaceholder(value: string): boolean {
  if (!value) return false;
  
  // Sprawdź, czy wartość zawiera którykolwiek z automatycznie wypełnianych placeholderów
  return AUTO_FILLED_PLACEHOLDERS.some(placeholder => 
    value.includes(`{{${placeholder}}}`)
  );
}

// Funkcja sprawdzająca, czy pole wymaga ręcznego wypełnienia
// Pole wymaga ręcznego wypełnienia, jeśli:
// 1. Jest puste (trzeba ręcznie wpisać wartość)
// 2. Nie zawiera automatycznie wypełnianych placeholderów (zawiera zwykły tekst lub ręczne placeholdery)
function requiresManualFill(value: string): boolean {
  // Jeśli pole jest puste, wymaga ręcznego wypełnienia
  if (!value || value.trim() === '') return true;
  
  // Jeśli pole zawiera automatycznie wypełniany placeholder, nie wymaga ręcznego wypełnienia
  if (hasAutoFilledPlaceholder(value)) return false;
  
  // Jeśli pole nie zawiera żadnego automatycznie wypełnianego placeholderu,
  // to wymaga ręcznego wypełnienia (zawiera zwykły tekst lub ręczne placeholdery)
  return true;
}

// Komponent sortowalnego pola wewnątrz sekcji typu 'table'
function SortableField({
  field,
  sectionId,
  onUpdate,
  onDelete,
}: {
  field: AgreementField;
  sectionId: string;
  onUpdate: (field: AgreementField) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `${sectionId}-${field.id}`, // Unikalne ID z prefiksem sectionId
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const needsManualFill = requiresManualFill(field.value);

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-2 gap-3 items-start">
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-move p-1 hover:bg-muted rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          value={field.label}
          onChange={(e) => {
            onUpdate({ ...field, label: e.target.value });
          }}
          placeholder="Etykieta pola..."
          className={`text-sm flex-1 ${needsManualFill ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
        />
      </div>
      <div className="flex gap-2">
        <Input
          value={field.value}
          onChange={(e) => {
            onUpdate({ ...field, value: e.target.value });
          }}
          placeholder="Wartość lub {{placeholder}}..."
          className={`text-sm flex-1 ${needsManualFill ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Funkcja sprawdzająca czy sekcja jest systemowa (nieedytowalna)
function isSystemSection(section: AgreementSection): boolean {
  if (section.type === 'paragraph' && section.content) {
    const content = section.content.toLowerCase();
    return (
      content.includes('organizator imprezy turystycznej') ||
      content.includes('podpis klienta') ||
      content.includes('................................') ||
      content === '................................' ||
      content.trim() === 'podpis klienta' ||
      content.includes('imprezy samolotowe')
    );
  }
  if (section.type === 'list' && section.content) {
    const content = section.content.toLowerCase();
    return content.includes('imprezy samolotowe');
  }
  if (section.title && section.title.toLowerCase().includes('imprezy samolotowe')) {
    return true;
  }
  return false;
}

function isRichTextSection(section: AgreementSection): boolean {
  return section.type === "paragraph" || section.type === "list" || section.type === "title";
}

function SortableSection({
  section,
  onUpdate,
  onDelete,
  onRegisterEditor,
}: {
  section: AgreementSection;
  onUpdate: (section: AgreementSection) => void;
  onDelete: () => void;
  onRegisterEditor: (sectionId: string, handle: TripContentEditorHandle | null) => void;
}) {
  const isSystem = isSystemSection(section);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const editorRef = useRef<TripContentEditorHandle | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: section.id,
    // Usunięto disabled - sekcje systemowe też mogą być przeciągane
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Sensory dla zagnieżdżonego DndContext (pola w sekcji)
  const fieldSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && section.fields) {
      // Wyciągnij field.id z unikalnego ID (format: sectionId-fieldId)
      const activeFieldId = String(active.id).replace(`${section.id}-`, '');
      const overFieldId = String(over.id).replace(`${section.id}-`, '');

      const oldIndex = section.fields.findIndex((field) => field.id === activeFieldId);
      const newIndex = section.fields.findIndex((field) => field.id === overFieldId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFields = arrayMove(section.fields, oldIndex, newIndex);
        onUpdate({ ...section, fields: newFields });
      }
    }
  };

  const handleFieldUpdate = (updatedField: AgreementField) => {
    if (section.fields) {
      const updatedFields = section.fields.map((field) =>
        field.id === updatedField.id ? updatedField : field
      );
      onUpdate({ ...section, fields: updatedFields });
    }
  };

  const handleAddField = () => {
    if (section.type === 'table') {
      const newField: AgreementField = {
        id: `field-${Date.now()}`,
        label: '',
        value: '',
        type: 'text',
      };
      onUpdate({
        ...section,
        fields: [...(section.fields || []), newField],
      });
    }
  };

  const handleDeleteField = (fieldId: string) => {
    if (section.fields) {
      const updatedFields = section.fields.filter((field) => field.id !== fieldId);
      onUpdate({ ...section, fields: updatedFields });
    }
  };

  const handleContentChange = (content: string) => {
    const base = sectionRef.current;
    const nextType = base.type === "title" ? "paragraph" : base.type;
    onUpdate({ ...base, type: nextType, content });
  };

  const editorCallbackRef = useCallback(
    (handle: TripContentEditorHandle | null) => {
      editorRef.current = handle;
      onRegisterEditor(section.id, handle);
    },
    [onRegisterEditor, section.id],
  );

  return (
    <Card ref={setNodeRef} style={style} className={`mb-4 ${isSystem ? 'bg-muted/30' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {!isSystem && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-move p-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          {isSystem && (
            <div className="p-1">
              <div className="h-4 w-4" /> {/* Placeholder dla wyrównania */}
            </div>
          )}
          {isSystem ? (
            <div className="font-semibold flex-1 text-muted-foreground text-sm">
              Sekcja systemowa
            </div>
          ) : (
            <Input
              value={section.title}
              onChange={(e) => onUpdate({ ...section, title: e.target.value })}
              placeholder={section.type === 'table' ? "Tytuł sekcji (np. Dane Zgłaszającego)..." : "Tytuł sekcji (opcjonalnie)..."}
              className="font-semibold flex-1"
            />
          )}
          {!isSystem && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {section.type === 'table' && section.fields && (
          <DndContext
            sensors={fieldSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleFieldDragEnd}
          >
            <SortableContext
              items={section.fields.map((field) => `${section.id}-${field.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {section.fields.map((field) => (
                  <SortableField
                    key={field.id}
                    field={field}
                    sectionId={section.id}
                    onUpdate={handleFieldUpdate}
                    onDelete={() => handleDeleteField(field.id)}
                  />
                ))}
              </div>
            </SortableContext>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddField}
              className="w-full mt-3"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj pole
            </Button>
          </DndContext>
        )}
        
        {(section.type === "paragraph" || section.type === "title") && (
          <TripContentEditor
            ref={editorCallbackRef}
            content={section.content || ""}
            onChange={handleContentChange}
            label="Treść paragrafu"
          />
        )}

        {section.type === "list" && (
          <TripContentEditor
            ref={editorCallbackRef}
            content={section.content || ""}
            onChange={handleContentChange}
            label="Elementy listy"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function AgreementEditor({
  template,
  onChange,
  onSave,
  saving = false,
}: AgreementEditorProps) {
  const [localTemplate, setLocalTemplate] = useState<AgreementTemplate>(template);
  const localTemplateRef = useRef(localTemplate);
  const editorRefs = useRef<Map<string, TripContentEditorHandle>>(new Map());

  localTemplateRef.current = localTemplate;

  const registerEditor = useCallback((sectionId: string, handle: TripContentEditorHandle | null) => {
    if (handle) {
      editorRefs.current.set(sectionId, handle);
    } else {
      editorRefs.current.delete(sectionId);
    }
  }, []);

  const buildTemplateForSave = useCallback((): AgreementTemplate => {
    const sections = localTemplateRef.current.sections.map((section) => {
      if (!isRichTextSection(section)) return section;

      const editorHandle = editorRefs.current.get(section.id);
      const editorHtml = editorHandle?.getHtml();
      const content = resolveRichTextContent(section.content, editorHtml);

      return {
        ...section,
        type: section.type === "title" ? "paragraph" : section.type,
        content,
      };
    });

    const nextTemplate = { ...localTemplateRef.current, sections };
    localTemplateRef.current = nextTemplate;
    setLocalTemplate(nextTemplate);
    onChange(nextTemplate);
    return nextTemplate;
  }, [onChange]);

  // Wczytaj szablon z zewnątrz (pierwsze ładowanie / zapis) — nie przy każdym znaku w edytorze.
  useEffect(() => {
    setLocalTemplate(template);
    localTemplateRef.current = template;
  }, [template]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalTemplate((prev) => {
        const oldIndex = prev.sections.findIndex((section) => section.id === active.id);
        const newIndex = prev.sections.findIndex((section) => section.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;

        const newSections = arrayMove(prev.sections, oldIndex, newIndex);
        const reorderedSections = newSections.map((section, index) => ({
          ...section,
          order: index,
        }));

        const updatedTemplate = { ...prev, sections: reorderedSections };
        localTemplateRef.current = updatedTemplate;
        return updatedTemplate;
      });
    }
  };

  const handleSectionUpdate = (updatedSection: AgreementSection) => {
    setLocalTemplate((prev) => {
      const updatedTemplate = {
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === updatedSection.id ? updatedSection : section,
        ),
      };
      localTemplateRef.current = updatedTemplate;
      return updatedTemplate;
    });
  };

  const handleAddSection = (type: 'table' | 'paragraph' | 'list') => {
    setLocalTemplate((prev) => {
      const newSection: AgreementSection = {
        id: `section-${Date.now()}`,
        title: '',
        type,
        order: prev.sections.length,
        ...(type === 'table' ? { fields: [] } : { content: '' }),
      };

      // Wstaw nową sekcję przed końcowym blokiem sekcji systemowych
      // (podpis klienta, dane organizatora, załącznik „imprezy samolotowe"),
      // aby trafiła do głównej treści umowy, a nie na sam koniec ostatniej strony.
      let insertAt = prev.sections.length;
      for (let i = prev.sections.length - 1; i >= 0; i--) {
        if (isSystemSection(prev.sections[i])) {
          insertAt = i;
        } else {
          break;
        }
      }

      const nextSections = [
        ...prev.sections.slice(0, insertAt),
        newSection,
        ...prev.sections.slice(insertAt),
      ].map((section, index) => ({ ...section, order: index }));

      const updatedTemplate = {
        ...prev,
        sections: nextSections,
      };
      localTemplateRef.current = updatedTemplate;
      return updatedTemplate;
    });
  };

  const handleDeleteSection = (sectionId: string) => {
    const sectionToDelete = localTemplateRef.current.sections.find((s) => s.id === sectionId);
    if (sectionToDelete && isSystemSection(sectionToDelete)) {
      return;
    }

    setLocalTemplate((prev) => {
      const updatedTemplate = {
        ...prev,
        sections: prev.sections
          .filter((section) => section.id !== sectionId)
          .map((section, index) => ({ ...section, order: index })),
      };
      localTemplateRef.current = updatedTemplate;
      return updatedTemplate;
    });
  };

  // Tytuł umowy jest zawsze przypięty jako pierwszy — nic nigdy nie może być nad nim.
  const titleCard = (
    <Card key="__agreement-title__" className="mb-4 bg-muted/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1">
            <div className="h-4 w-4" />
          </div>
          <div className="font-semibold flex-1 text-muted-foreground text-sm">
            Tytuł umowy (sekcja systemowa)
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-center text-foreground">
          {localTemplate.title}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => onSave(buildTemplateForSave())} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Zapisywanie...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Zapisz
            </>
          )}
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localTemplate.sections.filter(s => !isSystemSection(s)).map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {titleCard}
          {localTemplate.sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              onUpdate={handleSectionUpdate}
              onDelete={() => handleDeleteSection(section.id)}
              onRegisterEditor={registerEditor}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={() => handleAddSection('table')}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj tabelę
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAddSection('paragraph')}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj paragraf
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAddSection('list')}
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Dodaj listę
        </Button>
      </div>
    </div>
  );
}
