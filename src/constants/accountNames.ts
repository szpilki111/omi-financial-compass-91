// Zahardcodowane nazwy kont przychodów i rozchodów dla raportów
// Te nazwy są stałe i nie zmieniają się w czasie

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
] as const;

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
  { prefix: '443', name: 'Pralnia, prasowalnia, zakupy, sprzęt' },
  { prefix: '444', name: 'Media, energia elektryczna, woda, gaz, ogrzewanie, węgiel' },
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
  { prefix: '463', name: 'Świadczenia dla Adm. Generalnej' },
] as const;

// Helper do pobierania nazwy konta po prefiksie
export const getIncomeAccountName = (prefix: string): string => {
  const account = INCOME_ACCOUNTS.find(acc => acc.prefix === prefix);
  return account?.name || prefix;
};

export const getExpenseAccountName = (prefix: string): string => {
  const account = EXPENSE_ACCOUNTS.find(acc => acc.prefix === prefix);
  return account?.name || prefix;
};

// Eksport prefiksów jako tablice
export const INCOME_PREFIXES = INCOME_ACCOUNTS.map(acc => acc.prefix);
export const EXPENSE_PREFIXES = EXPENSE_ACCOUNTS.map(acc => acc.prefix);
