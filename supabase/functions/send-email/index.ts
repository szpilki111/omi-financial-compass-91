import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    // Get SMTP configuration from environment variables
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');

    if (!smtpHost || !smtpUser || !smtpPassword) {
      console.error('Missing SMTP configuration');
      throw new Error('SMTP configuration is incomplete');
    }

    console.log('SMTP Configuration:', {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
    });

    // Create SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465, // Use TLS for port 465 (SSL), false for 587 (STARTTLS)
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];

    // Send email
    await client.send({
      from: from || smtpUser,
      to: recipients,
      subject: subject,
      content: text || '',
      html: html || undefined,
      replyTo: replyTo || undefined,
    });

    await client.close();

    console.log('Email sent successfully to:', recipients);

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
