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
      throw new Error('Invalid backup data format. Expected object with "tables" property.');
    }

    // Validate backup data structure
    if (!Array.isArray(backupData.tables)) {
      throw new Error('Invalid backup data: tables must be an array');
    }

    console.log('Starting database import...');
    console.log(`Backup from: ${backupData.timestamp}, Tables: ${backupData.metadata?.totalTables || 'unknown'}`);

    // Order of tables for import (considering dependencies)
    const importOrder = [
      'locations',
      'location_settings', 
      'accounts',
      'location_accounts',
      'profiles',
      'user_settings',
      'documents',
      'transactions',
      'reports',
      'report_details',
      'report_sections',
      'report_entries',
      'account_section_mappings',
      'account_category_restrictions',
      'notifications'
    ];

    let importedTables = 0;
    let importedRecords = 0;

    // Clear existing data - use simple DELETE instead of TRUNCATE
    console.log('Clearing existing data using DELETE...');
    for (const tableName of importOrder.slice().reverse()) {
      try {
        console.log(`Clearing table: ${tableName}`);
        const { error } = await supabase
          .from(tableName)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
        
        if (error) {
          console.error(`Error clearing ${tableName}:`, error);
          // Continue with other tables even if one fails
        }
      } catch (clearError) {
        console.error(`Failed to clear table ${tableName}:`, clearError);
        // Continue with other tables even if one fails
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

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          console.log(`Importing batch ${batchIndex + 1}/${batches.length} for ${tableName}`);
          
          // Use insert for better reliability, with conflict resolution
          const { error } = await supabase
            .from(tableName)
            .upsert(batch, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            });

          if (error) {
            console.error(`Error importing batch ${batchIndex + 1} to ${tableName}:`, error);
            console.error('Failed batch data sample:', JSON.stringify(batch.slice(0, 2), null, 2));
            
            // Try regular insert as fallback
            const { error: insertError } = await supabase
              .from(tableName)
              .insert(batch);
              
            if (insertError) {
              console.error(`Fallback insert also failed for ${tableName}:`, insertError);
              throw new Error(`Failed to import batch ${batchIndex + 1} to ${tableName}: ${error.message}`);
            }
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
        error: error.message || 'Failed to import database',
        details: 'Check the function logs for more information about the specific failure.'
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