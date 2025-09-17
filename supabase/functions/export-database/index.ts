import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.9'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DatabaseTable {
  table_name: string;
  data: any[];
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

    // Verify user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      throw new Error('Admin role required');
    }

    console.log('Starting database export...');

    // List of tables to export in dependency order
    const tablesToExport = [
      'locations',
      'location_settings', 
      'accounts',
      'location_accounts',
      'profiles', // profiles reference locations
      'user_settings', 
      'documents', // documents reference locations and users
      'transactions', // transactions reference documents and accounts
      'reports', // reports reference locations and users
      'report_details', // report_details reference reports
      'report_sections',
      'report_entries', // report_entries reference reports
      'account_section_mappings',
      'account_category_restrictions',
      'notifications'
    ];

    const exportData: { 
      timestamp: string;
      tables: DatabaseTable[];
      metadata: {
        exportedBy: string;
        totalTables: number;
        totalRecords: number;
      }
    } = {
      timestamp: new Date().toISOString(),
      tables: [],
      metadata: {
        exportedBy: user.email || user.id,
        totalTables: 0,
        totalRecords: 0
      }
    };

    let totalRecords = 0;

    // Export each table
    for (const tableName of tablesToExport) {
      try {
        console.log(`Exporting table: ${tableName}`);
        
        const { data, error } = await supabase
          .from(tableName)
          .select('*');

        if (error) {
          console.error(`Error exporting ${tableName}:`, error);
          continue;
        }

        if (data && data.length > 0) {
          exportData.tables.push({
            table_name: tableName,
            data: data
          });
          totalRecords += data.length;
          console.log(`Exported ${data.length} records from ${tableName}`);
        }
      } catch (tableError) {
        console.error(`Failed to export table ${tableName}:`, tableError);
      }
    }

    exportData.metadata.totalTables = exportData.tables.length;
    exportData.metadata.totalRecords = totalRecords;

    console.log(`Database export completed. Tables: ${exportData.metadata.totalTables}, Records: ${totalRecords}`);

    return new Response(
      JSON.stringify(exportData),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Export database error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to export database' 
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