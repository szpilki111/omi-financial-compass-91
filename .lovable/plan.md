
Plan naprawy (ultra-dokładny, minimalne ryzyko dla produkcji)

1) Co dokładnie jest zepsute (potwierdzone)
- Główna przyczyna: w `AuthContext.tsx` dodany check w `onAuthStateChange` dla eventu `SIGNED_IN` wylogowuje użytkownika zanim flow 2FA zdąży dodać urządzenie do `trusted_devices`.
- Efekt uboczny: `addTrustedDevice(...)` po weryfikacji kodu działa już na sesji, która została chwilę wcześniej wycięta, więc insert wpada w RLS (`auth.uid() = user_id`) i urządzenie nie zapisuje się.
- Twarde dowody:
  - `app_settings.two_factor_auth_enabled = true`
  - `trusted_devices_count = 0`
  - auth logi: sekwencja `POST /token (200)` → natychmiast `POST /logout (204)`

2) Plan poprawki w kodzie (bez zmian DB)
- Plik: `src/context/AuthContext.tsx`
  - Usunąć wymuszanie trust-check w ścieżce `SIGNED_IN` (to jest punkt kolizji z 2FA).
  - Zostawić trust-check w `initializeAuth()` (przy starcie aplikacji) — to nadal blokuje bypass przez „stare sesje” po odświeżeniu/aplikacji.
  - Dodać kontrolę tylko dla sesji już istniejących (nie dla świeżego, etapowego logowania 2FA).

- Plik: `src/pages/Login.tsx`
  - Utrzymać obecny flow:
    - login+hasło → niezaufane urządzenie → kod 2FA.
  - Po poprawnej weryfikacji kodu:
    - zalogować użytkownika,
    - natychmiast wykonać `addTrustedDevice(...)`,
    - dopiero potem nawigacja.
  - Krytyczne uszczelnienie: jeśli `addTrustedDevice(...)` się nie powiedzie, wymusić `signOut()` i pokazać komunikat, że logowanie z nowego urządzenia wymaga poprawnego zapisu zaufanego urządzenia (żeby nie było „wejścia bez dodania urządzenia”).

3) Dlaczego to spełni wymaganie biznesowe
- Każde nowe urządzenie przechodzi 2FA i jest dodawane „na stałe”.
- Bez zapisu urządzenia do trusted user nie zostanie wpuszczony.
- Role/przywileje nie mają znaczenia — warunek działa identycznie dla admin i non-admin.

4) Testy regresji (obowiązkowe przed domknięciem)
- Scenariusz A: użytkownik bez trusted device:
  - login hasło → modal 2FA → poprawny kod → wejście do systemu.
  - w DB pojawia się rekord w `trusted_devices`.
- Scenariusz B: ponowne logowanie z tego samego urządzenia:
  - brak 2FA (urządzenie już zaufane).
- Scenariusz C: usunięcie urządzenia z listy:
  - kolejne logowanie znowu wymaga 2FA.
- Scenariusz D: restart/odświeżenie app z sesją, ale bez wpisu trusted:
  - `initializeAuth` wylogowuje i kieruje na login.

5) Dodatkowa kontrola bezpieczeństwa po wdrożeniu
- Szybki audyt kont z `profiles.blocked = true` (bo część osób mogła zostać zablokowana przez poprzednie nieudane próby).
- W razie potrzeby przygotować oddzielny, kontrolowany plan odblokowania wyłącznie wskazanych kont produkcyjnych (bez masowego „odblokuj wszystko”).

Sekcja techniczna (dla zespołu)
- Problem jest wyścigiem asynchronicznym między:
  - `AuthContext.onAuthStateChange(SIGNED_IN)` + `checkDeviceTrust -> signOut`
  - oraz `Login.handleTwoFactorVerified -> login() -> addTrustedDevice`.
- Naprawa polega na rozdzieleniu odpowiedzialności:
  - `AuthContext` pilnuje tylko „sesji zastanych”,
  - `Login` kończy transakcję 2FA + trust enrollment atomowo z punktu widzenia UX (bez przedwczesnego wylogowania w tle).
