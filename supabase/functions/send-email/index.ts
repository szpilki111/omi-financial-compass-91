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

type Attempt = {
  label: string;
  tls: boolean;
  // When tls=false, denomailer may upgrade via STARTTLS unless disabled.
  noStartTLS?: boolean;
};

function getSmtpConfig() {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPortRaw = Deno.env.get("SMTP_PORT");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  if (!smtpHost || !smtpPortRaw || !smtpUser || !smtpPassword) {
    throw new Error("SMTP configuration is incomplete");
  }

  const smtpPort = Number.parseInt(smtpPortRaw, 10);
  if (!Number.isFinite(smtpPort)) {
    throw new Error("SMTP_PORT is not a valid number");
  }

  return { smtpHost, smtpPort, smtpUser, smtpPassword };
}

async function trySendViaSmtp(params: {
  attempt: Attempt;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  mail: {
    recipients: string[];
    subject: string;
    text?: string;
    html?: string;
    from: string;
    replyTo?: string;
  };
}) {
  const { attempt, smtpHost, smtpPort, smtpUser, smtpPassword, mail } = params;

  console.log(
    `[send-email] SMTP attempt: ${attempt.label} host=${smtpHost} port=${smtpPort} tls=${attempt.tls} starttls=${!attempt.noStartTLS}`,
  );

  const client = new SMTPClient({
    connection: {
      hostname: smtpHost,
      port: smtpPort,
      tls: attempt.tls,
      auth: {
        username: smtpUser,
        password: smtpPassword,
      },
    },
    debug: {
      allowUnsecure: false,
      ...(attempt.noStartTLS ? { noStartTLS: true } : {}),
    },
  });

  try {
    await client.send({
      from: mail.from,
      to: mail.recipients.join(","),
      subject: mail.subject,
      content: mail.text || "",
      html: mail.html || undefined,
      replyTo: mail.replyTo || undefined,
    });
  } finally {
    try {
      await client.close();
    } catch {
      // ignore close errors
    }
  }
}

function isRetryableNetworkError(err: unknown) {
  const e = err as any;
  return (
    e?.name === "ConnectionReset" ||
    e?.code === "ECONNRESET" ||
    String(e?.message || "").toLowerCase().includes("connection reset")
  );
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, text, html, from, replyTo }: EmailRequest = await req.json();

    console.log("Attempting to send email to:", to);
    console.log("Subject:", subject);

    if (!to || !subject) {
      throw new Error("Missing required fields: to and subject are required");
    }
    if (!text && !html) {
      throw new Error("Either text or html content is required");
    }

    const { smtpHost, smtpPort, smtpUser, smtpPassword } = getSmtpConfig();

    const recipients = Array.isArray(to) ? to : [to];
    const mailFrom = from || "System Finansowy OMI <finanse@oblaci.pl>";

    // Strategy: prefer best-practice per port, but retry once with the opposite mode.
    // - 465: implicit TLS first, then STARTTLS
    // - 587/25: STARTTLS first, then implicit TLS
    const attempts: Attempt[] =
      smtpPort === 465
        ? [
            { label: "IMPLICIT_TLS", tls: true },
            { label: "STARTTLS", tls: false },
          ]
        : [
            { label: "STARTTLS", tls: false },
            { label: "IMPLICIT_TLS", tls: true },
          ];

    let lastError: unknown = null;

    for (let i = 0; i < attempts.length; i++) {
      const attempt = attempts[i];
      try {
        await trySendViaSmtp({
          attempt,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPassword,
          mail: {
            recipients,
            subject,
            text,
            html,
            from: mailFrom,
            replyTo,
          },
        });

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
      } catch (err) {
        lastError = err;
        console.error(`[send-email] Attempt failed: ${attempt.label}`, err);

        // If not retryable or this was last attempt, break.
        if (!isRetryableNetworkError(err) || i === attempts.length - 1) {
          break;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  } catch (error: any) {
    console.error("Error in send-email function:", error);
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
