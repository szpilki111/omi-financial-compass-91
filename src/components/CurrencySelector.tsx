
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  locationId?: string; // Add locationId prop to check specific location settings
}

const ALL_CURRENCIES = [{
  code: 'PLN',
  name: 'Polski złoty'
}, {
  code: 'EUR',
  name: 'Euro'
}, {
  code: 'USD',
  name: 'Dolar amerykański'
}, {
  code: 'GBP',
  name: 'Funt brytyjski'
}, {
  code: 'CHF',
  name: 'Frank szwajcarski'
}, {
  code: 'CZK',
  name: 'Korona czeska'
}, {
  code: 'NOK',
  name: 'Korona norweska'
}, {
  code: 'SEK',
  name: 'Korona szwedzka'
}];

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value,
  onChange,
  label = "Waluta",
  required = false,
  disabled = false,
  className = "",
  locationId
}) => {
  const { user } = useAuth();

  // Fetch location settings to check if foreign currencies are allowed
  const { data: locationSettings } = useQuery({
    queryKey: ['location-settings', locationId || user?.location],
    queryFn: async () => {
      const targetLocationId = locationId || user?.location;
      if (!targetLocationId) return null;

      const { data, error } = await supabase
        .from('location_settings')
        .select('allow_foreign_currencies')
        .eq('location_id', targetLocationId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching location settings:', error);
        return null;
      }

      return data;
    },
    enabled: !!(locationId || user?.location)
  });

  // Determine which currencies to show
  const availableCurrencies = React.useMemo(() => {
    // Always show PLN
    const currencies = [ALL_CURRENCIES[0]]; // PLN is first in the array

    // Add foreign currencies if allowed by location settings
    if (locationSettings?.allow_foreign_currencies) {
      currencies.push(...ALL_CURRENCIES.slice(1));
    }

    return currencies;
  }, [locationSettings]);

  // If foreign currencies are not allowed and only PLN is available, don't show the selector at all
  if (!locationSettings?.allow_foreign_currencies && availableCurrencies.length === 1) {
    return (
      <div className={className}>
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </Label>
        <div className="mt-[10px] px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm">
          PLN - Polski złoty
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Tylko PLN jest dozwolone dla tej lokalizacji. Skontaktuj się z prowincjałem, aby zmienić ustawienia.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </Label>
      
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="currency-select" className="mt-[10px]">
          <SelectValue placeholder="Wybierz walutę" />
        </SelectTrigger>
        <SelectContent>
          {availableCurrencies.map(currency => (
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
