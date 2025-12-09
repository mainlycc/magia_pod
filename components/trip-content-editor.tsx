"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";

interface TripContentEditorProps {
  content: string;
  onChange: (content: string) => void;
  label: string;
}

// Funkcja konwertująca HTML na zwykły tekst do edycji
function htmlToPlainText(html: string): string {
  if (!html || typeof document === "undefined") return "";
  
  try {
    // Tworzymy tymczasowy element do parsowania HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    
    const result: string[] = [];
    
    // Przetwarzamy wszystkie węzły top-level
    Array.from(tempDiv.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const tagName = element.tagName.toLowerCase();
        
        if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6") {
          const level = parseInt(tagName.charAt(1));
          const text = element.textContent?.trim() || "";
          if (text) {
            result.push("#".repeat(level) + " " + text);
          }
        } else if (tagName === "ul" || tagName === "ol") {
          const items = element.querySelectorAll("li");
          items.forEach((item, index) => {
            const text = item.textContent?.trim() || "";
            if (text) {
              const prefix = tagName === "ul" ? "- " : `${index + 1}. `;
              result.push(prefix + text);
            }
          });
        } else if (tagName === "p") {
          const text = element.textContent?.trim() || "";
          if (text) {
            result.push(text);
          }
          result.push(""); // Pusta linia po paragrafie
        } else if (tagName === "br") {
          result.push("");
        } else {
          // Dla innych elementów, używamy textContent
          const text = element.textContent?.trim() || "";
          if (text) {
            result.push(text);
          }
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim();
        if (text) {
          result.push(text);
        }
      }
    });
    
    // Usuwamy podwójne puste linie
    return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch (error) {
    // Fallback: prostsza konwersja
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  }
}

// Funkcja automatycznie formatująca zwykły tekst na HTML
function plainTextToHtml(text: string): string {
  if (!text) return "";
  
  const lines = text.split("\n");
  const htmlParts: string[] = [];
  let inList = false;
  let listItems: string[] = [];
  let listIsOrdered = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Nagłówki (format: ## Tekst)
    if (line.match(/^#{1,6}\s+/)) {
      // Zamykamy listę jeśli była otwarta
      if (inList) {
        const listTag = listIsOrdered ? "ol" : "ul";
        htmlParts.push(`<${listTag}><li>${listItems.join(`</li><li>`)}</li></${listTag}>`);
        listItems = [];
        inList = false;
      }
      
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        htmlParts.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
      }
      continue;
    }
    
    // Lista punktowana (format: - Tekst)
    if (line.match(/^-\s+/)) {
      if (!inList || listIsOrdered) {
        // Zamykamy poprzednią listę jeśli była otwarta
        if (inList) {
          const listTag = listIsOrdered ? "ol" : "ul";
          htmlParts.push(`<${listTag}><li>${listItems.join(`</li><li>`)}</li></${listTag}>`);
          listItems = [];
        }
        inList = true;
        listIsOrdered = false;
      }
      const itemText = line.replace(/^-\s+/, "");
      listItems.push(escapeHtml(itemText));
      continue;
    }
    
    // Lista numerowana (format: 1. Tekst)
    if (line.match(/^\d+\.\s+/)) {
      if (!inList || !listIsOrdered) {
        // Zamykamy poprzednią listę jeśli była otwarta
        if (inList) {
          const listTag = listIsOrdered ? "ol" : "ul";
          htmlParts.push(`<${listTag}><li>${listItems.join(`</li><li>`)}</li></${listTag}>`);
          listItems = [];
        }
        inList = true;
        listIsOrdered = true;
      }
      const itemText = line.replace(/^\d+\.\s+/, "");
      listItems.push(escapeHtml(itemText));
      continue;
    }
    
    // Zamykamy listę jeśli była otwarta i mamy pustą linię lub zwykły tekst
    if (inList) {
      const listTag = listIsOrdered ? "ol" : "ul";
      htmlParts.push(`<${listTag}><li>${listItems.join(`</li><li>`)}</li></${listTag}>`);
      listItems = [];
      inList = false;
    }
    
    // Pusta linia = nowy paragraf
    if (line === "") {
      if (htmlParts.length > 0 && !htmlParts[htmlParts.length - 1].endsWith("</p>")) {
        htmlParts.push("<p></p>");
      }
      continue;
    }
    
    // Zwykły tekst = paragraf
    htmlParts.push(`<p>${escapeHtml(line)}</p>`);
  }
  
  // Zamykamy listę jeśli była otwarta na końcu
  if (inList) {
    const listTag = listIsOrdered ? "ol" : "ul";
    htmlParts.push(`<${listTag}><li>${listItems.join(`</li><li>`)}</li></${listTag}>`);
  }
  
  return htmlParts.join("");
}

// Funkcja escapująca HTML
function escapeHtml(text: string): string {
  if (typeof document === "undefined") {
    // Fallback dla SSR
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function TripContentEditor({ content, onChange, label }: TripContentEditorProps) {
  const [plainText, setPlainText] = useState("");
  
  // Konwertujemy HTML na zwykły tekst przy ładowaniu
  useEffect(() => {
    setPlainText(htmlToPlainText(content));
  }, [content]);
  
  const handleChange = (value: string) => {
    setPlainText(value);
    // Automatycznie formatujemy tekst na HTML
    const html = plainTextToHtml(value);
    onChange(html);
  };
  
  return (
    <div className="space-y-2">
      <Textarea
        value={plainText}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Wpisz treść... Formatowanie jest automatyczne:
- Linie zaczynające się od '-' tworzą listy punktowane
- Linie zaczynające się od '1.' tworzą listy numerowane
- Linie zaczynające się od '##' tworzą nagłówki
- Puste linie tworzą nowe paragrafy"
        className="min-h-[300px] font-mono text-sm"
      />
    </div>
  );
}

