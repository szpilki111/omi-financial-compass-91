
import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CurrencyAmountInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  currency: string;
  exchangeRate: number;
  baseCurrency?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

const CurrencyAmountInput: React.FC<CurrencyAmountInputProps> = ({
  label,
  value,
  onChange,
  currency,
  exchangeRate,
  baseCurrency = 'PLN',
  placeholder = "0.00",
  disabled = false,
  required = false,
  className = "",
  onFocus,
  onBlur
}) => {
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value) || 0;
    onChange(newValue);
  };

  // Calculate converted amount
  const convertedAmount = currency !== baseCurrency ? value * exchangeRate : value;
  const showConversion = currency !== baseCurrency && value > 0 && exchangeRate > 0;

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-sm font-medium">
        {label} {required && '*'}
      </Label>
      
      <div className="space-y-1">
        <div className="relative">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={handleAmountChange}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-12"
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
            {currency}
          </div>
        </div>
        
        {showConversion && (
          <div className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
            = {convertedAmount.toFixed(2)} {baseCurrency}
            <span className="ml-1 text-gray-500">
              (kurs: {exchangeRate.toFixed(4)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrencyAmountInput;
