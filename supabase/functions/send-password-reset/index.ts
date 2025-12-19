import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PasswordResetRequest {
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error('Email jest wymagany');
    }

    console.log('Sending password reset for:', email);

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      console.error('Error finding user:', profileError);
      throw new Error('Błąd podczas wyszukiwania użytkownika');
    }

    if (!profile) {
      // Nie zdradzaj czy użytkownik istnieje
      console.log('User not found, but returning success for security');
      return new Response(
        JSON.stringify({ success: true, message: 'Jeśli konto istnieje, email został wysłany' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Generate secure token (64 hex chars)
    const tokenArray = new Uint8Array(32);
    crypto.getRandomValues(tokenArray);
    const token = Array.from(tokenArray).map(b => b.toString(16).padStart(2, '0')).join('');

    // Set expiration to 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    // Invalidate any existing tokens for this user
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('user_id', profile.id);

    // Insert new token
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: profile.id,
        token,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error('Error inserting token:', insertError);
      throw new Error('Błąd podczas tworzenia tokena');
    }

    // Build reset URL - używamy /?token= bo hosting nie ma SPA rewrites
    const appUrl = 'https://finanse.oblaci.pl';
    const resetUrl = `${appUrl}/?token=${token}`;

    // Build beautiful email using shared template style
    const emailHtml = buildPasswordResetEmail(profile.name, resetUrl);
    const emailText = buildPasswordResetText(profile.name, resetUrl);

    // Send email via send-email function
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        subject: 'Reset hasla - System Finansowy OMI',
        html: emailHtml,
        text: emailText,
      },
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      throw new Error('Błąd podczas wysyłania emaila');
    }

    console.log('Password reset email sent successfully to:', email);

    return new Response(
      JSON.stringify({ success: true, message: 'Email z linkiem do resetu hasła został wysłany' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in send-password-reset:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

function buildPasswordResetEmail(userName: string, resetUrl: string): string {
  const goldGradient = 'linear-gradient(135deg, #E6B325, #D4A017)';
  const goldPrimary = '#E6B325';
  const goldLight = '#fef9e7';
  const orangePrimary = '#f59e0b';
  const orangeLight = '#fef3c7';

  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>';
  html += '<body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f8fafc;">';
  html += '<table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;">';
  html += '<table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">';
  
  // Header with gold gradient
  html += `<tr><td style="padding:32px 40px;background:${goldGradient};border-radius:12px 12px 0 0;">`;
  html += '<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">Reset hasła</h1>';
  html += '<p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">System Finansowy OMI</p>';
  html += '</td></tr>';
  
  // Content
  html += '<tr><td style="padding:32px 40px;">';
  
  // Greeting
  html += `<p style="margin:0 0 16px 0;color:#334155;font-size:16px;">Witaj <strong>${userName}</strong>,</p>`;
  
  // Alert box
  html += `<div style="background-color:${orangeLight};border-left:4px solid ${orangePrimary};padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">`;
  html += `<p style="margin:0;color:${orangePrimary};font-weight:600;font-size:16px;">⏰ Link jest ważny przez 1 godzinę</p></div>`;
  
  // Main text
  html += '<div style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">';
  html += 'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Systemie Finansowym OMI.<br><br>';
  html += 'Kliknij przycisk poniżej, aby ustawić nowe hasło:';
  html += '</div>';
  
  // Button
  html += '<table role="presentation" style="width:100%;margin-top:24px;"><tr><td align="center">';
  html += `<a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:${goldGradient};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">🔐 Ustaw nowe hasło</a>`;
  html += '</td></tr></table>';
  
  // Security notice
  html += `<div style="background-color:#f8fafc;border-left:4px solid #94a3b8;padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">`;
  html += '<p style="margin:0;color:#64748b;font-size:14px;">Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość. Twoje konto jest bezpieczne.</p></div>';
  
  html += '</td></tr>';
  
  // Footer
  html += '<tr><td style="padding:24px 40px;background-color:#f8fafc;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">';
  html += '<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">Ta wiadomość została wygenerowana automatycznie przez System Finansowy OMI.</p>';
  html += '<p style="margin:8px 0 0 0;color:#94a3b8;font-size:12px;text-align:center;">System Finansowy OMI</p>';
  html += '</td></tr>';
  
  html += '</table></td></tr></table></body></html>';

  return html;
}

function buildPasswordResetText(userName: string, resetUrl: string): string {
  return `Reset hasła - System Finansowy OMI

Witaj ${userName},

Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta w Systemie Finansowym OMI.

UWAGA: Link jest ważny przez 1 godzinę.

Aby ustawić nowe hasło, otwórz poniższy link:
${resetUrl}

Jeśli to nie Ty prosiłeś o reset hasła, zignoruj tę wiadomość. Twoje konto jest bezpieczne.

---
Ta wiadomość została wygenerowana automatycznie przez System Finansowy OMI.`;
}
