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
          sections.push(currentSection);
        }
        currentSection = {
          id: `section-${order++}`,
          title: element.textContent || '',
          type: 'title',
          order: sections.length,
        };
      }
      // Tabela - sekcja z polami
      else if (element.tagName === 'TABLE') {
        if (currentSection && currentSection.type === 'title') {
          currentSection.type = 'table';
          currentSection.fields = [];
        } else if (!currentSection) {
          // Tabela bez tytułu - utwórz sekcję
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'table',
            fields: [],
            order: sections.length,
          };
        }
        
        if (currentSection && currentSection.type === 'table') {
          const rows = element.querySelectorAll('tr');
          rows.forEach((row) => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const label = cells[0].textContent || '';
              const value = cells[1].textContent || '';
              
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
          // Zapisz poprzednią sekcję jeśli istnieje
          if (currentSection && currentSection.type !== 'title') {
            sections.push(currentSection);
          }
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'paragraph',
            content: outerHTML, // Zachowaj cały DIV z formatowaniem (włącznie z page-break)
            order: sections.length,
          };
        } else {
          // Zwykły DIV - parsuj jako paragraf
          const text = element.textContent || '';
          if (currentSection && currentSection.type === 'title') {
            currentSection.type = 'paragraph';
            currentSection.content = text;
          } else {
            if (currentSection && currentSection.type !== 'title') {
              sections.push(currentSection);
            }
            currentSection = {
              id: `section-${order++}`,
              title: '',
              type: 'paragraph',
              content: text,
              order: sections.length,
            };
          }
        }
      }
      // Paragraf
      else if (element.tagName === 'P') {
        const text = element.textContent || '';
        
        // Jeśli mamy sekcję z tytułem bez typu, zamień na paragraf
        if (currentSection && currentSection.type === 'title') {
          currentSection.type = 'paragraph';
          currentSection.content = text;
        } else {
          // Zapisz poprzednią sekcję jeśli istnieje
          if (currentSection && currentSection.type !== 'title') {
            sections.push(currentSection);
          }
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'paragraph',
            content: text,
            order: sections.length,
          };
        }
      }
      // Lista
      else if (element.tagName === 'UL' || element.tagName === 'OL') {
        const items: string[] = [];
        element.querySelectorAll('li').forEach((li) => {
          items.push(li.textContent || '');
        });
        
        // Jeśli mamy sekcję z tytułem bez typu, zamień na listę
        if (currentSection && currentSection.type === 'title') {
          currentSection.type = 'list';
          currentSection.content = items.join('\n');
        } else {
          // Zapisz poprzednią sekcję jeśli istnieje
          if (currentSection && currentSection.type !== 'title') {
            sections.push(currentSection);
          }
          currentSection = {
            id: `section-${order++}`,
            title: '',
            type: 'list',
            content: items.join('\n'),
            order: sections.length,
          };
        }
      }
    }
  });
  
  // Dodaj ostatnią sekcję
  if (currentSection) {
    sections.push(currentSection);
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
  
  // Sprawdź czy pierwsza sekcja po sortowaniu to paragraf (organizator) - powinien być przed H1
  const firstSection = sortedSections[0];
  if (firstSection && firstSection.type === 'paragraph' && firstSection.content) {
    // Jeśli zawiera HTML (DIV z paragrafami), użyj go bezpośrednio
    const organizerContent = firstSection.content;
    if (organizerContent.includes('<div') || organizerContent.includes('<p')) {
      // To jest HTML - użyj go bezpośrednio
      html += organizerContent + '\n\n';
    } else if (organizerContent.includes('ORGANIZATOR IMPREZY TURYSTYCZNEJ')) {
      // Zwykły tekst - użyj domyślnego formatowania
      html += `<p style="font-size: 0.875rem; line-height: 1.5; margin-bottom: 1rem;">${escapeHtml(organizerContent)}</p>\n\n`;
    } else {
      html += `<p>${escapeHtml(organizerContent)}</p>\n\n`;
    }
  }
  
  html += `<h1>${escapeHtml(template.title)}</h1>\n\n`;
  
  // Renderuj sekcje (pomijając pierwszą jeśli była paragrafem organizatora)
  const startIndex = (firstSection && firstSection.type === 'paragraph') ? 1 : 0;
  sortedSections.slice(startIndex).forEach((section) => {
    // Wyświetl tytuł sekcji jeśli istnieje
    if (section.title) {
      html += `<h2>${escapeHtml(section.title)}</h2>\n`;
    }
    
    // Wyświetl zawartość sekcji w zależności od typu
    if (section.type === 'table' && section.fields) {
      html += '<table>\n';
      section.fields.forEach((field) => {
        html += `  <tr>\n    <td>${escapeHtml(field.label)}</td>\n    <td>${escapeHtml(field.value)}</td>\n  </tr>\n`;
      });
      html += '</table>\n\n';
    } else if (section.type === 'paragraph' && section.content) {
      // Jeśli zawartość to HTML (zawiera tagi HTML), użyj bezpośrednio
      // Sprawdź czy zawiera jakiekolwiek tagi HTML (np. z edytora Tiptap)
      const hasHtmlTags = /<[a-z][\s\S]*>/i.test(section.content);
      if (hasHtmlTags) {
        // To jest HTML - użyj bezpośrednio (np. DIV z page-break, HTML z Tiptap)
        html += section.content + '\n\n';
      } else {
        // Zwykły tekst - owinij w paragraf
        html += `<p>${escapeHtml(section.content)}</p>\n\n`;
      }
    } else if (section.type === 'list' && section.content) {
      // Sprawdź czy zawartość to HTML (np. z edytora Tiptap)
      const hasHtmlTags = /<[a-z][\s\S]*>/i.test(section.content);
      if (hasHtmlTags) {
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
