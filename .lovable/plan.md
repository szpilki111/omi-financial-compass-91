
Cel: zatrzymać błąd logowania „Cannot read properties of undefined (reading 'digest')” oraz usunąć niespójność „czasem wpuszcza bez trusted device, czasem wylogowuje po odświeżeniu”.

Do I know what the issue is? Tak.

Co potwierdziłem (na podstawie kodu + logów + DB):
1) `src/utils/deviceFingerprint.ts` używa `crypto.subtle.digest(...)` bez fallbacku.  
   Na części środowisk (zwłaszcza HTTP/insecure context i część mobile) `crypto.subtle` jest `undefined`, co daje dokładnie zgłaszany błąd.
2) `src/context/AuthContext.tsx` w `checkDeviceTrust` ma `catch { return true; }` (fail-open).  
   To powoduje bypass trusted-device przy błędach fingerprintu i daje chaos: jedni wchodzą bez 2FA/trusted, inni są wylogowywani po refresh.
3) RLS dla `app_settings` pozwala SELECT tylko `authenticated`, więc na `/login` (anon) zapytanie zwykle errorem i system wymusza 2FA (co jest OK przy fail-closed), ale to zwiększa częstotliwość wywołania fingerprintu.
4) Widziałem już rekordy w `trusted_devices` (26), więc problem nie jest „brak tabeli”, tylko niestabilna ścieżka runtime.

Plan wdrożenia (bezpieczny dla produkcji):
1) Uodpornić fingerprint na każde środowisko (`src/utils/deviceFingerprint.ts`)
- Dodać bezpieczny hash:
  - najpierw `globalThis.crypto?.subtle?.digest` (jeśli dostępne),
  - fallback na lokalny deterministiczny hash JS (bez WebCrypto).
- Funkcja fingerprint nie może rzucać wyjątku: zawsze zwraca string.
- Dodać guardy na brak `window/navigator/screen` i try/catch na każdy komponent.
- Zachować możliwie kompatybilny format, żeby nie wycinać istniejących trusted devices.

2) Zamknąć bypass bezpieczeństwa (`src/context/AuthContext.tsx`)
- Zmienić `checkDeviceTrust` na fail-closed:
  - błąd odczytu `app_settings` => traktuj jak `2FA = ON`,
  - błąd generacji fingerprintu / check trusted => zwróć `false` (nie wpuszczaj).
- Utrzymać check trusted w `initializeAuth` (na start/refresh), ale już bez „przepuszczania” na wyjątku.

3) Ustabilizować zapis trusted device po 2FA (`src/pages/Login.tsx`)
- Po `handleTwoFactorVerified`:
  - potwierdzić aktywną sesję (`getSession`) przed `addTrustedDevice`,
  - jeśli brak sesji: krótki retry i dopiero insert,
  - po insercie odczytać rekord kontrolnie (assert), dopiero wtedy nawigacja.
- Jeśli zapis trusted nie przejdzie: kontrolowany signOut + czytelny komunikat (bez pół-zalogowanego stanu).

4) Diagnostyka operacyjna (krótkoterminowo, produkcja)
- Dodać tymczasowe logi diagnostyczne (source + reason) dla:
  - fingerprint fallback,
  - decyzji trusted/untrusted,
  - błędu inserta trusted.
- Dzięki temu po następnym zgłoszeniu od razu zobaczymy, czy problem to insecure context, brak sesji, RLS, czy coś innego.

5) Plan testów regresji przed zamknięciem incydentu
- Scenariusz A: nowe urządzenie (desktop)  
  login -> 2FA -> zapis trusted -> refresh -> pozostaje zalogowany.
- Scenariusz B: kolejne logowanie z tej samej maszyny  
  login bez 2FA (trusted hit), brak błędu digest.
- Scenariusz C: mobile (zgłaszany przypadek)  
  pierwsze i kolejne logowanie, plus refresh.
- Scenariusz D: brak trusted (ręczne usunięcie rekordu)  
  wymusza 2FA zawsze.
- Scenariusz E: wejście przez HTTP oraz HTTPS (jeśli oba działają)  
  brak błędu digest; przewidywalne zachowanie trusted.

Sekcja techniczna:
- Pliki do zmiany:
  - `src/utils/deviceFingerprint.ts` (krytyczny runtime fix)
  - `src/context/AuthContext.tsx` (fail-open -> fail-closed)
  - `src/pages/Login.tsx` (atomowy zapis trusted po 2FA)
- Brak migracji DB.
- Ryzyko wdrożenia: niskie-średnie (dotyczy wyłącznie auth flow), zredukowane przez testy A–E i logi diagnostyczne.
- Oczekiwany efekt:
  - znika błąd `digest`,
  - znika „pierwsze logowanie działa, kolejne nie”,
  - znika możliwość wejścia bez trusted device przy błędach technicznych.
