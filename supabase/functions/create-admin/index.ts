import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Creating admin user...');

    // 1. Create admin user in auth.users
    const adminEmail = "admin@omi.pl";
    const adminPassword = "admin123";

    // Check if admin already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", adminEmail)
      .single();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: `Administrator już istnieje. Email: ${adminEmail}`,
          credentials: { email: adminEmail, password: adminPassword }
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Create admin user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    });

    if (authError) {
      throw new Error(`Error creating admin user: ${authError.message}`);
    }

    console.log(`Admin user created with ID: ${authUser.user.id}`);

    // 2. Create admin profile
    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authUser.user.id,
        name: "Administrator Systemu",
        email: adminEmail,
        role: "admin"
      });

    if (profileError) {
      throw new Error(`Error creating admin profile: ${profileError.message}`);
    }

    console.log('Admin profile created successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Administrator został utworzony pomyślnie!`,
        credentials: { 
          email: adminEmail, 
          password: adminPassword 
        },
        instructions: "Zaloguj się używając powyższych danych, a następnie możesz wykonać import bazy danych."
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Create admin error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to create admin user' 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});