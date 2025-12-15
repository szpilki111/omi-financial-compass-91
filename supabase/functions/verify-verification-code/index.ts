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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    if (!user_id || !fingerprint || codeNormalized.length !== 6) {
      return new Response(JSON.stringify({ valid: false, error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const nowIso = new Date().toISOString();

    const { data: verification, error: fetchError } = await supabase
      .from("verification_codes")
      .select("id")
      .eq("user_id", user_id)
      .eq("device_fingerprint", fingerprint)
      .eq("code", codeNormalized)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("verify-verification-code: fetch error", fetchError);
      throw fetchError;
    }

    if (!verification?.id) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: updateError } = await supabase
      .from("verification_codes")
      .update({ used_at: nowIso })
      .eq("id", verification.id);

    if (updateError) {
      console.error("verify-verification-code: update error", updateError);
      throw updateError;
    }

    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in verify-verification-code function:", error);
    return new Response(JSON.stringify({ valid: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
