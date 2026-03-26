

## Plan: Wygenerowanie dokumentu Markdown z pełnym opisem aplikacji dla portfolio

### Co zrobię
Stworzę plik Markdown w `/mnt/documents/` zawierający:
- Pełny opis aplikacji (cel, klient, problem)
- Wszystkie moduły i funkcjonalności (12+ modułów)
- Stos technologiczny
- Kolorystykę i design system (kolory HSL, gradienty, paleta OMI)
- Role użytkowników i system uprawnień
- Korzyści biznesowe dla klienta
- Wskazówki wizualne dla AI budującego portfolio

### Plik wyjściowy
`/mnt/documents/portfolio-omi-opis.md`

### Źródła danych
- `INSTRUKTAZ_SYSTEMU.md` (834 linie dokumentacji)
- `tailwind.config.ts` + `src/index.css` (kolory, design tokens)
- `src/App.tsx` (routing, moduły)
- `src/pages/Index.tsx` (landing page, gradienty)
- `src/context/AuthContext.tsx` (role)
- Kontekst z memory (budżet, raporty, waluty, baza wiedzy)

