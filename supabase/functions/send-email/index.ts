import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getSmtpConfig(): SmtpConfig {
  const host = Deno.env.get("SMTP_HOST");
  const portRaw = Deno.env.get("SMTP_PORT");
  const user = Deno.env.get("SMTP_USER");
  const password = Deno.env.get("SMTP_PASSWORD");

  if (!host || !portRaw || !user || !password) {
    throw new Error("SMTP configuration is incomplete");
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT is not a valid number");
  }

  return { host, port, user, password };
}

function extractEmailAddress(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/<([^>]+)>/);
  return (m?.[1] ?? trimmed).trim();
}

function encodeBase64Utf8(value: string): string {
  const bytes = encoder.encode(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

class LineReader {
  private buf = "";
  private tmp = new Uint8Array(4096);

  constructor(private conn: Deno.Conn) {}

  async readLine(): Promise<string> {
    while (true) {
      const idx = this.buf.indexOf("\n");
      if (idx !== -1) {
        const line = this.buf.slice(0, idx + 1);
        this.buf = this.buf.slice(idx + 1);
        return line.replace(/\r?\n$/, "").replace(/\r$/, "");
      }

      const n = await this.conn.read(this.tmp);
      if (n === null) {
        throw new Error("SMTP connection closed");
      }
      this.buf += decoder.decode(this.tmp.subarray(0, n));
    }
  }
}

async function readResponse(lr: LineReader): Promise<{ code: number; lines: string[] }> {
  const lines: string[] = [];

  while (true) {
    const line = await lr.readLine();
    lines.push(line);
    if (line.length >= 4 && line[3] !== "-") break;
  }

  const code = Number.parseInt(lines[0].slice(0, 3), 10);
  if (!Number.isFinite(code)) {
    throw new Error(`Invalid SMTP response: ${lines[0]}`);
  }

  return { code, lines };
}

async function writeLine(conn: Deno.Conn, line: string) {
  await conn.write(encoder.encode(line + "\r\n"));
}

async function smtpCmd(lr: LineReader, conn: Deno.Conn, cmd: string, stage: string) {
  await writeLine(conn, cmd);
  const res = await readResponse(lr);
  return { ...res, stage };
}

function buildMimeMessage(params: {
  fromHeader: string;
  toHeader: string;
  subject: string;
  replyTo?: string;
  text?: string;
  html?: string;
}): string {
  const { fromHeader, toHeader, subject, replyTo, text, html } = params;

  const headers: string[] = [];
  headers.push(`From: ${fromHeader}`);
  headers.push(`To: ${toHeader}`);
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  headers.push(`Subject: ${subject}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push(`Message-ID: <${crypto.randomUUID()}@oblaci.local>`);
  headers.push("MIME-Version: 1.0");

  let body = "";

  if (text && html) {
    const boundary = `alt_${crypto.randomUUID().replace(/-/g, "")}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

    body += `--${boundary}\r\n`;
    body += `Content-Type: text/plain; charset="UTF-8"\r\n`;
    body += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    body += `${text}\r\n\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Type: text/html; charset="UTF-8"\r\n`;
    body += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    body += `${html}\r\n\r\n`;

    body += `--${boundary}--\r\n`;
  } else if (html) {
    headers.push(`Content-Type: text/html; charset="UTF-8"`);
    headers.push(`Content-Transfer-Encoding: 8bit`);
    body = `${html}\r\n`;
  } else {
    headers.push(`Content-Type: text/plain; charset="UTF-8"`);
    headers.push(`Content-Transfer-Encoding: 8bit`);
    body = `${text || ""}\r\n`;
  }

  const message = headers.join("\r\n") + "\r\n\r\n" + body;

  // dot-stuffing: any line starting with '.' must be prefixed with another '.'
  return message
    .split("\r\n")
    .map((l) => (l.startsWith(".") ? `.${l}` : l))
    .join("\r\n");
}

function isConnReset(err: unknown) {
  const e = err as any;
  return e?.name === "ConnectionReset" || e?.code === "ECONNRESET" || String(e?.message || "").toLowerCase().includes("connection reset");
}

async function sendSmtpMail(cfg: SmtpConfig, mail: {
  recipients: string[];
  subject: string;
  text?: string;
  html?: string;
  fromHeader: string;
  replyTo?: string;
}) {
  let stage = "connect";
  let conn: Deno.Conn | null = null;

  try {
    // 465 = implicit TLS (SMTPS). Other ports: STARTTLS is required.
    if (cfg.port === 465) {
      conn = await Deno.connectTls({ hostname: cfg.host, port: cfg.port });
    } else {
      conn = await Deno.connect({ hostname: cfg.host, port: cfg.port });
    }

    const lr = new LineReader(conn);

    stage = "greeting";
    const greet = await readResponse(lr);
    if (greet.code !== 220) {
      throw new Error(`SMTP greeting failed (${greet.code}): ${greet.lines.join(" | ")}`);
    }

    const heloName = "finanse.oblaci.pl";

    const doEhlo = async () => {
      stage = "ehlo";
      const ehlo = await smtpCmd(lr, conn!, `EHLO ${heloName}`, stage);
      if (ehlo.code === 250) return ehlo;
      stage = "helo";
      const helo = await smtpCmd(lr, conn!, `HELO ${heloName}`, stage);
      if (helo.code !== 250) {
        throw new Error(`SMTP HELO/EHLO failed (${helo.code}): ${helo.lines.join(" | ")}`);
      }
      return helo;
    };

    const ehlo1 = await doEhlo();

    if (cfg.port !== 465) {
      stage = "starttls_check";
      const supportsStartTls = ehlo1.lines.some((l) => l.toUpperCase().includes("STARTTLS"));
      if (!supportsStartTls) {
        throw new Error("SMTP server does not advertise STARTTLS (refusing insecure auth)");
      }

      stage = "starttls";
      const startTlsRes = await smtpCmd(lr, conn!, "STARTTLS", stage);
      if (startTlsRes.code !== 220) {
        throw new Error(`STARTTLS failed (${startTlsRes.code}): ${startTlsRes.lines.join(" | ")}`);
      }

      conn = await Deno.startTls(conn!, { hostname: cfg.host });

      // After STARTTLS upgrade we need a new reader bound to the new connection
      const tlsReader = new LineReader(conn);
      // swap by shadowing
      (lr as any).conn = conn;
      (lr as any).buf = "";
      // Re-EHLO
      stage = "ehlo_after_starttls";
      await smtpCmd(tlsReader, conn, `EHLO ${heloName}`, stage);
    }

    // AUTH
    stage = "auth_login";
    let auth = await smtpCmd(lr, conn!, "AUTH LOGIN", stage);

    if (auth.code === 504 || auth.code === 500) {
      // Try AUTH PLAIN
      stage = "auth_plain";
      const plain = `\u0000${cfg.user}\u0000${cfg.password}`;
      auth = await smtpCmd(lr, conn!, `AUTH PLAIN ${encodeBase64Utf8(plain)}`, stage);
      if (auth.code !== 235) {
        throw new Error(`AUTH PLAIN failed (${auth.code}): ${auth.lines.join(" | ")}`);
      }
    } else {
      if (auth.code !== 334) {
        throw new Error(`AUTH LOGIN not accepted (${auth.code}): ${auth.lines.join(" | ")}`);
      }

      stage = "auth_user";
      const u = await smtpCmd(lr, conn!, encodeBase64Utf8(cfg.user), stage);
      if (u.code !== 334) {
        throw new Error(`AUTH username rejected (${u.code}): ${u.lines.join(" | ")}`);
      }

      stage = "auth_pass";
      const p = await smtpCmd(lr, conn!, encodeBase64Utf8(cfg.password), stage);
      if (p.code !== 235) {
        throw new Error(`AUTH password rejected (${p.code}): ${p.lines.join(" | ")}`);
      }
    }

    // MAIL FROM / RCPT TO
    const envelopeFrom = extractEmailAddress(mail.fromHeader);

    stage = "mail_from";
    const mf = await smtpCmd(lr, conn!, `MAIL FROM:<${envelopeFrom}>`, stage);
    if (mf.code !== 250) {
      throw new Error(`MAIL FROM rejected (${mf.code}): ${mf.lines.join(" | ")}`);
    }

    for (const rcpt of mail.recipients) {
      stage = "rcpt_to";
      const addr = extractEmailAddress(rcpt);
      const r = await smtpCmd(lr, conn!, `RCPT TO:<${addr}>`, stage);
      if (r.code !== 250 && r.code !== 251) {
        throw new Error(`RCPT TO rejected (${r.code}): ${r.lines.join(" | ")}`);
      }
    }

    stage = "data";
    const dataRes = await smtpCmd(lr, conn!, "DATA", stage);
    if (dataRes.code !== 354) {
      throw new Error(`DATA rejected (${dataRes.code}): ${dataRes.lines.join(" | ")}`);
    }

    const toHeader = mail.recipients.join(", ");
    const message = buildMimeMessage({
      fromHeader: mail.fromHeader,
      toHeader,
      subject: mail.subject,
      replyTo: mail.replyTo,
      text: mail.text,
      html: mail.html,
    });

    // message must end with CRLF before <CRLF>.<CRLF>
    const payload = message.endsWith("\r\n") ? message : message + "\r\n";

    stage = "data_payload";
    await conn!.write(encoder.encode(payload + "\r\n.\r\n"));

    stage = "data_result";
    const dataOk = await readResponse(lr);
    if (dataOk.code !== 250) {
      throw new Error(`Message not accepted (${dataOk.code}): ${dataOk.lines.join(" | ")}`);
    }

    stage = "quit";
    await smtpCmd(lr, conn!, "QUIT", stage);
  } catch (err) {
    const enriched = new Error(`SMTP failed at stage=${stage}: ${String((err as any)?.message ?? err)}`);
    (enriched as any).cause = err;
    throw enriched;
  } finally {
    try {
      conn?.close();
    } catch {
      // ignore
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
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

    const cfg = getSmtpConfig();
    const recipients = (Array.isArray(to) ? to : [to]).map((x) => x.trim()).filter(Boolean);

    const fromHeader = from || "System Finansowy OMI <finanse@oblaci.pl>";

    // Retry on transient connection resets (common with firewalls / rate limits)
    const maxAttempts = 3;
    let lastErr: unknown = null;

    for (let i = 1; i <= maxAttempts; i++) {
      try {
        console.log(`[send-email] SMTP send attempt ${i}/${maxAttempts} host=${cfg.host} port=${cfg.port}`);
        await sendSmtpMail(cfg, {
          recipients,
          subject,
          text,
          html,
          fromHeader,
          replyTo,
        });

        console.log("Email sent successfully to:", recipients);

        return new Response(
          JSON.stringify({ success: true, message: "Email sent successfully", recipients }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      } catch (err) {
        lastErr = err;
        console.error(`[send-email] SMTP attempt ${i} failed`, err);
        if (!isConnReset(err) || i === maxAttempts) break;
        await sleep(400 * i);
      }
    }

    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message ?? "Unknown error",
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

