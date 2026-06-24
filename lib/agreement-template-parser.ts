// Funkcje do parsowania HTML szablonu umowy do struktury danych i z powrotem

export interface AgreementField {
  id: string;
  label: string;
  value: string; // Może zawierać placeholder {{...}} lub tekst
  type: 'text' | 'placeholder' | 'static';
}

export interface AgreementSection {
  id: string;
  title: string;
  type: 'table' | 'paragraph' | 'list' | 'title';
  fields?: AgreementField[];
  content?: string; // Dla paragrafów i list
  order: number;
}

export interface AgreementTemplate {
  title: string;
  sections: AgreementSection[];
}

function isAwaitingContentSection(section: AgreementSection | null): boolean {
  if (!section) return false;
  if (section.type === "title") return true;
  return section.type === "paragraph" && !!section.title && !section.content?.trim();
}

/**
 * Bloki, które muszą pozostać osobnymi sekcjami i nie mogą być scalane
 * z sąsiednimi akapitami (page-break / dane organizatora / podpis / załącznik
 * „imprezy samolotowe"). Bez tego nowy akapit dodany obok takiego bloku
 * zostaje wchłonięty i znika z edytora jako osobna, edytowalna sekcja.
 */
function isStandaloneBlockHtml(html: string | undefined | null): boolean {
  const content = (html ?? "").toLowerCase();
  if (!content) return false;
  return (
    content.includes("page-break-before") ||
    content.includes("organizator imprezy turystycznej") ||
    content.includes("imprezy samolotowe") ||
    content.includes("podpis klienta")
  );
}

function normalizeSectionType(section: AgreementSection): AgreementSection {
  if (section.type !== "title") return section;
  return {
    ...section,
    type: "paragraph",
    content: section.content ?? "",
  };
}

/**
 * Parsuje HTML do struktury danych
 */
export function parseHtmlToTemplate(html: string): AgreementTemplate {
  // Użyj DOMParser tylko w przeglądarce
  if (typeof window === 'undefined') {
    // Fallback dla server-side - zwróć pusty szablon
    return {
      title: 'UMOWA O UDZIAŁ W IMPREZIE TURYSTYCZNEJ',
      sections: [],
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const sections: AgreementSection[] = [];
  let order = 0;
  
  // Przetwarzaj wszystkie elementy w body
  const body = doc.body;
  let currentSection: AgreementSection | null = null;
  
  Array.from(body.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      // Nagłówek H1 - tytuł dokumentu
      if (element.tagName === 'H1') {
        // Tytuł jest już w strukturze
      }
      // Nagłówek H2 - nowa sekcja
      else if (element.tagName === 'H2') {
        if (currentSection) {
          sections.push(normalizeSectionType(currentSection));
        }
        currentSection = {
          id: `section-${order++}`,
          title: element.textContent || '',
          type: 'paragraph',
          content: '',
          order: sections.length,
        };
      }
      // Tabela - sekcja z polami
      else if (element.tagName === 'TABLE') {
        if (
          currentSection &&
          currentSection.type === 'table' &&
          currentSection.fields &&
          currentSection.fields.length > 0
        ) {
          // Druga tabela bez H2 między nimi (np. domyślny szablon) — osobna sekcja
          sections.push(normalizeSectionType(currentSection));
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'table',
            fields: [],
            order: sections.length,
          };
        } else if (isAwaitingContentSection(currentSection)) {
          currentSection!.type = 'table';
          currentSection!.fields = [];
        } else if (!currentSection) {
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'table',
            fields: [],
            order: sections.length,
          };
        } else if (currentSection.type !== 'table') {
          sections.push(normalizeSectionType(currentSection));
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'table',
            fields: [],
            order: sections.length,
          };
        } else if (!currentSection.fields) {
          currentSection.fields = [];
        }

        if (currentSection && currentSection.type === 'table') {
          const rows = element.querySelectorAll('tr');
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const label = cells[0].innerHTML || '';
              const value = cells[1].innerHTML || '';
              
              // Sprawdź czy wartość zawiera placeholder
              const hasPlaceholder = /{{[^}]+}}/.test(value);
              
              currentSection!.fields!.push({
                id: `field-${Date.now()}-${currentSection!.fields!.length}`,
                label: label.trim(),
                value: value.trim(),
                type: hasPlaceholder ? 'placeholder' : value.trim() ? 'text' : 'static',
              });
            }
          });
        }
      }
      // DIV - może zawierać wiele paragrafów (np. sekcja organizatora lub druga strona)
      else if (element.tagName === 'DIV') {
        const innerHTML = element.innerHTML;
        const outerHTML = element.outerHTML; // Zachowaj style DIV (np. page-break-before)
        
        // Sprawdź czy zawiera paragrafy organizatora lub jest drugą stroną
        if (innerHTML.includes('ORGANIZATOR IMPREZY TURYSTYCZNEJ') || innerHTML.includes('IMPREZY SAMOLOTOWE') || outerHTML.includes('page-break-before')) {
          if (currentSection) {
            sections.push(normalizeSectionType(currentSection));
          }
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'paragraph',
            content: outerHTML, // Zachowaj cały DIV z formatowaniem (włącznie z page-break)
            order: sections.length,
          };
        } else {
          // Zwykły DIV - zachowaj HTML jeśli jest (np. style/formatowanie z edytora)
          const hasNestedElements = element.querySelector('*') !== null;
          const hasStyle = !!element.getAttribute('style');
          const content = (hasNestedElements || hasStyle) ? outerHTML : (element.textContent || '');
          if (isAwaitingContentSection(currentSection)) {
            currentSection!.type = 'paragraph';
            currentSection!.content = content;
          } else {
            if (currentSection) {
              sections.push(normalizeSectionType(currentSection));
            }
            currentSection = {
              id: `section-${order++}`,
              title: '',
              type: 'paragraph',
              content,
              order: sections.length,
            };
          }
        }
      }
      // Paragraf
      else if (element.tagName === 'P') {
        const content = element.outerHTML;

        if (isAwaitingContentSection(currentSection)) {
          currentSection!.type = 'paragraph';
          currentSection!.content = content;
        } else if (
          currentSection?.type === 'paragraph' &&
          currentSection.content?.trim() &&
          !isStandaloneBlockHtml(currentSection.content) &&
          !isStandaloneBlockHtml(content)
        ) {
          // Kolejne akapity (np. z TipTap) trzymaj w jednej sekcji — także bez tytułu H2.
          // Nie scalaj jednak z blokami systemowymi (page-break, podpis, organizator,
          // załącznik), aby nowo dodany akapit pozostał osobną, edytowalną sekcją.
          currentSection.content = `${currentSection.content}\n${content}`;
        } else {
          if (currentSection) {
            sections.push(normalizeSectionType(currentSection));
          }
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'paragraph',
            content,
            order: sections.length,
          };
        }
      }
      // Lista
      else if (element.tagName === 'UL' || element.tagName === 'OL') {
        const content = element.outerHTML;

        if (isAwaitingContentSection(currentSection)) {
          currentSection!.type = 'list';
          currentSection!.content = content;
        } else {
          if (currentSection) {
            sections.push(normalizeSectionType(currentSection));
          }
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'list',
            content,
            order: sections.length,
          };
        }
      }
      // Każdy inny element (np. PRE/CODE, BLOCKQUOTE, H3–H6, HR z edytora TipTap).
      // Bez tego treść taka jak blok kodu była po cichu pomijana i znikała po
      // ponownym wczytaniu szablonu.
      else if (element.tagName !== 'H1') {
        const content = element.outerHTML;

        if (isAwaitingContentSection(currentSection)) {
          currentSection!.type = 'paragraph';
          currentSection!.content = content;
        } else if (
          currentSection?.type === 'paragraph' &&
          currentSection.content?.trim() &&
          !isStandaloneBlockHtml(currentSection.content) &&
          !isStandaloneBlockHtml(content)
        ) {
          currentSection.content = `${currentSection.content}\n${content}`;
        } else {
          if (currentSection) {
            sections.push(normalizeSectionType(currentSection));
          }
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'paragraph',
            content,
            order: sections.length,
          };
        }
      }
    }
  });
  
  // Dodaj ostatnią sekcję
  if (currentSection) {
    sections.push(normalizeSectionType(currentSection));
  }
  
  return {
    title: doc.querySelector('h1')?.textContent || 'UMOWA O UDZIAŁ W IMPREZIE TURYSTYCZNEJ',
    sections,
  };
}

