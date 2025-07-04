
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

const SUPPORTED_CURRENCIES = [
  { code: 'PLN', name: 'Polski złoty' },
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'Dolar amerykański' },
  { code: 'GBP', name: 'Funt brytyjski' },
  { code: 'CHF', name: 'Frank szwajcarski' },
  { code: 'CZK', name: 'Korona czeska' },
  { code: 'NOK', name: 'Korona norweska' },
  { code: 'SEK', name: 'Korona szwedzka' },
];

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value,
  onChange,
  label = "Waluta",
  required = false,
  disabled = false,
  className = ""
}) => {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-sm font-medium">
        {label} {required && '*'}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Wybierz walutę" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{currency.code}</span>
                <span className="text-sm text-gray-600">- {currency.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default CurrencySelector;
