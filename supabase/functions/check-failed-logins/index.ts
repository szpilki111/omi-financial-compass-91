import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, email, since } = await req.json();

    if ((!user_id && !email) || !since) {
      return new Response(
        JSON.stringify({ error: 'Missing user_id/email or since parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking failed logins for:', { user_id, email, since });

    // Count failed login attempts by user_id OR email
    let query = supabase
      .from('user_login_events')
      .select('id', { count: 'exact', head: false })
      .eq('success', false)
      .gte('created_at', since);

    // Filter by user_id if available, otherwise by email
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else if (email) {
      query = query.eq('email', email);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error counting failed logins:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to count login attempts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Failed login count:', count);

    return new Response(
      JSON.stringify({ count: count || 0 }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
