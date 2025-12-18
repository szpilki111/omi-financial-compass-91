import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { buildEmailTemplate, APP_URL, toAscii } from '../_shared/emailTemplate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BudgetNotificationRequest {
  type: 'budget_submitted' | 'budget_approved' | 'budget_rejected' | 'budget_exceeded';
  budgetId: string;
  recipientEmail: string;
  budgetYear: number;
  locationName: string;
  rejectionReason?: string;
  exceededPercentage?: number;
  month?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      type, budgetId, recipientEmail, budgetYear, locationName, rejectionReason, exceededPercentage, month,
    }: BudgetNotificationRequest = await req.json();

    console.log('Sending budget notification:', { type, budgetId, recipientEmail });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const budgetLink = `${APP_URL}/budzet`;

    let subject = '';
    let html = '';
    let text = '';

    // Use toAscii for locationName in subjects to avoid encoding issues
    const asciiLocationName = toAscii(locationName);

    switch (type) {
      case 'budget_submitted': {
        subject = `Nowy budzet do zatwierdzenia - ${asciiLocationName} ${budgetYear}`;
        const template = buildEmailTemplate({
          title: '📊 Nowy budżet do zatwierdzenia',
          subtitle: 'System Finansowy OMI',
          content: '<p>Został złożony nowy budżet wymagający zatwierdzenia.</p><p>Zaloguj się do systemu, aby przejrzeć i zatwierdzić budżet.</p>',
          infoItems: [
            { label: 'Lokalizacja', value: locationName },
            { label: 'Rok', value: String(budgetYear) },
          ],
          color: 'blue',
        });
        html = template.html;
        text = template.text;
        break;
      }

      case 'budget_approved': {
        subject = `Budzet zatwierdzony - ${asciiLocationName} ${budgetYear}`;
        const template = buildEmailTemplate({
          title: '✓ Budżet zatwierdzony',
          subtitle: 'System Finansowy OMI',
          content: '<p>Twój budżet został zatwierdzony.</p><p>Możesz teraz śledzić realizację budżetu w systemie.</p>',
          infoItems: [
            { label: 'Lokalizacja', value: locationName },
            { label: 'Rok', value: String(budgetYear) },
            { label: 'Status', value: 'Zatwierdzony' },
          ],
          color: 'green',
        });
        html = template.html;
        text = template.text;
        break;
      }

      case 'budget_rejected': {
        subject = `Budzet odrzucony - ${asciiLocationName} ${budgetYear}`;
        const template = buildEmailTemplate({
          title: '✗ Budżet odrzucony',
          subtitle: 'System Finansowy OMI',
          content: `<p>Twój budżet został odrzucony.</p>${rejectionReason ? `<p><strong>Powód odrzucenia:</strong> ${rejectionReason}</p>` : ''}<p>Możesz wprowadzić poprawki i ponownie złożyć budżet do zatwierdzenia.</p>`,
          infoItems: [
            { label: 'Lokalizacja', value: locationName },
            { label: 'Rok', value: String(budgetYear) },
            { label: 'Status', value: 'Odrzucony' },
          ],
          alertBox: rejectionReason ? { text: rejectionReason, color: 'red' } : undefined,
          color: 'red',
        });
        html = template.html;
        text = template.text;
        break;
      }

      case 'budget_exceeded': {
        subject = `Budzet przekroczony - ${asciiLocationName} ${month} ${budgetYear}`;
        const template = buildEmailTemplate({
          title: '⚠️ Budżet przekroczony',
          subtitle: 'System Finansowy OMI',
          content: '<p>Budżet dla lokalizacji został przekroczony.</p><p>Zalecamy przegląd wydatków i ewentualne dostosowanie planów finansowych.</p>',
          infoItems: [
            { label: 'Lokalizacja', value: locationName },
            { label: 'Okres', value: `${month} ${budgetYear}` },
            { label: 'Realizacja', value: `${exceededPercentage}%` },
          ],
          alertBox: { text: `Przekroczono budżet: ${exceededPercentage}%`, color: 'orange' },
          color: 'orange',
        });
        html = template.html;
        text = template.text;
        break;
      }
    }

    // Send email via send-email function
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ to: recipientEmail, subject, html, text }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error('Failed to send budget notification email:', error);
      throw new Error('Failed to send email');
    }

    console.log('Budget notification sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Budget notification sent' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in send-budget-notification function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);
