import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function generateStrongPassword(length = 12) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()_+[]{}|;:,.<>?";
  const all = upper + lower + digits + symbols;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ].join("");
  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing Authorization token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseAuth = createClient(supabaseUrl, anonKey);

    // Identify caller
    const { data: userData, error: getUserErr } = await supabaseAuth.auth.getUser(token);
    if (getUserErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;

    // Check role (must be prowincjal or admin)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profileErr) {
      console.error("Error fetching caller profile:", profileErr);
      return new Response(JSON.stringify({ error: "Cannot verify permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(profile?.role === "prowincjal" || profile?.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, profile: newProfile } = body as {
      email: string;
      password?: string;
      profile: {
        login?: string;
        first_name?: string;
        last_name?: string;
        position?: string;
        name: string;
        email: string;
        phone?: string;
        role: string;
        location_id?: string | null;
      };
    };

    if (!email || !newProfile?.name || !newProfile?.role) {
      return new Response(JSON.stringify({ error: "Invalid payload", code: "invalid_payload" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalPassword = password && password.length >= 6 ? password : generateStrongPassword(14);

    // Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: newProfile.name,
        role: newProfile.role,
      },
    });

    if (createErr || !created?.user) {
      console.error("createUser error:", createErr);
      return new Response(
        JSON.stringify({
          error: createErr?.message || "Create failed",
          code: (createErr as any)?.code || "create_failed",
        }),
        {
          // supabase-js nie przekazuje body dla non-2xx do klienta (FunctionsHttpError),
          // więc dla błędów walidacyjnych zwracamy 200 + {error, code}
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const newUserId = created.user.id;

    // Insert profile
    const { error: insertErr } = await supabaseAdmin.from("profiles").insert({
      id: newUserId,
      login: newProfile.login ?? null,
      first_name: newProfile.first_name ?? null,
      last_name: newProfile.last_name ?? null,
      position: newProfile.position ?? null,
      name: newProfile.name,
      email: newProfile.email,
      phone: newProfile.phone ?? null,
      role: newProfile.role,
      location_id: newProfile.location_id ?? null,
    });

    if (insertErr) {
      console.error("Insert profile error:", insertErr, {
        userId: newUserId,
        profileData: newProfile,
      });
      
      // Rollback: usuń użytkownika auth, który został utworzony
      // żeby nie zostawiać "osieroconych" użytkowników bez profilu
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        console.log("Rolled back auth user creation:", newUserId);
      } catch (deleteErr) {
        console.error("Failed to rollback auth user:", deleteErr);
      }
      
      return new Response(JSON.stringify({ error: insertErr.message, code: "profile_insert_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ user_id: newUserId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("create-user-admin unexpected error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});