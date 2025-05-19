
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
      .select("id, type");
    
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
