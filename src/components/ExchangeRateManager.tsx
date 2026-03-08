import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertCircle, RefreshCw, History } from 'lucide-react';
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
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [rateHistory, setRateHistory] = useState<ExchangeRateHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { toast } = useToast();

  // Don't show exchange rate manager for base currency
  if (currency === baseCurrency) {
    return null;
  }

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

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newRate = parseFloat(e.target.value) || 0;
    onChange(newRate);
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
            disabled={disabled}
            className={!isValidRate ? 'border-destructive' : ''}
          />
        </div>

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

      {!isValidRate && (
        <p className="text-xs text-destructive">
          Kurs wymiany musi być większy od zera
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        1 {currency} = {value.toFixed(4)} {baseCurrency}
      </p>
    </div>
  );
};

export default ExchangeRateManager;
