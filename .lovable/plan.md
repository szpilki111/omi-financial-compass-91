

## Problem: Wyszukiwanie dokumentów działa tylko na bieżącej stronie

Wyszukiwarka (`searchTerm`) filtruje dokumenty **po stronie klienta** (linia 165-171), czyli przeszukuje tylko 50 dokumentów załadowanych na aktualnej stronie paginacji. Dokumenty z kolejnych stron nigdy nie są sprawdzane.

## Rozwiązanie

Przenieść filtrowanie po `searchTerm` na stronę serwera (Supabase query), tak aby paginacja dotyczyła już przefiltrowanych wyników.

### Plik: `src/pages/Documents/DocumentsPage.tsx`

**1. Dodać `searchTerm` do `queryKey` (linia 88)**
```typescript
queryKey: ['documents', currentPage, selectedLocationId, searchTerm],
```

**2. Dodać filtry do Supabase query (po linii 105)**
Jeśli `searchTerm` jest niepusty, dodać `.or()` z filtrami `ilike` na kolumnach `document_number`, `document_name`:
```typescript
if (searchTerm.trim()) {
  const s = `%${searchTerm.trim()}%`;
  query = query.or(`document_number.ilike.${s},document_name.ilike.${s}`);
}
```

**3. Resetować stronę przy zmianie wyszukiwania**
Dodać `useEffect` lub zmienić handler `setSearchTerm`, aby przy każdej zmianie frazy ustawiać `setCurrentPage(1)`.

**4. Usunąć filtrowanie client-side**
Zastąpić `filteredDocuments` bezpośrednim użyciem `documents` (usunąć `useMemo` z liniami 165-171), ponieważ filtrowanie odbywa się już na serwerze.

### Efekt
- Wyszukiwanie przeszuka **wszystkie** dokumenty, nie tylko bieżącą stronę
- Paginacja będzie działać poprawnie z wynikami wyszukiwania
- Wydajność: mniej danych pobieranych z serwera przy aktywnym wyszukiwaniu

