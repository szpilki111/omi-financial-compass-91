
INSERT INTO admin_notes (title, content, category, pinned, created_by, visible_to)
VALUES (
  '📋 Instrukcja: Jak wprowadzić budżet z pliku prowincjalnego',
  '# 📋 Jak wprowadzić budżet roczny do systemu

> ℹ️ **Ten poradnik krok po kroku pokazuje, jak przenieść dane budżetowe z pliku Excel otrzymanego od prowincji do modułu budżetowego w systemie OMI.**

---

## 📁 Co znajdziesz w pliku od prowincji?

Plik Excel zawiera kilka zakładek (arkuszy):

| Zakładka | Co zawiera | Czy potrzebujesz? |
|---|---|---|
| **Realizacja i Budżet Domu** | 🟢 Główne dane – przychody i rozchody z kolumną BUDŻET | ✅ **TAK – to źródło danych** |
| **Formularz należności do prowincji** | 🟢 Świadczenia na prowincję (kontrybucje, ZUS, itp.) | ✅ **TAK – dla konta 201** |
| **Przychody rozchody z podziałem** | Szczegółowy rozbicie podkont | ⚠️ Tylko do wglądu |
| **Składki emerytalne** | Tabela składek III filaru | ⚠️ Tylko do wglądu |

---

## 🚀 Krok 1: Otwórz moduł budżetu

1. Kliknij **„Budżet"** w menu nawigacji (ikona 💰)
2. Kliknij przycisk **„+ Nowy plan budżetowy"**

---

## ⚙️ Krok 2: Wypełnij formularz budżetu

| Pole | Co wybrać |
|---|---|
| **Rok** | Rok budżetowy, np. `2026` |
| **Lokalizacja** | Twój dom zakonny |
| **Metoda prognozowania** | Wybierz **„Ręcznie"** |

Po wybraniu metody „Ręcznie" kliknij przycisk **„Utwórz puste pozycje"** – system wygeneruje listę wszystkich kont do wypełnienia.

---

## 📊 Krok 3: Wprowadź PRZYCHODY (konta 7xx)

Otwórz zakładkę **„Realizacja i Budżet Domu"** w pliku Excel – **strona 1 (przychody)**.

Znajdź kolumnę **„BUDŻET"** (zwykle ostatnia kolumna z prawej).

Przepisz kwoty do systemu według poniższej tabeli:

| Konto w systemie | Nazwa | Gdzie szukać w Excelu |
|---|---|---|
| **700** | Sprzedaż | Wiersz „Sprzedaż wyrobów..." |
| **750** | Przychody finansowe | Wiersz „Przychody finansowe" |
| **760** | Pozostałe przychody operacyjne | Wiersz „Pozostałe przychody operacyjne" |
| **770** | Zyski nadzwyczajne | Wiersz „Zyski nadzwyczajne" |

### 💡 Wskazówki:
- Wpisuj **same liczby**, np. `170000` (nie: `170 000 zł`)
- System sam sformatuje kwotę z separatorami tysięcy
- Jeśli w Excelu jest `0` lub brak danych – zostaw `0` w systemie

---

## 💸 Krok 4: Wprowadź ROZCHODY (konta 4xx)

Otwórz zakładkę **„Realizacja i Budżet Domu"** w pliku Excel – **strona 2 (rozchody/koszty)**.

Ponownie szukaj kolumny **„BUDŻET"**.

| Konto w systemie | Nazwa | Gdzie szukać w Excelu |
|---|---|---|
| **400** | Amortyzacja | Wiersz „Amortyzacja" |
| **401** | Zużycie materiałów i energii | Wiersz „Zużycie materiałów i energii" |
| **402** | Usługi obce | Wiersz „Usługi obce" |
| **403** | Podatki i opłaty | Wiersz „Podatki i opłaty" |
| **404** | Wynagrodzenia | Wiersz „Wynagrodzenia" |
| **405** | Ubezpieczenia społeczne | Wiersz „Ubezpieczenia społeczne i inne świadczenia" |
| **409** | Pozostałe koszty rodzajowe | Wiersz „Pozostałe koszty rodzajowe" |
| **440** | Koszty bezpośrednie | Wiersz „Koszty bezpośrednie/Koszty" |
| **460** | Koszty ogólnozakładowe | Wiersz „Koszty ogólnego zarządu" (jeśli dotyczy) |
| **490** | Rozliczenie kosztów | Wiersz „Rozliczenie kosztów" |

---

## 🏛️ Krok 5: Wprowadź ŚWIADCZENIA NA PROWINCJĘ (konto 201)

Otwórz zakładkę **„Formularz należności do prowincji"** w pliku Excel.

Zsumuj pozycje i wpisz łączną kwotę w konto **201** (Rozrachunki – Świadczenia na prowincję):

| Pozycja w Excelu | Co to jest |
|---|---|
| Kontrybucje (poz. 2) | Miesięczne składki na prowincję |
| ZUS OMI (poz. 4) | Ubezpieczenie społeczne zakonników |
| III filar (poz. 5) | Składki emerytalne – III filar |

> ⚠️ **Ważne:** Wpisz **sumę roczną** tych pozycji. Jeśli w Excelu są kwoty miesięczne – pomnóż × 12.

---

## 📝 Krok 6: Dodatkowe pola (opcjonalne)

| Pole | Kiedy wypełnić |
|---|---|
| **Prognozowane dodatkowe wydatki** | Jeśli planujesz remont, zakup sprzętu itp. |
| **Opis dodatkowych wydatków** | Krótki opis czego dotyczą |
| **Planowana redukcja kosztów** | Jeśli planujesz oszczędności |
| **Opis redukcji** | Na czym chcesz zaoszczędzić |

---

## 💾 Krok 7: Zapisz budżet

Masz **dwie opcje**:

| Przycisk | Co robi | Kiedy użyć |
|---|---|---|
| **💾 Zapisz szkic** | Zapisuje budżet jako wersję roboczą – możesz wrócić i edytować | Gdy jeszcze sprawdzasz dane |
| **📤 Złóż do zatwierdzenia** | Wysyła budżet do prowincjała/admina do akceptacji | Gdy dane są kompletne i poprawne |

> ⚠️ Po złożeniu do zatwierdzenia **nie można edytować** budżetu. Jeśli zostanie odrzucony – wraca do edycji z komentarzem.

---

## ✅ Kontrola poprawności

Przed złożeniem sprawdź:

- [ ] Czy **suma przychodów** zgadza się z Excelem
- [ ] Czy **suma rozchodów** zgadza się z Excelem  
- [ ] Czy **świadczenia na prowincję** (konto 201) zawierają kontrybucje + ZUS + III filar
- [ ] Czy wpisałeś kwoty **roczne** (nie miesięczne)

---

## 🔋 Po zatwierdzeniu – Monitoring realizacji

Po zatwierdzeniu budżetu system automatycznie porównuje plan z realizacją:

| Kolor baterii | Znaczenie |
|---|---|
| 🟢 Zielony | Realizacja 0–80% – wszystko OK |
| 🟠 Pomarańczowy | Realizacja 81–100% – zbliżasz się do limitu |
| 🔴 Czerwony | Realizacja >100% – budżet przekroczony! |
| ⚪ Szary | Realizacja <50% – bardzo niska |

---

## ❓ Najczęstsze pytania

**P: Co jeśli nie mam danych dla jakiegoś konta?**
O: Zostaw kwotę `0`. Możesz zaktualizować budżet później (jeśli jest jeszcze w statusie „szkic").

**P: Czy muszę wprowadzać dane z zakładki „Przychody rozchody z podziałem"?**
O: Nie. Ta zakładka zawiera szczegółowy rozbicie na podkonta. System operuje na kontach głównych (np. 440), więc wystarczą dane z zakładki „Realizacja i Budżet Domu".

**P: Skąd wziąć kwotę za poprzedni rok?**
O: System automatycznie pobiera realizację z poprzedniego roku, jeśli były wprowadzone dokumenty. Nie musisz tego wpisywać ręcznie.

**P: Co jeśli prowincjał odrzuci budżet?**
O: Budżet wróci do statusu „szkic" z komentarzem. Popraw wskazane pozycje i złóż ponownie.',
  'budzet',
  true,
  'fbdffef6-646d-4237-aa54-62ae80792ba4',
  ARRAY['ekonom', 'admin', 'prowincjal']
);
