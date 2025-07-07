
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

interface ExchangeRateManagerProps {
  currency: string;
  value: number;
  onChange: (rate: number) => void;
  baseCurrency?: string;
  disabled?: boolean;
  className?: string;
}

interface NBPRate {
  currency: string;
  code: string;
  mid: number;
}

const ExchangeRateManager: React.FC<ExchangeRateManagerProps> = ({
  currency,
  value,
  onChange,
  baseCurrency = 'PLN',
  disabled = false,
  className = ""
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const { toast } = useToast();

  // Don't show exchange rate manager for base currency
  if (currency === baseCurrency) {
    return null;
  }

  const fetchExchangeRate = async () => {
    if (currency === baseCurrency || !currency) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch from NBP API
      const response = await fetch(`https://api.nbp.pl/api/exchangerates/rates/A/${currency}/last/?format=json`);
      
      if (!response.ok) {
        throw new Error(`Nie udało się pobrać kursu dla waluty ${currency}`);
      }

      const data = await response.json();
      const rate = data.rates[0]?.mid;

      if (!rate) {
        throw new Error(`Brak dostępnego kursu dla waluty ${currency}`);
      }

      onChange(rate);
      setLastFetched(new Date());
      toast({
        title: "Sukces",
        description: `Pobrano aktualny kurs ${currency}: ${rate.toFixed(4)} PLN`,
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nieznany błąd';
      setError(errorMessage);
      toast({
        title: "Błąd",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch rate when currency changes
  useEffect(() => {
    if (currency && currency !== baseCurrency && value === 1) {
      fetchExchangeRate();
    }
  }, [currency]);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value) || 0;
    onChange(newRate);
    setError(null);
  };

  const isValidRate = value > 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm font-medium">
        Kurs wymiany ({currency} → {baseCurrency}) *
      </Label>
      
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="number"
            step="0.0001"
            min="0.0001"
            value={value}
            onChange={handleRateChange}
            placeholder="0.0000"
            disabled={disabled || loading}
            className={!isValidRate ? 'border-red-500' : ''}
          />
        </div>
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchExchangeRate}
          disabled={loading || disabled || !currency || currency === baseCurrency}
          className="px-3"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {lastFetched && !error && (
        <p className="text-xs text-gray-500">
          Ostatnia aktualizacja: {lastFetched.toLocaleString('pl-PL')}
        </p>
      )}

      {!isValidRate && (
        <p className="text-xs text-red-500">
          Kurs wymiany musi być większy od zera
        </p>
      )}

      <p className="text-xs text-gray-600">
        1 {currency} = {value.toFixed(4)} {baseCurrency}
      </p>
    </div>
  );
};

export default ExchangeRateManager;