/**
 * Konwertuje strukturę danych z powrotem do HTML
 */
export function templateToHtml(template: AgreementTemplate): string {
  let html = '';
  
  // Sortuj sekcje według order przed renderowaniem (zachowaj kolejność po drag & drop)
  const sortedSections = [...template.sections].sort((a, b) => a.order - b.order);

  // Tytuł umowy jest zawsze pierwszy — nic nie może być nad nim (spójne z edytorem).
  html += `<h1>${escapeHtml(template.title)}</h1>\n\n`;
  
  // Renderuj wszystkie sekcje w kolejności (blok organizatora trafia pod tytuł).
  sortedSections.forEach((section) => {
    // Wyświetl tytuł sekcji jeśli istnieje
    if (section.title) {
      html += `<h2>${escapeHtml(section.title)}</h2>\n`;
    }
    
    // Wyświetl zawartość sekcji w zależności od typu
    if (section.type === 'table' && section.fields) {
      html += '<table>\n';
      section.fields.forEach((field) => {
        const labelHtml = contentLooksLikeHtml(field.label)
          ? field.label
          : escapeHtml(field.label);
        const valueHtml = contentLooksLikeHtml(field.value)
          ? field.value
          : escapeHtml(field.value);
        html += `  <tr>\n    <td>${labelHtml}</td>\n    <td>${valueHtml}</td>\n  </tr>\n`;
      });
      html += '</table>\n\n';
    } else if ((section.type === 'paragraph' || section.type === 'title') && section.content) {
      // Jeśli zawartość to HTML (zawiera tagi HTML), użyj bezpośrednio
      // Sprawdź czy zawiera jakiekolwiek tagi HTML (np. z edytora Tiptap)
      if (contentLooksLikeHtml(section.content)) {
        // To jest HTML - użyj bezpośrednio (np. DIV z page-break, HTML z Tiptap)
        html += section.content + '\n\n';
      } else {
        // Zwykły tekst - owinij w paragraf
        html += `<p>${escapeHtml(section.content)}</p>\n\n`;
      }
    } else if (section.type === 'list' && section.content) {
      // Sprawdź czy zawartość to HTML (np. z edytora Tiptap)
      if (contentLooksLikeHtml(section.content)) {
        // To jest HTML - użyj bezpośrednio (np. HTML z Tiptap)
        html += section.content + '\n\n';
      } else {
        // Zwykły tekst - parsuj jako listę
        const items = section.content.split('\n').filter(item => item.trim());
        html += '<ul>\n';
        items.forEach((item) => {
          html += `  <li>${escapeHtml(item.trim())}</li>\n`;
        });
        html += '</ul>\n\n';
      }
    }
  });
  
  return html;
}

/** Ta sama heurystyka co dla paragrafów/list — fragment wygląda na HTML z edytora (np. Tiptap). */
function contentLooksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function escapeHtml(text: string): string {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
