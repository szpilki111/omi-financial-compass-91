import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildEmailTemplate, APP_URL } from '../_shared/emailTemplate.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportNotificationRequest {
  reportId: string;
  reportTitle: string;
  submittedBy: string;
  locationName: string;
  period: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting report notification process");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { reportId, reportTitle, submittedBy, locationName, period }: ReportNotificationRequest = await req.json();
    
    console.log("Notification data:", { reportId, reportTitle, submittedBy, locationName, period });

    const { data: provincialAdmins, error: adminsError } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('role', 'prowincjal');

    if (adminsError) {
      console.error('Error fetching provincial admins:', adminsError);
      throw new Error('Failed to fetch provincial administrators');
    }

    if (!provincialAdmins || provincialAdmins.length === 0) {
      console.log('No provincial administrators found');
      return new Response(JSON.stringify({ message: 'No provincial administrators to notify' }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${provincialAdmins.length} provincial administrators to notify`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    for (const admin of provincialAdmins) {
      console.log(`Sending notification to: ${admin.email}`);
      
      const { html, text } = buildEmailTemplate({
        title: '📊 Nowy raport do sprawdzenia',
        subtitle: 'System Finansowy OMI',
        greeting: `Szanowny/a ${admin.name},`,
        content: '<p>Informujemy, że nowy raport został złożony i oczekuje na Państwa sprawdzenie.</p><p>Aby sprawdzić i zatwierdzić raport, zaloguj się do systemu raportowania.</p>',
        infoItems: [
          { label: 'Tytuł raportu', value: reportTitle },
          { label: 'Okres', value: period },
          { label: 'Placówka', value: locationName },
          { label: 'Złożony przez', value: submittedBy },
        ],
        color: 'blue',
      });

      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            to: admin.email,
            subject: `Nowy raport do sprawdzenia: ${reportTitle}`,
            html,
            text,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`Failed to send email to ${admin.email}:`, error);
          throw new Error(`Failed to send email: ${error}`);
        }

        console.log(`Email sent successfully to ${admin.email}`);
      } catch (error) {
        console.error(`Error sending email to ${admin.email}:`, error);
        throw error;
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Notifications sent to ${provincialAdmins.length} provincial administrators` 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-report-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
