import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, RefreshCw, History } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

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

interface ExchangeRateHistory {
  id: string;
  currency_code: string;
  rate: number;
  effective_date: string;
  fetched_at: string;
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [rateHistory, setRateHistory] = useState<ExchangeRateHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { toast } = useToast();

  // Don't show exchange rate manager for base currency
  if (currency === baseCurrency) {
    return null;
  }

  const saveRateToHistory = async (currencyCode: string, rate: number, effectiveDate: Date) => {
    try {
      const dateStr = effectiveDate.toISOString().split('T')[0];
      
      // Use upsert to avoid duplicates
      const { error } = await supabase
        .from('exchange_rate_history')
        .upsert(
          {
            currency_code: currencyCode,
            rate: rate,
            effective_date: dateStr,
            source: 'NBP',
            fetched_at: new Date().toISOString()
          },
          { onConflict: 'currency_code,effective_date' }
        );

      if (error) {
        console.error('Error saving rate to history:', error);
      } else {
        console.log(`Rate saved to history: ${currencyCode} = ${rate} PLN on ${dateStr}`);
      }
    } catch (err) {
      console.error('Error in saveRateToHistory:', err);
    }
  };

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
      const effectiveDate = data.rates[0]?.effectiveDate ? new Date(data.rates[0].effectiveDate) : new Date();

      if (!rate) {
        throw new Error(`Brak dostępnego kursu dla waluty ${currency}`);
      }

      onChange(rate);
      setLastFetched(new Date());
      
      // Save to history
      await saveRateToHistory(currency, rate, effectiveDate);
      
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

  const fetchRateHistory = async () => {
    if (!currency) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('exchange_rate_history')
        .select('*')
        .eq('currency_code', currency)
        .order('effective_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setRateHistory(data || []);
    } catch (err) {
      console.error('Error fetching rate history:', err);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać historii kursów",
        variant: "destructive",
      });
    } finally {
      setLoadingHistory(false);
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

  const handleOpenHistory = () => {
    setHistoryDialogOpen(true);
    fetchRateHistory();
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
          title="Pobierz aktualny kurs z NBP"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenHistory}
              disabled={disabled || !currency || currency === baseCurrency}
              className="px-3"
              title="Historia kursów"
            >
              <History className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Historia kursów {currency}/PLN</DialogTitle>
              <DialogDescription>
                Ostatnie 30 zapisanych kursów dla waluty {currency}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[300px]">
              {loadingHistory ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : rateHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Brak historii kursów dla tej waluty
                </p>
              ) : (
                <div className="space-y-2">
                  {rateHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center p-2 border rounded hover:bg-muted/50"
                    >
                      <div>
                        <p className="font-medium">{entry.rate.toFixed(4)} PLN</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.effective_date), 'd MMMM yyyy', { locale: pl })}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onChange(entry.rate);
                          setHistoryDialogOpen(false);
                          toast({
                            title: "Kurs zastosowany",
                            description: `Zastosowano kurs z dnia ${format(new Date(entry.effective_date), 'd.MM.yyyy')}`,
                          });
                        }}
                      >
                        Użyj
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
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
