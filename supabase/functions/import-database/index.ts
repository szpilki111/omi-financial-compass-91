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

    const { backupData } = await req.json();

    if (!backupData || !backupData.tables) {
      throw new Error('Invalid backup data format');
    }

    console.log('Starting database import...');
    console.log(`Backup from: ${backupData.timestamp}, Tables: ${backupData.metadata?.totalTables || 'unknown'}`);

    // Order of tables for import (considering dependencies)
    const importOrder = [
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

    let importedTables = 0;
    let importedRecords = 0;

    // Clear existing data in reverse order (to handle dependencies)
    const clearOrder = [...importOrder].reverse();
    for (const tableName of clearOrder) {
      try {
        console.log(`Clearing table: ${tableName}`);
        const { error } = await supabase
          .from(tableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
        
        if (error) {
          console.error(`Error clearing ${tableName}:`, error);
        }
      } catch (clearError) {
        console.error(`Failed to clear table ${tableName}:`, clearError);
      }
    }

    // Import data in correct order
    for (const tableName of importOrder) {
      const tableData = backupData.tables.find((t: any) => t.table_name === tableName);
      
      if (!tableData || !tableData.data || tableData.data.length === 0) {
        console.log(`No data to import for table: ${tableName}`);
        continue;
      }

      try {
        console.log(`Importing ${tableData.data.length} records to ${tableName}`);
        
        // Import in batches to avoid overwhelming the database
        const batchSize = 100;
        const batches = [];
        
        for (let i = 0; i < tableData.data.length; i += batchSize) {
          batches.push(tableData.data.slice(i, i + batchSize));
        }

        for (const batch of batches) {
          const { error } = await supabase
            .from(tableName)
            .insert(batch);

          if (error) {
            console.error(`Error importing batch to ${tableName}:`, error);
            throw error;
          }
        }

        importedRecords += tableData.data.length;
        importedTables++;
        console.log(`Successfully imported ${tableData.data.length} records to ${tableName}`);
        
      } catch (tableError) {
        console.error(`Failed to import table ${tableName}:`, tableError);
        throw new Error(`Failed to import table ${tableName}: ${tableError.message}`);
      }
    }

    console.log(`Database import completed. Tables: ${importedTables}, Records: ${importedRecords}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        importedTables,
        importedRecords,
        message: `Successfully imported ${importedRecords} records across ${importedTables} tables`
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Import database error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to import database' 
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