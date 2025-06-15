
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
    for (const admin of provincialAdmins) {
      console.log(`Sending notification to: ${admin.email}`);
      
      // W trybie testowym wysyłaj na Twój email, w produkcji na email admina
      const recipientEmail = admin.email === 'prowincjal@omi.pl' ? 'crmoblaci@gmail.com' : admin.email;
      
      const emailResponse = await resend.emails.send({
        from: "System Raportowania <onboarding@resend.dev>",
        to: [recipientEmail],
        subject: `Nowy raport do sprawdzenia: ${reportTitle}`,
        html: `
          <h2>Nowy raport został złożony do sprawdzenia</h2>
          <p>Szanowny/a ${admin.name},</p>
          <p>Informujemy, że nowy raport został złożony i oczekuje na Państwa sprawdzenie:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0;">
            <p><strong>Tytuł raportu:</strong> ${reportTitle}</p>
            <p><strong>Okres:</strong> ${period}</p>
            <p><strong>Placówka:</strong> ${locationName}</p>
            <p><strong>Złożony przez:</strong> ${submittedBy}</p>
          </div>
          
          <p>Aby sprawdzić i zatwierdzić raport, zaloguj się do systemu raportowania.</p>
          
          ${recipientEmail !== admin.email ? 
            `<p><strong>Uwaga:</strong> Ten email został wysłany na adres testowy (${recipientEmail}) zamiast na docelowy adres (${admin.email}) z powodu ograniczeń trybu testowego Resend.</p>` : 
            ''
          }
          
          <p>Pozdrawienia,<br>System Raportowania</p>
        `,
      });

      console.log(`Email sent to ${recipientEmail}:`, emailResponse);
      
      if (emailResponse.error) {
        console.error(`Failed to send email to ${recipientEmail}:`, emailResponse.error);
        throw new Error(`Failed to send email: ${emailResponse.error.message}`);
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
