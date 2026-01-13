import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyResetRequest {
  token: string;
  newPassword: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token, newPassword }: VerifyResetRequest = await req.json();

    if (!token || !newPassword) {
      throw new Error('Token i nowe hasło są wymagane');
    }

    // Basic password validation
    if (newPassword.length < 8) {
      throw new Error('Hasło musi mieć minimum 8 znaków');
    }

    console.log('Verifying password reset token');

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Find token
    const { data: tokenData, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('Error finding token:', tokenError);
      throw new Error('Błąd podczas weryfikacji tokena');
    }

    if (!tokenData) {
      console.log('Token not found');
      throw new Error('Nieprawidłowy lub wygasły link do resetu hasła');
    }

    // Check if already used
    if (tokenData.used_at) {
      console.log('Token already used');
      throw new Error('Ten link do resetu hasła został już wykorzystany');
    }

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.log('Token expired');
      throw new Error('Link do resetu hasła wygasł. Poproś o nowy link.');
    }

    console.log('Token valid, updating password for user:', tokenData.user_id);

    // Update user password using Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      tokenData.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw new Error('Nie udało się zmienić hasła: ' + updateError.message);
    }

    // Mark token as used
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    if (markUsedError) {
      console.error('Error marking token as used:', markUsedError);
      // Don't throw - password was already changed
    }

    console.log('Password reset successful');

    return new Response(
      JSON.stringify({ success: true, message: 'Hasło zostało zmienione pomyślnie' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in verify-password-reset:', error);
    // Return 200 with error in body so client can read it
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
