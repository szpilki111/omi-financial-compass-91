import { supabase } from "@/integrations/supabase/client";

export const INCOME_ACCOUNTS = [
  { prefix: '701-2-2', name: 'Intencje odprawione' },
  { prefix: '702-2-2', name: 'Duszpasterstwo OMI' },
  { prefix: '703-2-2', name: 'Duszpasterstwo parafialne' },
  { prefix: '704-2-2', name: 'Kolęda' },
  { prefix: '705-2-2', name: 'Zastępstwa zagraniczne' },
  { prefix: '706-2-2', name: 'Wypominki parafialne' },
  { prefix: '710-2-2', name: 'Odsetki i przychody finansowe' },
  { prefix: '711-2-2', name: 'Sprzedaż kalendarzy' },
  { prefix: '712-2-2', name: 'Dzierżawa' },
  { prefix: '713-2-2', name: 'Sprzedaż z działalności gospodarczej' },
  { prefix: '714-2-2', name: 'Pensje, emerytury i renty' },
  { prefix: '715-2-2', name: 'Zwroty' },
  { prefix: '716-2-2', name: 'Usługi, noclegi, rekolektanci' },
  { prefix: '717-2-2', name: 'Inne' },
  { prefix: '718-2-2', name: 'Usługi działalności gospodarczej' },
  { prefix: '719-2-2', name: 'Dzierżawa przechodnia' },
  { prefix: '720-2-2', name: 'Ofiary' },
  { prefix: '724-2-2', name: 'Msze Wieczyste' },
  { prefix: '725-2-2', name: 'Nadzwyczajne przychody' },
  { prefix: '727-2-2', name: 'Cmentarz' },
  { prefix: '728-2-2', name: 'Różnice kursowe' },
  { prefix: '730-2-2', name: 'Sprzedaż majątku trwałego' },
];

export const EXPENSE_ACCOUNTS = [
  { prefix: '401-2-2', name: 'Biurowe' },
  { prefix: '402-2-2', name: 'Poczta' },
  { prefix: '403-2-2', name: 'Telefony, Internet TV' },
  { prefix: '404-2-2', name: 'Reprezentacyjne' },
  { prefix: '405-2-2', name: 'Prowizje i opłaty bankowe' },
  { prefix: '406-2-2', name: 'Usługi serwisowe' },
  { prefix: '407-2-2', name: 'Wywóz śmieci i nieczystości' },
  { prefix: '408-2-2', name: 'Ubezpieczenie majątku trwałego' },
  { prefix: '410-2-2', name: 'Pralnia, artykuły chemiczne i konserwacja' },
  { prefix: '411-2-2', name: 'Podróże komunikacją publiczną' },
  { prefix: '412-2-2', name: 'Utrzymanie samochodu oraz zakup nowego' },
  { prefix: '413-2-2', name: 'Noclegi' },
  { prefix: '414-2-2', name: 'Honoraria duszpasterskie' },
  { prefix: '420-2-2', name: 'Pensje osób zatrudnionych' },
  { prefix: '421-2-2', name: 'Osobiste, higiena osobista' },
  { prefix: '422-2-2', name: 'Formacja pierwsza' },
  { prefix: '423-2-2', name: 'Formacja ustawiczna' },
  { prefix: '424-2-2', name: 'Leczenie, opieka zdrowotna' },
  { prefix: '430-2-2', name: 'Kult' },
  { prefix: '431-2-2', name: 'Książki, gazety, czasopisma, prenumeraty' },
  { prefix: '435-2-2', name: 'Wakacyjne' },
  { prefix: '439-2-2', name: 'Koszty kolędy' },
  { prefix: '440-2-2', name: 'Kuchnia i koszty posiłków' },
  { prefix: '441-2-2', name: 'Funkcjonowanie salonu' },
  { prefix: '442-2-2', name: 'Odzież' },
  { prefix: '444-2-2', name: 'Media, energia, woda, gaz, itd.' },
  { prefix: '445-2-2', name: 'Podatki i opłaty urzędowe' },
  { prefix: '446-2-2', name: 'Ogród, park i cmentarz' },
  { prefix: '447-2-2', name: 'Usługi działalności gospodarczej' },
  { prefix: '448-2-2', name: 'Towary do sprzedaży' },
  { prefix: '449-2-2', name: 'Zakup towarów działalności gospodarczej' },
  { prefix: '450-2-2', name: 'Inne' },
  { prefix: '451-2-2', name: 'Zakupy / remonty zwyczajne' },
  { prefix: '452-2-2', name: 'Zakupy / remonty nadzwyczajne' },
  { prefix: '453-2-2', name: 'Spotkania delegacje' },
  { prefix: '454-2-2', name: 'Scholastykat międzynarodowy' },
  { prefix: '455-2-2', name: 'Studia, studenci, szkolenia' },
  { prefix: '456-2-2', name: 'Powołania' },
  { prefix: '457-2-2', name: 'Apostolat i posługi' },
  { prefix: '458-2-2', name: 'Biedni' },
  { prefix: '459-2-2', name: 'Misje, pomoc misjonarzom' },
  { prefix: '461-2-2', name: 'Kuria diecezjalna' },
  { prefix: '462-2-2', name: 'Świadczenia na dom' },
  { prefix: '201-460', name: 'Świadczenia na prowincję' },
];

