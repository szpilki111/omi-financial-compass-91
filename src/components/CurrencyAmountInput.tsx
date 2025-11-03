
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
  const [displayValue, setDisplayValue] = React.useState<string>('');
  const [isFocused, setIsFocused] = React.useState(false);

  // Update display value when value prop changes
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value === 0 ? '' : value.toFixed(2));
    }
  }, [value, isFocused]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Replace comma with period for decimal separator
    inputValue = inputValue.replace(',', '.');
    
    // Validate: max 10 digits before decimal, 2 after
    const regex = /^\d{0,10}(\.\d{0,2})?$/;
    if (inputValue && !regex.test(inputValue)) {
      return; // Don't update if invalid format
    }
    
    setDisplayValue(inputValue);
    const newValue = parseFloat(inputValue) || 0;
    onChange(newValue);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // Always format to 2 decimal places on blur
    const roundedValue = parseFloat(value.toFixed(2));
    if (roundedValue > 0) {
      setDisplayValue(roundedValue.toFixed(2));
      onChange(roundedValue); // Update with rounded value
    } else {
      setDisplayValue('');
    }
    onBlur?.(e);
  };

  // Calculate converted amount
  const convertedAmount = currency !== baseCurrency ? value * exchangeRate : value;
  const showConversion = currency !== baseCurrency && value > 0 && exchangeRate > 0;

  // Calculate exact width based on content - no extra space
  const calculateWidth = () => {
    const charWidth = 8.5; // precise width per character in default font
    const currencySymbolWidth = currency.length * 8; // width of currency symbol
    const padding = 24; // minimal padding (left + right)
    const contentLength = Math.max(displayValue.length || 0, 4); // minimum 4 chars for "0.00"
    const calculatedWidth = contentLength * charWidth + currencySymbolWidth + padding;
    return `${Math.ceil(calculatedWidth)}px`;
  };

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-sm font-medium">
        {label} {required && '*'}
      </Label>
      
      <div className="space-y-1">
        <div className="relative inline-block">
          <Input
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleAmountChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
              // Allow Tab, numbers, decimal point, and control keys
              if (e.key !== 'Tab' && !/[\d.,\b\r]/.test(e.key) && !e.ctrlKey && !e.metaKey && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Delete') {
                e.preventDefault();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-10 text-right tabular-nums"
            style={{ width: calculateWidth() }}
          />
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
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
