import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9';
import { buildEmailTemplate } from '../_shared/emailTemplate.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, email, device_fingerprint, user_agent, ip_address }: VerificationRequest = await req.json();

    const normalizedEmail = (email ?? '').trim().toLowerCase();
    const normalizedFingerprint = (device_fingerprint ?? '').trim();

    if (!user_id || !normalizedEmail || !normalizedFingerprint) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Sending verification code for user:', user_id);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .maybeSingle();

    if (profileError || !profile?.email || profile.email.trim().toLowerCase() !== normalizedEmail) {
      console.warn('send-verification-code: email mismatch for user_id', { user_id });
      return new Response(
        JSON.stringify({ error: 'Invalid user/email pair' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentCode, error: recentError } = await supabase
      .from('verification_codes')
      .select('id')
      .eq('user_id', user_id)
      .eq('device_fingerprint', normalizedFingerprint)
      .is('used_at', null)
      .gt('created_at', oneMinuteAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!recentError && recentCode) {
      return new Response(
        JSON.stringify({ error: 'Too many requests' }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const code = generateVerificationCode();
    
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert({
        user_id,
        code,
        device_fingerprint: normalizedFingerprint,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting verification code:', insertError);
      throw insertError;
    }

    const { html, text } = buildEmailTemplate({
      title: '🔐 Weryfikacja dwuetapowa',
      subtitle: 'System Finansowy OMI',
      content: `
        <p>Wykryliśmy logowanie z nowego urządzenia do Twojego konta w Systemie Finansowym OMI.</p>
        <div style="background-color: #fef9e7; border: 2px solid #E6B325; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">Twój kod weryfikacyjny:</p>
          <p style="margin: 0; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #E6B325;">${code}</p>
        </div>
        <p>Wprowadź ten kod, aby zakończyć proces logowania.</p>
      `,
      alertBox: {
        text: 'Kod jest ważny przez 15 minut. Możesz zaznaczyć urządzenie jako zaufane na 30 dni.',
        color: 'gold',
      },
      footerText: 'Jeśli to nie Ty próbujesz się zalogować, natychmiast zmień hasło i skontaktuj się z administratorem!',
      color: 'gold',
    });

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
          html,
          text,
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
      JSON.stringify({ success: true, message: "Kod weryfikacyjny został wysłany na email" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-verification-code function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
