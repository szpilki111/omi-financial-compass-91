import { supabase } from "@/integrations/supabase/client";

export const INCOME_ACCOUNTS = [
  { prefix: '701', name: 'Intencje odprawione' },
  { prefix: '702', name: 'Duszpasterstwo OMI' },
  { prefix: '703', name: 'Duszpasterstwo parafialne' },
  { prefix: '704', name: 'Kolęda' },
  { prefix: '705', name: 'Zastępstwa zagraniczne' },
  { prefix: '706', name: 'Wypominki parafialne' },
  { prefix: '710', name: 'Odsetki i przychody finansowe' },
  { prefix: '711', name: 'Sprzedaż kalendarzy' },
  { prefix: '712', name: 'Dzierżawa' },
  { prefix: '713', name: 'Sprzedaż z działalności gospodarczej' },
  { prefix: '714', name: 'Pensje, emerytury i renty' },
  { prefix: '715', name: 'Zwroty' },
  { prefix: '716', name: 'Usługi, noclegi, rekolektanci' },
  { prefix: '717', name: 'Inne' },
  { prefix: '718', name: 'Usługi działalności gospodarczej' },
  { prefix: '719', name: 'Dzierżawa przechodnia' },
  { prefix: '720', name: 'Ofiary' },
  { prefix: '724', name: 'Msze Wieczyste' },
  { prefix: '725', name: 'Nadzwyczajne przychody' },
  { prefix: '727', name: 'Cmentarz' },
  { prefix: '728', name: 'Różnice kursowe' },
  { prefix: '730', name: 'Sprzedaż majątku trwałego' },
];

export const EXPENSE_ACCOUNTS = [
  { prefix: '401', name: 'Biurowe' },
  { prefix: '402', name: 'Poczta' },
  { prefix: '403', name: 'Telefony, Internet TV' },
  { prefix: '404', name: 'Reprezentacyjne' },
  { prefix: '405', name: 'Prowizje i opłaty bankowe' },
  { prefix: '406', name: 'Usługi serwisowe' },
  { prefix: '407', name: 'Wywóz śmieci i nieczystości' },
  { prefix: '408', name: 'Ubezpieczenie majątku trwałego' },
  { prefix: '410', name: 'Pralnia, artykuły chemiczne i konserwacja' },
  { prefix: '411', name: 'Podróże komunikacją publiczną' },
  { prefix: '412', name: 'Utrzymanie samochodu oraz zakup nowego' },
  { prefix: '413', name: 'Noclegi' },
  { prefix: '414', name: 'Honoraria duszpasterskie' },
  { prefix: '420', name: 'Pensje osób zatrudnionych' },
  { prefix: '421', name: 'Osobiste, higiena osobista' },
  { prefix: '422', name: 'Formacja pierwsza' },
  { prefix: '423', name: 'Formacja ustawiczna' },
  { prefix: '424', name: 'Leczenie, opieka zdrowotna' },
  { prefix: '430', name: 'Kult' },
  { prefix: '431', name: 'Książki, gazety, czasopisma, prenumeraty' },
  { prefix: '435', name: 'Wakacyjne' },
  { prefix: '439', name: 'Koszty kolędy' },
  { prefix: '440', name: 'Kuchnia i koszty posiłków' },
  { prefix: '441', name: 'Funkcjonowanie salonu' },
  { prefix: '442', name: 'Odzież' },
  { prefix: '444', name: 'Media, energia, woda, gaz, itd.' },
  { prefix: '445', name: 'Podatki i opłaty urzędowe' },
  { prefix: '446', name: 'Ogród, park i cmentarz' },
  { prefix: '447', name: 'Usługi działalności gospodarczej' },
  { prefix: '448', name: 'Towary do sprzedaży' },
  { prefix: '449', name: 'Zakup towarów działalności gospodarczej' },
  { prefix: '450', name: 'Inne' },
  { prefix: '451', name: 'Zakupy / remonty zwyczajne' },
  { prefix: '452', name: 'Zakupy / remonty nadzwyczajne' },
  { prefix: '453', name: 'Spotkania delegacje' },
  { prefix: '454', name: 'Scholastykat międzynarodowy' },
  { prefix: '455', name: 'Studia, studenci, szkolenia' },
  { prefix: '456', name: 'Powołania' },
  { prefix: '457', name: 'Apostolat i posługi' },
  { prefix: '458', name: 'Biedni' },
  { prefix: '459', name: 'Misje, pomoc misjonarzom' },
  { prefix: '461', name: 'Kuria diecezjalna' },
  { prefix: '462', name: 'Świadczenia na dom' },
  { prefix: '201-460', name: 'Świadczenia na prowincję' },
];

