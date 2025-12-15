import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  user_id: string;
  device_fingerprint: string;
  code: string;
}

type ErrorReason = 'invalid_code' | 'expired' | 'already_used' | 'not_found';

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, device_fingerprint, code }: VerifyRequest = await req.json();

    const codeNormalized = String(code ?? "").replace(/\D/g, "").slice(0, 6);
    const fingerprint = String(device_fingerprint ?? "").trim();

    console.log(`[verify-code] Attempt for user ${user_id}, fingerprint: ${fingerprint.slice(0,8)}...`);

    if (!user_id || !fingerprint || codeNormalized.length !== 6) {
      console.log(`[verify-code] Invalid payload: user_id=${!!user_id}, fingerprint=${!!fingerprint}, code_len=${codeNormalized.length}`);
      return new Response(JSON.stringify({ valid: false, reason: 'invalid_code' }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const nowIso = new Date().toISOString();

    // Najpierw sprawdź czy kod w ogóle istnieje (bez filtrowania po wygaśnięciu/użyciu)
    const { data: anyCode, error: anyError } = await supabase
      .from("verification_codes")
      .select("id, code, expires_at, used_at, device_fingerprint")
      .eq("user_id", user_id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (anyError) {
      console.error("[verify-code] Error fetching codes:", anyError);
      throw anyError;
    }

    console.log(`[verify-code] Found ${anyCode?.length || 0} codes for user`);

    // Znajdź pasujący kod
    const matchingCode = anyCode?.find(c => c.code === codeNormalized && c.device_fingerprint === fingerprint);

    if (!matchingCode) {
      // Sprawdź czy kod istnieje ale z innym fingerprintem
      const codeWithDiffFingerprint = anyCode?.find(c => c.code === codeNormalized);
      if (codeWithDiffFingerprint) {
        console.log(`[verify-code] Code exists but fingerprint mismatch`);
      } else {
        console.log(`[verify-code] Code not found at all`);
      }
      return new Response(JSON.stringify({ valid: false, reason: 'not_found' as ErrorReason }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Sprawdź czy kod już był użyty
    if (matchingCode.used_at) {
      console.log(`[verify-code] Code already used at ${matchingCode.used_at}`);
      return new Response(JSON.stringify({ valid: false, reason: 'already_used' as ErrorReason }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Sprawdź czy kod wygasł
    if (new Date(matchingCode.expires_at) < new Date()) {
      console.log(`[verify-code] Code expired at ${matchingCode.expires_at}`);
      return new Response(JSON.stringify({ valid: false, reason: 'expired' as ErrorReason }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Kod jest poprawny - oznacz jako użyty
    const { error: updateError } = await supabase
      .from("verification_codes")
      .update({ used_at: nowIso })
      .eq("id", matchingCode.id);

    if (updateError) {
      console.error("[verify-code] Error marking code as used:", updateError);
      throw updateError;
    }

    console.log(`[verify-code] Code verified successfully for user ${user_id}`);

    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[verify-code] Unexpected error:", error);
    return new Response(JSON.stringify({ valid: false, reason: 'invalid_code', error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
