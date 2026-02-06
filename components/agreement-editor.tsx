"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, Trash2, Save } from "lucide-react";
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

interface AgreementEditorProps {
  template: AgreementTemplate;
  onChange: (template: AgreementTemplate) => void;
  onSave: () => void;
  saving?: boolean;
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

function SortableSection({
  section,
  onUpdate,
  onDelete,
}: {
  section: AgreementSection;
  onUpdate: (section: AgreementSection) => void;
  onDelete: () => void;
}) {
  const isSystem = isSystemSection(section);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: section.id,
    disabled: isSystem, // Wyłącz drag & drop dla sekcji systemowych
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleFieldChange = (fieldId: string, value: string) => {
    if (section.fields) {
      const updatedFields = section.fields.map((field) =>
        field.id === fieldId ? { ...field, value } : field
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
    onUpdate({ ...section, content });
  };

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
              Sekcja systemowa (tylko do odczytu)
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
          <div className="space-y-3">
            {section.fields.map((field) => (
              <div key={field.id} className="grid grid-cols-2 gap-3 items-start">
                <div>
                  <Input
                    value={field.label}
                    onChange={(e) => {
                      const updatedFields = section.fields!.map((f) =>
                        f.id === field.id ? { ...f, label: e.target.value } : f
                      );
                      onUpdate({ ...section, fields: updatedFields });
                    }}
                    placeholder="Etykieta pola..."
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    value={field.value}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    placeholder="Wartość lub {{placeholder}}..."
                    className="text-sm flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteField(field.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddField}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj pole
            </Button>
          </div>
        )}
        
        {section.type === 'paragraph' && (
          isSystem ? (
            <div 
              className="min-h-[100px] p-3 border rounded-md bg-muted/20 text-sm"
              dangerouslySetInnerHTML={{ __html: section.content || '' }}
            />
          ) : (
            <Textarea
              value={section.content || ''}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Treść paragrafu..."
              className="min-h-[100px]"
            />
          )
        )}
        
        {section.type === 'list' && (
          <Textarea
            value={section.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Elementy listy (jeden na linię)..."
            className="min-h-[100px]"
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

  useEffect(() => {
    setLocalTemplate(template);
  }, [template]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localTemplate.sections.findIndex(
        (section) => section.id === active.id
      );
      const newIndex = localTemplate.sections.findIndex(
        (section) => section.id === over.id
      );

      const newSections = arrayMove(localTemplate.sections, oldIndex, newIndex);
      const reorderedSections = newSections.map((section, index) => ({
        ...section,
        order: index,
      }));

      const updatedTemplate = {
        ...localTemplate,
        sections: reorderedSections,
      };

      setLocalTemplate(updatedTemplate);
      onChange(updatedTemplate);
    }
  };

  const handleSectionUpdate = (updatedSection: AgreementSection) => {
    const updatedSections = localTemplate.sections.map((section) =>
      section.id === updatedSection.id ? updatedSection : section
    );
    const updatedTemplate = {
      ...localTemplate,
      sections: updatedSections,
    };
    setLocalTemplate(updatedTemplate);
    onChange(updatedTemplate);
  };

  const handleAddSection = (type: 'table' | 'paragraph' | 'list') => {
    const newSection: AgreementSection = {
      id: `section-${Date.now()}`,
      title: '',
      type,
      order: localTemplate.sections.length,
      ...(type === 'table' ? { fields: [] } : { content: '' }),
    };

    const updatedTemplate = {
      ...localTemplate,
      sections: [...localTemplate.sections, newSection],
    };
    setLocalTemplate(updatedTemplate);
    onChange(updatedTemplate);
  };

  const handleDeleteSection = (sectionId: string) => {
    const sectionToDelete = localTemplate.sections.find(s => s.id === sectionId);
    // Nie pozwól usuwać sekcji systemowych
    if (sectionToDelete && isSystemSection(sectionToDelete)) {
      return;
    }
    
    const updatedSections = localTemplate.sections
      .filter((section) => section.id !== sectionId)
      .map((section, index) => ({ ...section, order: index }));
    
    const updatedTemplate = {
      ...localTemplate,
      sections: updatedSections,
    };
    setLocalTemplate(updatedTemplate);
    onChange(updatedTemplate);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-bold flex-1">
          {localTemplate.title}
        </div>
        <Button onClick={onSave} disabled={saving}>
          {saving ? (
            <>
              <Save className="h-4 w-4 mr-2 animate-spin" />
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
          {localTemplate.sections.map((section) => (
            <SortableSection
              key={section.id}
              section={section}
              onUpdate={handleSectionUpdate}
              onDelete={() => handleDeleteSection(section.id)}
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
