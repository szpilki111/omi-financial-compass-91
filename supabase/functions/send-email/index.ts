import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, text, html, from, replyTo }: EmailRequest = await req.json();

    console.log('Attempting to send email to:', to);
    console.log('Subject:', subject);

    // Validate required fields
    if (!to || !subject) {
      throw new Error('Missing required fields: to and subject are required');
    }

    if (!text && !html) {
      throw new Error('Either text or html content is required');
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(resendApiKey);

    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: from || 'System Finansowy OMI <finanse@oblaci.pl>',
      to: recipients,
      subject: subject,
      text: text || undefined,
      html: html || undefined,
      reply_to: replyTo || undefined,
    });

    console.log('Email sent successfully:', emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        recipients: recipients,
        id: emailResponse.data?.id
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        details: error.toString()
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
