
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ReportNotificationRequest {
  reportId: string;
  reportTitle: string;
  submittedBy: string;
  locationName: string;
  period: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    // Get all provincial administrators (prowincjal role)
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

    // Send email to each provincial administrator
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    for (const admin of provincialAdmins) {
      console.log(`Sending notification to: ${admin.email}`);
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .report-box { background-color: #f5f5f5; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Nowy raport do sprawdzenia</h1>
            </div>
            <div class="content">
              <p>Szanowny/a ${admin.name},</p>
              <p>Informujemy, że nowy raport został złożony i oczekuje na Państwa sprawdzenie:</p>
              
              <div class="report-box">
                <p><strong>Tytuł raportu:</strong> ${reportTitle}</p>
                <p><strong>Okres:</strong> ${period}</p>
                <p><strong>Placówka:</strong> ${locationName}</p>
                <p><strong>Złożony przez:</strong> ${submittedBy}</p>
              </div>
              
              <p>Aby sprawdzić i zatwierdzić raport, zaloguj się do systemu raportowania.</p>
              
              <div class="footer">
                <p>System Raportowania OMI</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Nowy raport do sprawdzenia

Szanowny/a ${admin.name},

Informujemy, że nowy raport został złożony i oczekuje na Państwa sprawdzenie:

Tytuł raportu: ${reportTitle}
Okres: ${period}
Placówka: ${locationName}
Złożony przez: ${submittedBy}

Aby sprawdzić i zatwierdzić raport, zaloguj się do systemu raportowania.

System Raportowania OMI
      `;

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
            html: htmlContent,
            text: textContent,
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
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-report-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
