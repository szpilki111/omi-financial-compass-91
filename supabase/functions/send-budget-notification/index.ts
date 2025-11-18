import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
      type,
      budgetId,
      recipientEmail,
      budgetYear,
      locationName,
      rejectionReason,
      exceededPercentage,
      month,
    }: BudgetNotificationRequest = await req.json();

    console.log('Sending budget notification:', { type, budgetId, recipientEmail });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    let subject = '';
    let htmlContent = '';
    let textContent = '';

    const budgetLink = `${supabaseUrl.replace('https://vzalrnwnpzbpzvcrjitt.supabase.co', window.location?.origin || 'https://oblaci-finance.lovable.app')}/budzet`;

    switch (type) {
      case 'budget_submitted':
        subject = `Nowy budżet do zatwierdzenia - ${locationName} ${budgetYear}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
              .info-box { background-color: white; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Nowy budżet do zatwierdzenia</h1>
              </div>
              <div class="content">
                <p>Został złożony nowy budżet wymagający zatwierdzenia:</p>
                <div class="info-box">
                  <p><strong>Lokalizacja:</strong> ${locationName}</p>
                  <p><strong>Rok:</strong> ${budgetYear}</p>
                </div>
                <p>Zaloguj się do systemu, aby przejrzeć i zatwierdzić budżet.</p>
                <a href="${budgetLink}" class="button">Przejdź do budżetu</a>
              </div>
            </div>
          </body>
          </html>
        `;
        textContent = `
Nowy budżet do zatwierdzenia

Został złożony nowy budżet wymagający zatwierdzenia:

Lokalizacja: ${locationName}
Rok: ${budgetYear}

Zaloguj się do systemu, aby przejrzeć i zatwierdzić budżet: ${budgetLink}
        `;
        break;

      case 'budget_approved':
        subject = `Budżet zatwierdzony - ${locationName} ${budgetYear}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
              .info-box { background-color: white; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; }
              .button { display: inline-block; padding: 10px 20px; background-color: #10B981; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✓ Budżet zatwierdzony</h1>
              </div>
              <div class="content">
                <p>Twój budżet został zatwierdzony:</p>
                <div class="info-box">
                  <p><strong>Lokalizacja:</strong> ${locationName}</p>
                  <p><strong>Rok:</strong> ${budgetYear}</p>
                  <p><strong>Status:</strong> Zatwierdzony</p>
                </div>
                <p>Możesz teraz śledzić realizację budżetu w systemie.</p>
                <a href="${budgetLink}" class="button">Zobacz budżet</a>
              </div>
            </div>
          </body>
          </html>
        `;
        textContent = `
Budżet zatwierdzony

Twój budżet został zatwierdzony:

Lokalizacja: ${locationName}
Rok: ${budgetYear}
Status: Zatwierdzony

Możesz teraz śledzić realizację budżetu w systemie: ${budgetLink}
        `;
        break;

      case 'budget_rejected':
        subject = `Budżet odrzucony - ${locationName} ${budgetYear}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
              .info-box { background-color: white; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; }
              .reason-box { background-color: #FEE2E2; border: 1px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; padding: 10px 20px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✗ Budżet odrzucony</h1>
              </div>
              <div class="content">
                <p>Twój budżet został odrzucony:</p>
                <div class="info-box">
                  <p><strong>Lokalizacja:</strong> ${locationName}</p>
                  <p><strong>Rok:</strong> ${budgetYear}</p>
                  <p><strong>Status:</strong> Odrzucony</p>
                </div>
                ${rejectionReason ? `
                <div class="reason-box">
                  <p><strong>Powód odrzucenia:</strong></p>
                  <p>${rejectionReason}</p>
                </div>
                ` : ''}
                <p>Możesz wprowadzić poprawki i ponownie złożyć budżet do zatwierdzenia.</p>
                <a href="${budgetLink}" class="button">Edytuj budżet</a>
              </div>
            </div>
          </body>
          </html>
        `;
        textContent = `
Budżet odrzucony

Twój budżet został odrzucony:

Lokalizacja: ${locationName}
Rok: ${budgetYear}
Status: Odrzucony

${rejectionReason ? `Powód odrzucenia: ${rejectionReason}\n` : ''}
Możesz wprowadzić poprawki i ponownie złożyć budżet do zatwierdzenia: ${budgetLink}
        `;
        break;

      case 'budget_exceeded':
        subject = `⚠️ Budżet przekroczony - ${locationName} ${month} ${budgetYear}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
              .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
              .warning-box { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; }
              .percentage { font-size: 32px; font-weight: bold; color: #F59E0B; }
              .button { display: inline-block; padding: 10px 20px; background-color: #F59E0B; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Budżet przekroczony</h1>
              </div>
              <div class="content">
                <p>Budżet dla lokalizacji został przekroczony:</p>
                <div class="warning-box">
                  <p><strong>Lokalizacja:</strong> ${locationName}</p>
                  <p><strong>Okres:</strong> ${month} ${budgetYear}</p>
                  <p><strong>Realizacja:</strong> <span class="percentage">${exceededPercentage}%</span></p>
                </div>
                <p>Zalecamy przegląd wydatków i ewentualne dostosowanie planów finansowych.</p>
                <a href="${budgetLink}" class="button">Zobacz szczegóły</a>
              </div>
            </div>
          </body>
          </html>
        `;
        textContent = `
⚠️ Budżet przekroczony

Budżet dla lokalizacji został przekroczony:

Lokalizacja: ${locationName}
Okres: ${month} ${budgetYear}
Realizacja: ${exceededPercentage}%

Zalecamy przegląd wydatków i ewentualne dostosowanie planów finansowych: ${budgetLink}
        `;
        break;
    }

    // Send email via send-email function
    const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        to: recipientEmail,
        subject,
        html: htmlContent,
        text: textContent,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error('Failed to send budget notification email:', error);
      throw new Error('Failed to send email');
    }

    console.log('Budget notification sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Budget notification sent' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in send-budget-notification function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
