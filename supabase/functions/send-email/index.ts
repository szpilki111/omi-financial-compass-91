import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let client: SMTPClient | null = null;

  try {
    const { to, subject, text, html, from, replyTo }: EmailRequest = await req.json();

    console.log("Attempting to send email to:", to);
    console.log("Subject:", subject);

    // Validate required fields
    if (!to || !subject) {
      throw new Error("Missing required fields: to and subject are required");
    }

    if (!text && !html) {
      throw new Error("Either text or html content is required");
    }

    // Get SMTP configuration from environment
    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPortRaw = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpHost || !smtpPortRaw || !smtpUser || !smtpPassword) {
      console.error("Missing SMTP configuration");
      throw new Error("SMTP configuration is incomplete");
    }

    const smtpPort = Number.parseInt(smtpPortRaw, 10);
    if (!Number.isFinite(smtpPort)) {
      throw new Error("SMTP_PORT is not a valid number");
    }

    // Port 465 = implicit TLS. For 587/25 we connect plain and denomailer upgrades via STARTTLS.
    const implicitTls = smtpPort === 465;

    client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: implicitTls,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
      // Require encryption (either implicit TLS or STARTTLS)
      debug: {
        allowUnsecure: false,
      },
    });

    // Prepare recipients
    const recipients = Array.isArray(to) ? to : [to];

    // Send email (denomailer accepts comma-separated recipients)
    await client.send({
      from: from || "System Finansowy OMI <finanse@oblaci.pl>",
      to: recipients.join(","),
      subject,
      content: text || "",
      html: html || undefined,
      replyTo: replyTo || undefined,
    });

    await client.close();
    client = null;

    console.log("Email sent successfully to:", recipients);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email sent successfully",
        recipients,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);

    try {
      await client?.close();
    } catch {
      // ignore
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? "Unknown error",
        details: String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }
};

serve(handler);
