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

// Encode subject according to RFC 2047 for proper Polish character display
function encodeSubject(subject: string): string {
  // Check if subject contains non-ASCII characters
  if (!/[^\x00-\x7F]/.test(subject)) {
    return subject; // No encoding needed for ASCII-only
  }
  // Encode as base64 UTF-8 per RFC 2047
  const encoder = new TextEncoder();
  const bytes = encoder.encode(subject);
  const base64 = btoa(String.fromCharCode(...bytes));
  return `=?UTF-8?B?${base64}?=`;
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

    // Get SMTP configuration from environment
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      console.error('Missing SMTP configuration');
      throw new Error('SMTP configuration is incomplete');
    }

    // Initialize SMTP client
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort),
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];

    // Encode subject for proper Polish character display
    const encodedSubject = encodeSubject(subject);
    console.log('Encoded subject:', encodedSubject);

    // Send email with UTF-8 charset
    await client.send({
      from: from || 'System Finansowy OMI <finanse@oblaci.pl>',
      to: recipients.join(','),
      subject: encodedSubject,
      content: text || '',
      html: html || undefined,
      replyTo: replyTo || undefined,
      charset: 'utf-8',
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