/**
 * Buduje pełny prefiks konta dla danej lokalizacji
 */
export function buildAccountPrefix(basePrefix: string, locationIdentifier: string): string {
  return `${basePrefix}-${locationIdentifier}`;
}

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
  accountType: 'income' | 'expense',
  locationIdentifier: string
): Promise<number> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  // Buduj pełny prefiks z identyfikatorem lokalizacji
  const fullPrefix = buildAccountPrefix(accountPrefix, locationIdentifier);

  let query = supabase
    .from('transactions')
    .select('debit_amount, credit_amount')
    .eq('location_id', locationId)
    .gte('date', startDate)
    .lte('date', endDate);

  // Dla przychodów sprawdzamy konta Ma (credit)
  // Dla rozchodów sprawdzamy konta Winien (debit)
  if (accountType === 'income') {
    query = query.like('credit_account_id', `%${fullPrefix.split('-')[0]}%`);
  } else {
    query = query.like('debit_account_id', `%${fullPrefix.split('-')[0]}%`);
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
  plannedCostReduction: number,
  locationIdentifier: string
): Promise<{ income: AccountBalance[]; expenses: AccountBalance[] }> {
  const income: AccountBalance[] = [];
  const expenses: AccountBalance[] = [];

  if (method === 'last_year') {
    const previousYear = targetYear - 1;

    // Prognoza dla przychodów
    for (const account of INCOME_ACCOUNTS) {
      const fullPrefix = buildAccountPrefix(account.prefix, locationIdentifier);
      const balance = await getAccountBalanceForYear(
        locationId,
        previousYear,
        account.prefix,
        'income',
        locationIdentifier
      );
      income.push({
        account_prefix: fullPrefix,
        total: balance,
      });
    }

    // Prognoza dla rozchodów
    for (const account of EXPENSE_ACCOUNTS) {
      const fullPrefix = buildAccountPrefix(account.prefix, locationIdentifier);
      const balance = await getAccountBalanceForYear(
        locationId,
        previousYear,
        account.prefix,
        'expense',
        locationIdentifier
      );
      expenses.push({
        account_prefix: fullPrefix,
        total: balance,
      });
    }
  } else if (method === 'avg_3_years') {
    const years = [targetYear - 1, targetYear - 2, targetYear - 3];

    // Prognoza dla przychodów (średnia z 3 lat)
    for (const account of INCOME_ACCOUNTS) {
      const fullPrefix = buildAccountPrefix(account.prefix, locationIdentifier);
      const balances = await Promise.all(
        years.map(y => getAccountBalanceForYear(locationId, y, account.prefix, 'income', locationIdentifier))
      );
      const avg = balances.reduce((sum, b) => sum + b, 0) / 3;
      income.push({
        account_prefix: fullPrefix,
        total: avg,
      });
    }

    // Prognoza dla rozchodów (średnia z 3 lat)
    for (const account of EXPENSE_ACCOUNTS) {
      const fullPrefix = buildAccountPrefix(account.prefix, locationIdentifier);
      const balances = await Promise.all(
        years.map(y => getAccountBalanceForYear(locationId, y, account.prefix, 'expense', locationIdentifier))
      );
      const avg = balances.reduce((sum, b) => sum + b, 0) / 3;
      expenses.push({
        account_prefix: fullPrefix,
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
