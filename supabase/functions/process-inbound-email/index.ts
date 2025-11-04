import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.9";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InboundEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing inbound email...');
    
    const emailData: InboundEmail = await req.json();
    console.log('Email from:', emailData.from);
    console.log('Email to:', emailData.to);
    console.log('Subject:', emailData.subject);

    // Extract report ID from the "to" address
    // Expected format: errors+{report_id}@domain.com or reply to In-Reply-To header
    const toAddress = emailData.to.toLowerCase();
    let reportId: string | null = null;

    // Try to extract from address (format: errors+{uuid}@domain.com)
    const addressMatch = toAddress.match(/errors\+([a-f0-9-]{36})@/);
    if (addressMatch) {
      reportId = addressMatch[1];
      console.log('Extracted report ID from address:', reportId);
    }

    // Try to extract from subject if not found in address
    if (!reportId) {
      const subjectMatch = emailData.subject.match(/\[#([a-f0-9-]{36})\]/);
      if (subjectMatch) {
        reportId = subjectMatch[1];
        console.log('Extracted report ID from subject:', reportId);
      }
    }

    if (!reportId) {
      console.error('Could not extract report ID from email');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not identify error report from email' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the error report and verify sender
    const { data: report, error: reportError } = await supabase
      .from('error_reports')
      .select('id, user_id, profiles!inner(email)')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      console.error('Error report not found:', reportError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Error report not found' 
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Verify sender is the report author
    const senderEmail = emailData.from.toLowerCase();
    const authorEmail = (report.profiles as any)?.email?.toLowerCase();
    
    if (!senderEmail.includes(authorEmail)) {
      console.error('Sender email does not match report author');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Unauthorized sender' 
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Extract message content (prefer text over html)
    let messageContent = emailData.text || '';
    
    // Clean up common email reply artifacts
    if (messageContent) {
      // Remove quoted text (lines starting with >)
      messageContent = messageContent
        .split('\n')
        .filter(line => !line.trim().startsWith('>'))
        .join('\n')
        .trim();
      
      // Remove common email signatures
      const signatureMarkers = ['--', '___', 'Sent from', 'Get Outlook'];
      for (const marker of signatureMarkers) {
        const markerIndex = messageContent.indexOf(marker);
        if (markerIndex > 0) {
          messageContent = messageContent.substring(0, markerIndex).trim();
        }
      }
    }

    if (!messageContent || messageContent.length < 5) {
      console.error('Message content too short or empty');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Message content is empty or too short' 
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Add response to the error report
    const { error: insertError } = await supabase
      .from('error_report_responses')
      .insert({
        error_report_id: reportId,
        user_id: report.user_id,
        message: messageContent,
        attachments: null, // Email attachments handling could be added later
      });

    if (insertError) {
      console.error('Error inserting response:', insertError);
      throw insertError;
    }

    console.log('Successfully added email response to error report');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email response added successfully',
        reportId 
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
    console.error('Error processing inbound email:', error);
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
