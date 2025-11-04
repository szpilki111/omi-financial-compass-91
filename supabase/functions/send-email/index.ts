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
    console.log('Reply-To:', replyTo);

    // Validate required fields
    if (!to || !subject) {
      throw new Error('Missing required fields: to and subject are required');
    }

    if (!text && !html) {
      throw new Error('Either text or html content is required');
    }

    // Get Resend API key
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY');
      throw new Error('RESEND_API_KEY is not configured');
    }

    const resend = new Resend(resendApiKey);

    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];

    // Send email using Resend
    const emailData: any = {
      from: from || 'System Finansowy OMI <finanse@oblaci.pl>',
      to: recipients,
      subject: subject,
      reply_to: replyTo || undefined,
    };

    // Add content based on what's provided
    if (html) {
      emailData.html = html;
    }
    if (text) {
      emailData.text = text;
    }

    const result = await resend.emails.send(emailData);

    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }

    console.log('Email sent successfully to:', recipients, 'ID:', result.data?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        recipients: recipients 
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
