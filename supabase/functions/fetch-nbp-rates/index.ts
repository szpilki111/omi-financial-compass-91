import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Lista obsługiwanych walut
const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CZK', 'SEK', 'NOK', 'DKK', 'CAD', 'AUD'];

interface NBPRateResponse {
  table: string;
  currency: string;
  code: string;
  rates: Array<{
    no: string;
    effectiveDate: string;
    mid: number;
  }>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[fetch-nbp-rates] Starting to fetch exchange rates from NBP...');

    const results: { currency: string; rate: number; effectiveDate: string; success: boolean; error?: string }[] = [];

    for (const currency of SUPPORTED_CURRENCIES) {
      try {
        // Pobierz aktualny kurs z API NBP (tabela A - kursy średnie)
        const response = await fetch(
          `https://api.nbp.pl/api/exchangerates/rates/a/${currency.toLowerCase()}/?format=json`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.error(`[fetch-nbp-rates] Failed to fetch ${currency}: ${response.status}`);
          results.push({
            currency,
            rate: 0,
            effectiveDate: '',
            success: false,
            error: `HTTP ${response.status}`,
          });
          continue;
        }

        const data: NBPRateResponse = await response.json();
        const latestRate = data.rates[0];

        if (!latestRate) {
          console.error(`[fetch-nbp-rates] No rate data for ${currency}`);
          results.push({
            currency,
            rate: 0,
            effectiveDate: '',
            success: false,
            error: 'No rate data',
          });
          continue;
        }

        // Sprawdź czy kurs już istnieje w bazie dla tej daty
        const { data: existingRate } = await supabase
          .from('exchange_rate_history')
          .select('id')
          .eq('currency_code', currency)
          .eq('effective_date', latestRate.effectiveDate)
          .single();

        if (existingRate) {
          console.log(`[fetch-nbp-rates] Rate for ${currency} on ${latestRate.effectiveDate} already exists, skipping`);
          results.push({
            currency,
            rate: latestRate.mid,
            effectiveDate: latestRate.effectiveDate,
            success: true,
          });
          continue;
        }

        // Zapisz nowy kurs do bazy
        const { error: insertError } = await supabase.from('exchange_rate_history').insert({
          currency_code: currency,
          rate: latestRate.mid,
          effective_date: latestRate.effectiveDate,
          fetched_at: new Date().toISOString(),
          source: 'NBP',
        });

        if (insertError) {
          console.error(`[fetch-nbp-rates] Failed to insert ${currency}:`, insertError);
          results.push({
            currency,
            rate: latestRate.mid,
            effectiveDate: latestRate.effectiveDate,
            success: false,
            error: insertError.message,
          });
        } else {
          console.log(`[fetch-nbp-rates] Saved ${currency}: ${latestRate.mid} (${latestRate.effectiveDate})`);
          results.push({
            currency,
            rate: latestRate.mid,
            effectiveDate: latestRate.effectiveDate,
            success: true,
          });
        }
      } catch (currencyError) {
        console.error(`[fetch-nbp-rates] Error processing ${currency}:`, currencyError);
        results.push({
          currency,
          rate: 0,
          effectiveDate: '',
          success: false,
          error: currencyError instanceof Error ? currencyError.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[fetch-nbp-rates] Completed. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Fetched ${successCount} rates, ${failCount} failed`,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[fetch-nbp-rates] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