interface AccountBalance {
  account_prefix: string;
  total: number;
}

/**
 * Oblicza sumę transakcji dla danego konta w określonym roku
 */
export async function getAccountBalanceForYear(
  locationId: string,
  year: number,
  accountPrefix: string,
  accountType: 'income' | 'expense'
): Promise<number> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  let query = supabase
    .from('transactions')
    .select('debit_amount, credit_amount')
    .eq('location_id', locationId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Dla przychodów sprawdzamy konta Ma (credit)
  // Dla rozchodów sprawdzamy konta Winien (debit)
  if (accountType === 'income') {
    query = query.like('credit_account_id', `%${accountPrefix.split('-')[0]}%`);
  } else {
    query = query.like('debit_account_id', `%${accountPrefix.split('-')[0]}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching account balance:', error);
    return 0;
  }

  const total = data?.reduce((sum, t) => {
    if (accountType === 'income') {
      return sum + (t.credit_amount || 0);
    } else {
      return sum + (t.debit_amount || 0);
    }
  }, 0) || 0;

  return total;
}

/**
 * Generuje prognozę budżetu na podstawie metody
 */
export async function generateForecast(
  locationId: string,
  targetYear: number,
  method: 'last_year' | 'avg_3_years',
  additionalExpenses: number,
  plannedCostReduction: number
): Promise<{ income: AccountBalance[]; expenses: AccountBalance[] }> {
  const income: AccountBalance[] = [];
  const expenses: AccountBalance[] = [];

  if (method === 'last_year') {
    const previousYear = targetYear - 1;

    // Prognoza dla przychodów
    for (const account of INCOME_ACCOUNTS) {
      const balance = await getAccountBalanceForYear(
        locationId,
        previousYear,
        account.prefix,
        'income'
      );
      income.push({
        account_prefix: account.prefix,
        total: balance,
      });
    }

    // Prognoza dla rozchodów
    for (const account of EXPENSE_ACCOUNTS) {
      const balance = await getAccountBalanceForYear(
        locationId,
        previousYear,
        account.prefix,
        'expense'
      );
      expenses.push({
        account_prefix: account.prefix,
        total: balance,
      });
    }
  } else if (method === 'avg_3_years') {
    const years = [targetYear - 1, targetYear - 2, targetYear - 3];

    // Prognoza dla przychodów (średnia z 3 lat)
    for (const account of INCOME_ACCOUNTS) {
      const balances = await Promise.all(
        years.map(y => getAccountBalanceForYear(locationId, y, account.prefix, 'income'))
      );
      const avg = balances.reduce((sum, b) => sum + b, 0) / 3;
      income.push({
        account_prefix: account.prefix,
        total: avg,
      });
    }

    // Prognoza dla rozchodów (średnia z 3 lat)
    for (const account of EXPENSE_ACCOUNTS) {
      const balances = await Promise.all(
        years.map(y => getAccountBalanceForYear(locationId, y, account.prefix, 'expense'))
      );
      const avg = balances.reduce((sum, b) => sum + b, 0) / 3;
      expenses.push({
        account_prefix: account.prefix,
        total: avg,
      });
    }
  }

  // Zastosuj modyfikatory do sumy rozchodów
  const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);
  const modifier = additionalExpenses - plannedCostReduction;
  const modifierPerAccount = modifier / expenses.length;

  expenses.forEach(e => {
    e.total += modifierPerAccount;
    if (e.total < 0) e.total = 0;
  });

  return { income, expenses };
}

/**
 * Oblicza status realizacji budżetu
 */
export function getBudgetStatus(percentage: number): 'green' | 'orange' | 'red' | 'gray' {
  if (percentage < 50) return 'gray';
  if (percentage <= 80) return 'green';
  if (percentage <= 100) return 'orange';
  return 'red';
}

/**
 * Oblicza realizację budżetu dla danego miesiąca
 */
export async function getBudgetRealizationForMonth(
  locationId: string,
  year: number,
  month: number,
  monthlyBudget: number
): Promise<{ actual: number; percentage: number; status: 'green' | 'orange' | 'red' | 'gray' }> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

  const { data, error } = await supabase
    .from('transactions')
    .select('debit_amount')
    .eq('location_id', locationId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error) {
    console.error('Error fetching transactions:', error);
    return { actual: 0, percentage: 0, status: 'gray' };
  }

  const actual = data?.reduce((sum, t) => sum + (t.debit_amount || 0), 0) || 0;
  const percentage = monthlyBudget > 0 ? (actual / monthlyBudget) * 100 : 0;
  const status = getBudgetStatus(percentage);

  return { actual, percentage, status };
}

export const MONTH_NAMES = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

/**
 * Formatuje kwotę do wyświetlenia
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
