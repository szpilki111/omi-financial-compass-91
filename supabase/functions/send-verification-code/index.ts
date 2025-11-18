import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerificationRequest {
  user_id: string;
  email: string;
  device_fingerprint: string;
  user_agent?: string;
  ip_address?: string;
}

const generateVerificationCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, email, device_fingerprint, user_agent, ip_address }: VerificationRequest = await req.json();

    console.log('Sending verification code for user:', user_id);

    // Wygeneruj 6-cyfrowy kod
    const code = generateVerificationCode();
    
    // Zapisz kod w bazie danych (ważny 15 minut)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert({
        user_id,
        code,
        device_fingerprint,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting verification code:', insertError);
      throw insertError;
    }

    // Wyślij email z kodem przez własny SMTP
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #E6B325 0%, #D4A017 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px solid #E6B325; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #E6B325; }
            .info { background: #fff3cd; border-left: 4px solid #E6B325; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Weryfikacja dwuetapowa</h1>
            </div>
            <div class="content">
              <p>Witaj,</p>
              <p>Wykryliśmy logowanie z nowego urządzenia do Twojego konta w Systemie Finansowym OMI.</p>
              
              <div class="code-box">
                <p style="margin: 0; font-size: 14px; color: #666;">Twój kod weryfikacyjny:</p>
                <div class="code">${code}</div>
              </div>

              <p>Wprowadź ten kod, aby zakończyć proces logowania.</p>

              <div class="info">
                <strong>⏱️ Ważne informacje:</strong>
                <ul style="margin: 10px 0;">
                  <li>Kod jest ważny przez <strong>15 minut</strong></li>
                  <li>Użyj go tylko raz</li>
                  <li>Możesz zaznaczyć to urządzenie jako zaufane, aby nie otrzymywać kodów w przyszłości</li>
                </ul>
              </div>

              ${user_agent ? `<p style="font-size: 12px; color: #666;"><strong>Urządzenie:</strong> ${user_agent}</p>` : ''}
              ${ip_address ? `<p style="font-size: 12px; color: #666;"><strong>Adres IP:</strong> ${ip_address}</p>` : ''}

              <p style="margin-top: 20px; color: #d9534f;">
                <strong>⚠️ Jeśli to nie Ty próbujesz się zalogować, natychmiast zmień hasło i skontaktuj się z administratorem!</strong>
              </p>
            </div>
            <div class="footer">
              <p>System Finansowy OMI<br>Misjonarze Oblaci Maryi Niepokalanej</p>
              <p>marekglowacki.pl</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
🔐 Weryfikacja dwuetapowa - System Finansowy OMI

Witaj,

Wykryliśmy logowanie z nowego urządzenia do Twojego konta w Systemie Finansowym OMI.

Twój kod weryfikacyjny: ${code}

Wprowadź ten kod, aby zakończyć proces logowania.

⏱️ Ważne informacje:
- Kod jest ważny przez 15 minut
- Użyj go tylko raz
- Możesz zaznaczyć to urządzenie jako zaufane, aby nie otrzymywać kodów w przyszłości

${user_agent ? `Urządzenie: ${user_agent}` : ''}
${ip_address ? `Adres IP: ${ip_address}` : ''}

⚠️ Jeśli to nie Ty próbujesz się zalogować, natychmiast zmień hasło i skontaktuj się z administratorem!

---
System Finansowy OMI
Misjonarze Oblaci Maryi Niepokalanej
marekglowacki.pl
    `;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          to: email,
          subject: 'Kod weryfikacyjny logowania - System Finansowy OMI',
          html: htmlContent,
          text: textContent,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Error sending verification email:', error);
        throw new Error('Failed to send verification email');
      }

      console.log('Verification code sent successfully');
    } catch (error) {
      console.error('Error in email sending:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Kod weryfikacyjny został wysłany na email"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-verification-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
