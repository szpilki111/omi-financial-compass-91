
// supabase/functions/setup-demo-data/index.ts
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Funkcja pomocnicza do generowania losowej daty z ostatnich 90 dni
function getRandomDate(days = 90): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * days));
  return date.toISOString().split('T')[0];
}

// Funkcja pomocnicza do losowego wyboru elementu z tablicy
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

serve(async (req: Request) => {
  // Obsługa żądań OPTIONS dla CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Tworzenie klienta Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Tworzenie użytkownika admina
    const adminEmail = "admin@omi.pl";
    let adminUserId;
    
    // Sprawdź czy użytkownik już istnieje
    const { data: existingUsers } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", adminEmail);
    
    if (existingUsers && existingUsers.length > 0) {
      adminUserId = existingUsers[0].id;
      console.log(`Użytkownik admin już istnieje z ID: ${adminUserId}`);
    } else {
      // Tworzenie użytkownika w auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: "password123",
        email_confirm: true
      });

      if (authError) throw new Error(`Błąd przy tworzeniu użytkownika auth: ${authError.message}`);
      
      adminUserId = authUser.user.id;
      
      // Dodanie profilu dla admina
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: adminUserId,
          name: "Administrator Systemu",
          email: adminEmail,
          role: "admin"
        });
        
      if (profileError) throw new Error(`Błąd przy tworzeniu profilu admina: ${profileError.message}`);
      console.log(`Utworzono użytkownika admina z ID: ${adminUserId}`);
    }

    // 2. Tworzenie użytkowników dla każdego domu zakonnego
    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("*");
    
    if (locationsError) throw new Error(`Błąd przy pobieraniu placówek: ${locationsError.message}`);
    
    for (const location of locations || []) {
      const ekonomEmail = `ekonom.${location.name.toLowerCase().replace(/\s+/g, '.')}@omi.pl`;
      
      // Sprawdź czy użytkownik już istnieje
      const { data: existingUsers } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", ekonomEmail);
      
      if (existingUsers && existingUsers.length > 0) {
        console.log(`Użytkownik ${ekonomEmail} już istnieje`);
        continue;
      }
      
      // Tworzenie użytkownika w auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: ekonomEmail,
        password: "password123",
        email_confirm: true
      });
      
      if (authError) {
        console.error(`Błąd przy tworzeniu użytkownika ${ekonomEmail}: ${authError.message}`);
        continue;
      }
      
      // Dodanie profilu dla ekonoma
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          name: `Ekonom ${location.name}`,
          email: ekonomEmail,
          role: "ekonom",
          location_id: location.id
        });
        
      if (profileError) {
        console.error(`Błąd przy tworzeniu profilu dla ${ekonomEmail}: ${profileError.message}`);
        continue;
      }
      
      console.log(`Utworzono użytkownika ekonoma dla ${location.name}`);
    }

    // 3. Tworzenie użytkownika prowincjała
    const prowincjalEmail = "prowincjal@omi.pl";
    
    // Sprawdź czy użytkownik już istnieje
    const { data: existingProwincjal } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", prowincjalEmail);
    
    if (!(existingProwincjal && existingProwincjal.length > 0)) {
      // Tworzenie użytkownika w auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: prowincjalEmail,
        password: "password123",
        email_confirm: true
      });
      
      if (authError) throw new Error(`Błąd przy tworzeniu użytkownika prowincjała: ${authError.message}`);
      
      // Dodanie profilu dla prowincjała
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          name: "Ojciec Prowincjał",
          email: prowincjalEmail,
          role: "prowincjal"
        });
        
      if (profileError) throw new Error(`Błąd przy tworzeniu profilu prowincjała: ${profileError.message}`);
      console.log("Utworzono użytkownika prowincjała");
    } else {
      console.log("Użytkownik prowincjał już istnieje");
    }

    // 4. Dodanie przykładowych transakcji dla każdej placówki
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, location_id")
      .eq("role", "ekonom");
    
    if (profilesError) throw new Error(`Błąd przy pobieraniu profili: ${profilesError.message}`);
    
    // Pobierz konta
    const { data: accounts, error: accountsError } = await supabase
      .from("accounts")
      .select("id, type, number");
    
    if (accountsError) throw new Error(`Błąd przy pobieraniu kont: ${accountsError.message}`);
    
    // Typy kont pogrupowane
    const accountsByType: Record<string, string[]> = {};
    accounts?.forEach((account) => {
      if (!accountsByType[account.type]) {
        accountsByType[account.type] = [];
      }
      accountsByType[account.type].push(account.id);
    });
    
    // Przykładowe opisy transakcji
    const incomeDescriptions = [
      "Wpłata z tacy", "Darowizna", "Opłata za intencję", 
      "Wpłata na misje", "Kolęda", "Zwrot kosztów"
    ];
    
    const expenseDescriptions = [
      "Opłata za prąd", "Rachunek za gaz", "Zakup artykułów spożywczych",
      "Materiały biurowe", "Opłata za internet", "Wynagrodzenia", "Naprawa"
    ];
    
    // Dodawanie transakcji
    for (const profile of profiles || []) {
      if (!profile.location_id) continue;
      
      // 10 przykładowych transakcji dla każdej placówki
      for (let i = 0; i < 10; i++) {
        // 70% szans na wydatki, 30% na przychody
        const isExpense = Math.random() < 0.7;
        
        let debitAccountId, creditAccountId, description;
        const amount = Math.floor(Math.random() * 5000) + 100; // Losowa kwota od 100 do 5100
        
        if (isExpense) {
          // Wydatek: asset (np. gotówka) -> expense
          debitAccountId = getRandomItem(accountsByType.expense || []);
          creditAccountId = getRandomItem(accountsByType.asset || []);
          description = getRandomItem(expenseDescriptions);
        } else {
          // Przychód: income -> asset (np. gotówka)
          debitAccountId = getRandomItem(accountsByType.asset || []);
          creditAccountId = getRandomItem(accountsByType.income || []);
          description = getRandomItem(incomeDescriptions);
        }
        
        const randomDate = getRandomDate();
        const documentNumber = `FV/${randomDate.replace(/-/g, "").substring(2)}/${String(i+1).padStart(3, '0')}`;
        const settlementType = getRandomItem(["Gotówka", "Bank", "Rozrachunek"]);
        
        // Dodanie transakcji
        const { error: transactionError } = await supabase
          .from("transactions")
          .insert({
            date: randomDate,
            document_number: documentNumber,
            description: description,
            amount: amount,
            debit_account_id: debitAccountId,
            credit_account_id: creditAccountId,
            settlement_type: settlementType,
            user_id: profile.id,
            location_id: profile.location_id
          });
          
        if (transactionError) {
          console.error(`Błąd przy tworzeniu transakcji: ${transactionError.message}`);
          continue;
        }
      }
      
      console.log(`Dodano transakcje dla placówki ID: ${profile.location_id}`);
    }
    
    // 5. Dodanie przykładowych powiadomień dla ekonomów
    for (const profile of profiles || []) {
      // 3 przykładowe powiadomienia dla każdego ekonoma
      const notifications = [
        {
          title: "Przypomnienie o raporcie",
          message: "Zbliża się termin złożenia raportu miesięcznego.",
          priority: "medium",
          action_label: "Złóż raport",
          action_link: "/raporty/nowy"
        },
        {
          title: "Nowa informacja",
          message: "Zaktualizowano instrukcję prowadzenia księgowości.",
          priority: "low",
          action_label: "Przeczytaj",
          action_link: "/baza-wiedzy"
        },
        {
          title: "Pilne!",
          message: "Proszę o pilne uzupełnienie brakujących danych za poprzedni miesiąc.",
          priority: "high"
        }
      ];
      
      for (const notif of notifications) {
        const { error: notifError } = await supabase
          .from("notifications")
          .insert({
            title: notif.title,
            message: notif.message,
            priority: notif.priority,
            user_id: profile.id,
            read: Math.random() > 0.7, // 30% szans, że powiadomienie będzie przeczytane
            action_label: notif.action_label,
            action_link: notif.action_link
          });
          
        if (notifError) {
          console.error(`Błąd przy tworzeniu powiadomienia: ${notifError.message}`);
          continue;
        }
      }
      
      console.log(`Dodano powiadomienia dla użytkownika ID: ${profile.id}`);
    }

    // 6. Dodanie danych testowych dla budżetów
    console.log("Rozpoczęcie tworzenia danych budżetowych...");
    
    // Przygotowanie struktur kont (bazowe prefiksy bez identyfikatora lokalizacji)
    const incomeAccounts = [
      { prefix: '701', name: 'Intencje odprawione', baseAmount: 150000 },
      { prefix: '702', name: 'Duszpasterstwo OMI', baseAmount: 50000 },
      { prefix: '703', name: 'Duszpasterstwo parafialne', baseAmount: 35000 },
      { prefix: '704', name: 'Kolęda', baseAmount: 25000 },
      { prefix: '710', name: 'Odsetki i przychody finansowe', baseAmount: 5000 },
      { prefix: '720', name: 'Ofiary', baseAmount: 40000 },
    ];

    const expenseAccounts = [
      { prefix: '401', name: 'Biurowe', baseAmount: 11550 },
      { prefix: '402', name: 'Poczta', baseAmount: 2500 },
      { prefix: '403', name: 'Telefony, Internet TV', baseAmount: 8400 },
      { prefix: '412', name: 'Utrzymanie samochodu', baseAmount: 28000 },
      { prefix: '420', name: 'Pensje osób zatrudnionych', baseAmount: 72000 },
      { prefix: '424', name: 'Leczenie, opieka zdrowotna', baseAmount: 15000 },
      { prefix: '440', name: 'Kuchnia i koszty posiłków', baseAmount: 45000 },
      { prefix: '444', name: 'Media, energia, woda, gaz', baseAmount: 38500 },
      { prefix: '445', name: 'Podatki i opłaty urzędowe', baseAmount: 12000 },
      { prefix: '451', name: 'Zakupy / remonty zwyczajne', baseAmount: 22000 },
    ];

    // Dla każdej lokalizacji twórz budżety dla lat 2023-2028
    for (const location of locations || []) {
      const locationProfile = profiles?.find(p => p.location_id === location.id);
      if (!locationProfile) continue;

      // Usuń istniejące budżety i transakcje dla tej lokalizacji (lata 2023-2028)
      console.log(`Usuwanie starych danych budżetowych dla lokalizacji: ${location.name}`);
      
      // Pobierz ID budżetów do usunięcia
      const { data: existingBudgets } = await supabase
        .from("budget_plans")
        .select("id")
        .eq("location_id", location.id)
        .gte("year", 2023)
        .lte("year", 2028);

      if (existingBudgets && existingBudgets.length > 0) {
        const budgetIds = existingBudgets.map(b => b.id);
        
        // Usuń pozycje budżetowe
        await supabase
          .from("budget_items")
          .delete()
          .in("budget_plan_id", budgetIds);
        
        // Usuń budżety
        await supabase
          .from("budget_plans")
          .delete()
          .in("id", budgetIds);
      }

      // Usuń transakcje dla lat 2023-2028
      await supabase
        .from("transactions")
        .delete()
        .eq("location_id", location.id)
        .gte("date", "2023-01-01")
        .lte("date", "2028-12-31");

      // 2023 - Zatwierdzony budżet z pełną realizacją
      const budget2023 = await supabase.from("budget_plans").insert({
        location_id: location.id,
        year: 2023,
        status: 'approved',
        forecast_method: 'last_year',
        additional_expenses: 0,
        planned_cost_reduction: 0,
        created_by: locationProfile.id,
        approved_by: adminUserId,
        submitted_at: new Date('2023-01-15').toISOString(),
        submitted_by: locationProfile.id,
        approved_at: new Date('2023-01-20').toISOString(),
        comments: 'Budżet zatwierdzony bez uwag'
      }).select().single();

      if (!budget2023.error && budget2023.data) {
        // Dodaj pozycje budżetowe dla 2023 z dynamicznym prefiksem
        for (const account of [...incomeAccounts, ...expenseAccounts]) {
          const variance = 0.9 + Math.random() * 0.2; // ±10% wariancja
          const plannedAmount = account.baseAmount * variance;
          const previousYearAmount = account.baseAmount * (0.85 + Math.random() * 0.2);
          const fullPrefix = `${account.prefix}-${location.location_identifier}`;

          await supabase.from("budget_items").insert({
            budget_plan_id: budget2023.data.id,
            account_prefix: fullPrefix,
            account_name: account.name,
            account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
            planned_amount: plannedAmount,
            forecasted_amount: plannedAmount,
            previous_year_amount: previousYearAmount
          });
        }
        
        // Generuj transakcje dla całego 2023 (pełna realizacja)
        for (let month = 1; month <= 12; month++) {
          for (const account of expenseAccounts.slice(0, 5)) { // 5 transakcji na miesiąc
            const day = Math.floor(Math.random() * 28) + 1;
            const date = `2023-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const amount = (account.baseAmount / 12) * (0.8 + Math.random() * 0.4);
            
            const fullAccountNumber = `${account.prefix}-${location.location_identifier}`;
            const debitAccount = accounts?.find(a => a.number === fullAccountNumber);
            const creditAccount = accounts?.find(a => a.type === 'asset');
            
            if (debitAccount && creditAccount) {
              await supabase.from("transactions").insert({
                date: date,
                document_number: `FV/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2023`,
                description: `Wydatek - ${account.name}`,
                debit_amount: amount,
                credit_amount: amount,
                debit_account_id: debitAccount.id,
                credit_account_id: creditAccount.id,
                settlement_type: getRandomItem(['Gotówka', 'Bank', 'Rozrachunek']),
                user_id: locationProfile.id,
                location_id: location.id,
                currency: 'PLN'
              });
            }
          }
        }
      }

      // 2024 - Zatwierdzony budżet z pełną realizacją
      const budget2024 = await supabase.from("budget_plans").insert({
        location_id: location.id,
        year: 2024,
        status: 'approved',
        forecast_method: 'last_year',
        additional_expenses: 10000,
        additional_expenses_description: 'Planowany remont dachu',
        planned_cost_reduction: 5000,
        planned_cost_reduction_description: 'Oszczędności na mediach',
        created_by: locationProfile.id,
        approved_by: adminUserId,
        submitted_at: new Date('2024-01-10').toISOString(),
        submitted_by: locationProfile.id,
        approved_at: new Date('2024-01-15').toISOString(),
        comments: 'Budżet z uwzględnieniem remontu dachu'
      }).select().single();

      if (!budget2024.error && budget2024.data) {
        for (const account of [...incomeAccounts, ...expenseAccounts]) {
          const variance = 0.9 + Math.random() * 0.2;
          const plannedAmount = account.baseAmount * variance * 1.05; // 5% wzrost względem 2023
          const previousYearAmount = account.baseAmount * variance;
          const fullPrefix = `${account.prefix}-${location.location_identifier}`;

          await supabase.from("budget_items").insert({
            budget_plan_id: budget2024.data.id,
            account_prefix: fullPrefix,
            account_name: account.name,
            account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
            planned_amount: plannedAmount,
            forecasted_amount: plannedAmount,
            previous_year_amount: previousYearAmount
          });
        }

        // Generuj transakcje dla całego 2024
        for (let month = 1; month <= 12; month++) {
          for (const account of expenseAccounts.slice(0, 6)) {
            const day = Math.floor(Math.random() * 28) + 1;
            const date = `2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const amount = (account.baseAmount * 1.05 / 12) * (0.8 + Math.random() * 0.4);
            
            const fullAccountNumber = `${account.prefix}-${location.location_identifier}`;
            const debitAccount = accounts?.find(a => a.number === fullAccountNumber);
            const creditAccount = accounts?.find(a => a.type === 'asset');
            
            if (debitAccount && creditAccount) {
              await supabase.from("transactions").insert({
                date: date,
                document_number: `FV/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2024`,
                description: `Wydatek - ${account.name}`,
                debit_amount: amount,
                credit_amount: amount,
                debit_account_id: debitAccount.id,
                credit_account_id: creditAccount.id,
                settlement_type: getRandomItem(['Gotówka', 'Bank', 'Rozrachunek']),
                user_id: locationProfile.id,
                location_id: location.id,
                currency: 'PLN'
              });
            }
          }
        }
      }

      // 2025 - Zatwierdzony budżet z częściową realizacją (do listopada)
      const budget2025 = await supabase.from("budget_plans").insert({
        location_id: location.id,
        year: 2025,
        status: 'approved',
        forecast_method: 'avg_3_years',
        additional_expenses: 15000,
        additional_expenses_description: 'Rozbudowa obiektu sklepu',
        planned_cost_reduction: 8000,
        planned_cost_reduction_description: 'Zwolnienie dwóch pracowników',
        created_by: locationProfile.id,
        approved_by: adminUserId,
        submitted_at: new Date('2025-01-05').toISOString(),
        submitted_by: locationProfile.id,
        approved_at: new Date('2025-01-12').toISOString(),
        comments: 'Budżet z uwzględnieniem rozbudowy'
      }).select().single();

      if (!budget2025.error && budget2025.data) {
        for (const account of [...incomeAccounts, ...expenseAccounts]) {
          const variance = 0.9 + Math.random() * 0.2;
          const plannedAmount = account.baseAmount * variance * 1.08; // 8% wzrost
          const previousYearAmount = account.baseAmount * variance * 1.05;
          const fullPrefix = `${account.prefix}-${location.location_identifier}`;

          await supabase.from("budget_items").insert({
            budget_plan_id: budget2025.data.id,
            account_prefix: fullPrefix,
            account_name: account.name,
            account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
            planned_amount: plannedAmount,
            forecasted_amount: plannedAmount,
            previous_year_amount: previousYearAmount
          });
        }

        // Generuj transakcje dla stycznia-listopada 2025 (RÓŻNORODNE POZIOMY REALIZACJI DLA BATERII)
        for (let month = 1; month <= 11; month++) {
          // Różne poziomy realizacji dla lepszej wizualizacji baterii (więcej kolorów)
          let realizationFactor = 1.0;
          if (month === 1) realizationFactor = 0.72; // Styczeń: 72% - zielony
          else if (month === 2) realizationFactor = 0.65; // Luty: 65% - zielony
          else if (month === 3) realizationFactor = 0.85; // Marzec: 85% - pomarańczowy
          else if (month === 4) realizationFactor = 0.78; // Kwiecień: 78% - zielony
          else if (month === 5) realizationFactor = 0.92; // Maj: 92% - pomarańczowy
          else if (month === 6) realizationFactor = 1.03; // Czerwiec: 103% - czerwony
          else if (month === 7) realizationFactor = 0.88; // Lipiec: 88% - pomarańczowy
          else if (month === 8) realizationFactor = 1.08; // Sierpień: 108% - czerwony
          else if (month === 9) realizationFactor = 0.70; // Wrzesień: 70% - zielony
          else if (month === 10) realizationFactor = 0.45; // Październik: 45% - szary
          else realizationFactor = 0.38; // Listopad: 38% - szary

          for (const account of expenseAccounts) {
            const day = Math.floor(Math.random() * 28) + 1;
            const date = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const amount = (account.baseAmount * 1.08 / 12) * realizationFactor * (0.95 + Math.random() * 0.1);
            
            const fullAccountNumber = `${account.prefix}-${location.location_identifier}`;
            const debitAccount = accounts?.find(a => a.number === fullAccountNumber);
            const creditAccount = accounts?.find(a => a.type === 'asset');
            
            if (debitAccount && creditAccount) {
              await supabase.from("transactions").insert({
                date: date,
                document_number: `FV/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2025`,
                description: `Wydatek - ${account.name}`,
                debit_amount: amount,
                credit_amount: amount,
                debit_account_id: debitAccount.id,
                credit_account_id: creditAccount.id,
                settlement_type: getRandomItem(['Gotówka', 'Bank', 'Rozrachunek']),
                user_id: locationProfile.id,
                location_id: location.id,
                currency: 'PLN'
              });
            }
          }
        }
      }

      // 2026 - Zatwierdzony budżet z realizacją (tylko dla Gorzowa)
      if (location.name === 'Gorzów') {
        const budget2026 = await supabase.from("budget_plans").insert({
          location_id: location.id,
          year: 2026,
          status: 'approved',
          forecast_method: 'avg_3_years',
          additional_expenses: 18000,
          additional_expenses_description: 'Remont kuchni',
          planned_cost_reduction: 10000,
          planned_cost_reduction_description: 'Optymalizacja kosztów mediów',
          created_by: locationProfile.id,
          approved_by: adminUserId,
          submitted_at: new Date('2026-01-08').toISOString(),
          submitted_by: locationProfile.id,
          approved_at: new Date('2026-01-15').toISOString(),
          comments: 'Budżet z uwzględnieniem remontu kuchni'
        }).select().single();

        if (!budget2026.error && budget2026.data) {
          for (const account of [...incomeAccounts, ...expenseAccounts]) {
            const variance = 0.9 + Math.random() * 0.2;
            const plannedAmount = account.baseAmount * variance * 1.10;
            const previousYearAmount = account.baseAmount * variance * 1.08;
            const fullPrefix = `${account.prefix}-${location.location_identifier}`;

            await supabase.from("budget_items").insert({
              budget_plan_id: budget2026.data.id,
              account_prefix: fullPrefix,
              account_name: account.name,
              account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
              planned_amount: plannedAmount,
              forecasted_amount: plannedAmount,
              previous_year_amount: previousYearAmount
            });
          }

          // Generuj transakcje dla stycznia-grudnia 2026 (różne poziomy realizacji)
          for (let month = 1; month <= 12; month++) {
            let realizationFactor = 1.0;
            if (month === 1) realizationFactor = 0.68; // Styczeń: 68% - zielony
            else if (month === 2) realizationFactor = 0.82; // Luty: 82% - pomarańczowy
            else if (month === 3) realizationFactor = 0.75; // Marzec: 75% - zielony
            else if (month === 4) realizationFactor = 0.95; // Kwiecień: 95% - pomarańczowy
            else if (month === 5) realizationFactor = 1.06; // Maj: 106% - czerwony
            else if (month === 6) realizationFactor = 0.88; // Czerwiec: 88% - pomarańczowy
            else if (month === 7) realizationFactor = 0.42; // Lipiec: 42% - szary
            else if (month === 8) realizationFactor = 0.79; // Sierpień: 79% - zielony
            else if (month === 9) realizationFactor = 1.11; // Wrzesień: 111% - czerwony
            else if (month === 10) realizationFactor = 0.85; // Październik: 85% - pomarańczowy
            else if (month === 11) realizationFactor = 0.70; // Listopad: 70% - zielony
            else realizationFactor = 0.48; // Grudzień: 48% - szary

            for (const account of expenseAccounts) {
              const day = Math.floor(Math.random() * 28) + 1;
              const date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const amount = (account.baseAmount * 1.10 / 12) * realizationFactor * (0.95 + Math.random() * 0.1);
              
              const fullAccountNumber = `${account.prefix}-${location.location_identifier}`;
              const debitAccount = accounts?.find(a => a.number === fullAccountNumber);
              const creditAccount = accounts?.find(a => a.type === 'asset');
              
              if (debitAccount && creditAccount) {
                await supabase.from("transactions").insert({
                  date: date,
                  document_number: `FV/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2026`,
                  description: `Wydatek - ${account.name}`,
                  debit_amount: amount,
                  credit_amount: amount,
                  debit_account_id: debitAccount.id,
                  credit_account_id: creditAccount.id,
                  settlement_type: getRandomItem(['Gotówka', 'Bank', 'Rozrachunek']),
                  user_id: locationProfile.id,
                  location_id: location.id,
                  currency: 'PLN'
                });
              }
            }
          }
        }
      } else {
        // Dla pozostałych lokalizacji - Draft
        const budget2026Draft = await supabase.from("budget_plans").insert({
          location_id: location.id,
          year: 2026,
          status: 'draft',
          forecast_method: 'avg_3_years',
          additional_expenses: 0,
          planned_cost_reduction: 0,
          created_by: locationProfile.id,
          comments: 'Budżet w przygotowaniu - do uzupełnienia'
        }).select().single();

        if (!budget2026Draft.error && budget2026Draft.data) {
          for (const account of [...incomeAccounts, ...expenseAccounts]) {
            const variance = 0.9 + Math.random() * 0.2;
            const plannedAmount = account.baseAmount * variance * 1.10;
            const previousYearAmount = account.baseAmount * variance * 1.08;
            const fullPrefix = `${account.prefix}-${location.location_identifier}`;

            await supabase.from("budget_items").insert({
              budget_plan_id: budget2026Draft.data.id,
              account_prefix: fullPrefix,
              account_name: account.name,
              account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
              planned_amount: plannedAmount,
              forecasted_amount: plannedAmount,
              previous_year_amount: previousYearAmount
            });
          }
        }
      }

      // 2027 - Zatwierdzony budżet z realizacją (tylko dla Gorzowa)
      if (location.name === 'Gorzów') {
        const budget2027 = await supabase.from("budget_plans").insert({
          location_id: location.id,
          year: 2027,
          status: 'approved',
          forecast_method: 'last_year',
          additional_expenses: 20000,
          additional_expenses_description: 'Modernizacja instalacji elektrycznej',
          planned_cost_reduction: 12000,
          planned_cost_reduction_description: 'Instalacja paneli fotowoltaicznych',
          created_by: locationProfile.id,
          approved_by: adminUserId,
          submitted_at: new Date('2027-01-10').toISOString(),
          submitted_by: locationProfile.id,
          approved_at: new Date('2027-01-18').toISOString(),
          comments: 'Budżet z uwzględnieniem modernizacji elektrycznej'
        }).select().single();

        if (!budget2027.error && budget2027.data) {
          for (const account of [...incomeAccounts, ...expenseAccounts]) {
            const variance = 0.9 + Math.random() * 0.2;
            const plannedAmount = account.baseAmount * variance * 1.12;
            const previousYearAmount = account.baseAmount * variance * 1.10;
            const fullPrefix = `${account.prefix}-${location.location_identifier}`;

            await supabase.from("budget_items").insert({
              budget_plan_id: budget2027.data.id,
              account_prefix: fullPrefix,
              account_name: account.name,
              account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
              planned_amount: plannedAmount,
              forecasted_amount: plannedAmount,
              previous_year_amount: previousYearAmount
            });
          }

          // Generuj transakcje dla stycznia-grudnia 2027 (różne poziomy realizacji)
          for (let month = 1; month <= 12; month++) {
            let realizationFactor = 1.0;
            if (month === 1) realizationFactor = 0.91; // Styczeń: 91% - pomarańczowy
            else if (month === 2) realizationFactor = 0.47; // Luty: 47% - szary
            else if (month === 3) realizationFactor = 0.83; // Marzec: 83% - pomarańczowy
            else if (month === 4) realizationFactor = 1.09; // Kwiecień: 109% - czerwony
            else if (month === 5) realizationFactor = 0.73; // Maj: 73% - zielony
            else if (month === 6) realizationFactor = 0.86; // Czerwiec: 86% - pomarańczowy
            else if (month === 7) realizationFactor = 0.77; // Lipiec: 77% - zielony
            else if (month === 8) realizationFactor = 1.04; // Sierpień: 104% - czerwony
            else if (month === 9) realizationFactor = 0.68; // Wrzesień: 68% - zielony
            else if (month === 10) realizationFactor = 0.94; // Październik: 94% - pomarańczowy
            else if (month === 11) realizationFactor = 0.44; // Listopad: 44% - szary
            else realizationFactor = 0.80; // Grudzień: 80% - zielony

            for (const account of expenseAccounts) {
              const day = Math.floor(Math.random() * 28) + 1;
              const date = `2027-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const amount = (account.baseAmount * 1.12 / 12) * realizationFactor * (0.95 + Math.random() * 0.1);
              
              const fullAccountNumber = `${account.prefix}-${location.location_identifier}`;
              const debitAccount = accounts?.find(a => a.number === fullAccountNumber);
              const creditAccount = accounts?.find(a => a.type === 'asset');
              
              if (debitAccount && creditAccount) {
                await supabase.from("transactions").insert({
                  date: date,
                  document_number: `FV/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2027`,
                  description: `Wydatek - ${account.name}`,
                  debit_amount: amount,
                  credit_amount: amount,
                  debit_account_id: debitAccount.id,
                  credit_account_id: creditAccount.id,
                  settlement_type: getRandomItem(['Gotówka', 'Bank', 'Rozrachunek']),
                  user_id: locationProfile.id,
                  location_id: location.id,
                  currency: 'PLN'
                });
              }
            }
          }
        }
      } else {
        // Dla pozostałych lokalizacji - Submitted (50% szans)
        if (Math.random() > 0.5) {
          const budget2027Submitted = await supabase.from("budget_plans").insert({
            location_id: location.id,
            year: 2027,
            status: 'submitted',
            forecast_method: 'last_year',
            additional_expenses: 12000,
            additional_expenses_description: 'Wymiana okien',
            planned_cost_reduction: 6000,
            planned_cost_reduction_description: 'Redukcja kosztów energii',
            created_by: locationProfile.id,
            submitted_at: new Date().toISOString(),
            submitted_by: locationProfile.id,
            comments: 'Budżet złożony do zatwierdzenia przez prowincjała'
          }).select().single();

          if (!budget2027Submitted.error && budget2027Submitted.data) {
            for (const account of [...incomeAccounts, ...expenseAccounts]) {
              const variance = 0.9 + Math.random() * 0.2;
              const plannedAmount = account.baseAmount * variance * 1.12;
              const previousYearAmount = account.baseAmount * variance * 1.10;
              const fullPrefix = `${account.prefix}-${location.location_identifier}`;

              await supabase.from("budget_items").insert({
                budget_plan_id: budget2027Submitted.data.id,
                account_prefix: fullPrefix,
                account_name: account.name,
                account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
                planned_amount: plannedAmount,
                forecasted_amount: plannedAmount,
                previous_year_amount: previousYearAmount
              });
            }
          }
        }
      }

      // 2028 - Zatwierdzony budżet z realizacją (tylko dla Gorzowa)
      if (location.name === 'Gorzów') {
        const budget2028 = await supabase.from("budget_plans").insert({
          location_id: location.id,
          year: 2028,
          status: 'approved',
          forecast_method: 'avg_3_years',
          additional_expenses: 25000,
          additional_expenses_description: 'Remont elewacji',
          planned_cost_reduction: 15000,
          planned_cost_reduction_description: 'Optymalizacja zużycia energii po modernizacji',
          created_by: locationProfile.id,
          approved_by: adminUserId,
          submitted_at: new Date('2028-01-05').toISOString(),
          submitted_by: locationProfile.id,
          approved_at: new Date('2028-01-12').toISOString(),
          comments: 'Budżet z uwzględnieniem remontu elewacji'
        }).select().single();

        if (!budget2028.error && budget2028.data) {
          for (const account of [...incomeAccounts, ...expenseAccounts]) {
            const variance = 0.9 + Math.random() * 0.2;
            const plannedAmount = account.baseAmount * variance * 1.15;
            const previousYearAmount = account.baseAmount * variance * 1.12;
            const fullPrefix = `${account.prefix}-${location.location_identifier}`;

            await supabase.from("budget_items").insert({
              budget_plan_id: budget2028.data.id,
              account_prefix: fullPrefix,
              account_name: account.name,
              account_type: account.prefix.startsWith('7') ? 'income' : 'expense',
              planned_amount: plannedAmount,
              forecasted_amount: plannedAmount,
              previous_year_amount: previousYearAmount
            });
          }

          // Generuj transakcje dla stycznia-grudnia 2028 (różne poziomy realizacji)
          for (let month = 1; month <= 12; month++) {
            let realizationFactor = 1.0;
            if (month === 1) realizationFactor = 0.76; // Styczeń: 76% - zielony
            else if (month === 2) realizationFactor = 0.89; // Luty: 89% - pomarańczowy
            else if (month === 3) realizationFactor = 1.07; // Marzec: 107% - czerwony
            else if (month === 4) realizationFactor = 0.72; // Kwiecień: 72% - zielony
            else if (month === 5) realizationFactor = 0.46; // Maj: 46% - szary
            else if (month === 6) realizationFactor = 0.93; // Czerwiec: 93% - pomarańczowy
            else if (month === 7) realizationFactor = 0.81; // Lipiec: 81% - pomarańczowy
            else if (month === 8) realizationFactor = 0.69; // Sierpień: 69% - zielony
            else if (month === 9) realizationFactor = 1.12; // Wrzesień: 112% - czerwony
            else if (month === 10) realizationFactor = 0.87; // Październik: 87% - pomarańczowy
            else if (month === 11) realizationFactor = 0.74; // Listopad: 74% - zielony
            else realizationFactor = 0.49; // Grudzień: 49% - szary

            for (const account of expenseAccounts) {
              const day = Math.floor(Math.random() * 28) + 1;
              const date = `2028-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const amount = (account.baseAmount * 1.15 / 12) * realizationFactor * (0.95 + Math.random() * 0.1);
              
              const fullAccountNumber = `${account.prefix}-${location.location_identifier}`;
              const debitAccount = accounts?.find(a => a.number === fullAccountNumber);
              const creditAccount = accounts?.find(a => a.type === 'asset');
              
              if (debitAccount && creditAccount) {
                await supabase.from("transactions").insert({
                  date: date,
                  document_number: `FV/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2028`,
                  description: `Wydatek - ${account.name}`,
                  debit_amount: amount,
                  credit_amount: amount,
                  debit_account_id: debitAccount.id,
                  credit_account_id: creditAccount.id,
                  settlement_type: getRandomItem(['Gotówka', 'Bank', 'Rozrachunek']),
                  user_id: locationProfile.id,
                  location_id: location.id,
                  currency: 'PLN'
                });
              }
            }
          }
        }
      }

      // Dodaj powiadomienie o budżecie dla ekonoma
      await supabase.from("notifications").insert({
        title: "Status budżetu 2026",
        message: "Budżet na rok 2026 jest w trakcie przygotowania. Proszę uzupełnić brakujące dane.",
        priority: "medium",
        user_id: locationProfile.id,
        read: false,
        action_label: "Przejdź do budżetu",
        action_link: "/budzet"
      });

      console.log(`Dodano dane budżetowe dla lokalizacji: ${location.name}`);
    }

    console.log("Zakończono tworzenie danych budżetowych!");
    

    return new Response(
      JSON.stringify({
        success: true,
        message: "Pomyślnie utworzono przykładowe dane"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Nieznany błąd"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
