export const formatCurrencyForDisplay = (value: number): string => {
  return value === 0 ? '' : value.toFixed(2);
};

export const calculateInputWidth = (displayValue: string, min = 80, max = 200): string => {
  const text = displayValue || '0.00';
  const charWidth = 9.5; // średnia szerokość znaku w px (dopasuj do czcionki)
  const padding = 50; // symbol waluty + padding
  const calculated = text.length * charWidth + padding;
  const width = Math.min(Math.max(min, calculated), max);
  return `${width}px`;
};