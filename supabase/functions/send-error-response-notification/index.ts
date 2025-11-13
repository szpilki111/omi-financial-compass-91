import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.9";
import { sendErrorReportResponseEmail, sendErrorReportUpdateEmail } from "../_shared/emailUtils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  reportId: string;
  responderId: string;
  message?: string; // Optional - if not provided, sends simple update notification
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportId, responderId, message }: NotificationRequest = await req.json();

    console.log('Processing notification for report:', reportId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Send email in background - don't block response
    const emailTask = async () => {
      try {
        // Fetch report details
        const { data: report, error: reportError } = await supabase
          .from('error_reports')
          .select('id, title, user_id')
          .eq('id', reportId)
          .single();

        if (reportError || !report) {
          console.error('Report not found:', reportError);
          return;
        }

        // Fetch user profile
        const { data: userProfile, error: userError } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', report.user_id)
          .single();

        if (userError || !userProfile) {
          console.error('User profile not found:', userError);
          return;
        }

        // Fetch responder details
        const { data: responder } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', responderId)
          .single();

        // Send email notification based on whether message is provided
        if (message) {
          await sendErrorReportResponseEmail(
            userProfile.email,
            report.title,
            responder?.name || 'Administrator',
            message,
            report.id
          );
        } else {
          await sendErrorReportUpdateEmail(
            userProfile.email,
            report.title,
            report.id
          );
        }

        console.log('Email notification sent successfully');
      } catch (error) {
        console.error('Error sending email notification:', error);
        // Don't throw - we don't want to fail the background task
      }
    };

    // Schedule background task
    EdgeRuntime.waitUntil(emailTask());

    // Return immediately
    return new Response(
      JSON.stringify({ success: true, message: 'Notification queued' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in send-error-response-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};

serve(handler);
