

## Problem: Numer dokumentu zawsze generowany dla DOMOBR

### Diagnoza

W `DocumentDialog.tsx`:
- **Linia 527**: `generateDocumentNumber` używa `user?.location` jako fallback — to jest `location_id` z profilu użytkownika
- **Linia 950**: Nowy dokument jest zapisywany z `location_id: user.location` — zawsze domyślna lokalizacja

Na stronie `DocumentsPage.tsx` jest selektor lokalizacji (`selectedLocationId`), ale **nie jest on przekazywany** do `DocumentDialog`. Dialog zawsze tworzy dokumenty dla domyślnej lokalizacji użytkownika.

### Rozwiązanie

**`src/pages/Documents/DocumentsPage.tsx`**:
- Przekazać `selectedLocationId` do `DocumentDialog` jako nowy prop (np. `locationIdOverride`)

**`src/pages/Documents/DocumentDialog.tsx`**:
- Dodać opcjonalny prop `locationIdOverride?: string` do `DocumentDialogProps`
- W `generateDocumentNumber` (linia 527): użyć `locationIdOverride || user?.location` zamiast samego `user?.location` dla nowych dokumentów
- W `onSubmit` (linia 950): użyć `locationIdOverride || user.location` jako `location_id` nowego dokumentu
- W efekcie generowania numeru (linie 610-660): uwzględnić `locationIdOverride`

Dla administratorów/prowincjałów, wybranie innej placówki w filtrze na liście dokumentów spowoduje, że nowy dokument będzie tworzony dla wybranej placówki (z właściwym skrótem domu w numerze).

Dla ekonomów z jedną placówką — zachowanie bez zmian (ich `user.location` jest prawidłowe).

### Pliki do zmiany

| Plik | Zmiana |
|------|--------|
| `src/pages/Documents/DocumentDialog.tsx` | Dodać prop `locationIdOverride`, użyć go w generowaniu numeru i zapisie |
| `src/pages/Documents/DocumentsPage.tsx` | Przekazać `selectedLocationId` do `DocumentDialog` |

