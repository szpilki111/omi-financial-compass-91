/**
 * Formatuje kwotę z separatorem tysięcy (spacja) od 4 cyfr
 * Polski format: 1 000,00 zł
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(value);
};

/**
 * Formatuje liczbę z separatorem tysięcy (spacja) bez symbolu waluty
 * Polski format: 1 000,00
 */
export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(value);
};

/**
 * Formatuje liczbę z separatorem tysięcy bez miejsc dziesiętnych
 * Polski format: 1 000
 */
export const formatInteger = (value: number): string => {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true
  }).format(value);
};
