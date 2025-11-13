// Send a simple update notification
export const sendErrorReportUpdateEmail = async (
  to: string,
  reportTitle: string,
  reportId: string
) => {
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpPort = Deno.env.get('SMTP_PORT');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    console.error('Missing SMTP configuration');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
        .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Aktualizacja zgłoszenia</h1>
        </div>
        <div class="content">
          <p>Nastąpiła aktualizacja Twojego zgłoszenia.</p>
          <p><strong>Tytuł zgłoszenia:</strong> ${reportTitle}</p>
          <a href="${supabaseUrl}/administracja" class="button">Zobacz zgłoszenie</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Aktualizacja zgłoszenia

Nastąpiła aktualizacja Twojego zgłoszenia.

Tytuł zgłoszenia: ${reportTitle}

Zobacz szczegóły w panelu administracyjnym: ${supabaseUrl}/administracja
  `;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({
        to,
        subject: 'Aktualizacja zgłoszenia błędu',
        html: htmlContent,
        text: textContent,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send update email:', error);
    }
  } catch (error) {
    console.error('Error sending update email:', error);
  }
};

export const sendErrorReportResponseEmail = async (
  to: string,
  reportTitle: string,
  responderName: string,
  message: string,
  reportId: string
) => {
  const SMTP_HOST = Deno.env.get('SMTP_HOST');
  const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
  const SMTP_USER = Deno.env.get('SMTP_USER');
  const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD');
  const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'finanse@oblaci.pl';
  const SMTP_REPLY_TO = Deno.env.get('SMTP_REPLY_TO') || 'finanse@oblaci.pl';

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error('SMTP configuration is missing');
  }

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
          .message-box { background-color: white; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; }
          .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
          .footer { margin-top: 30px; text-align: center; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Finansowy OMI</h1>
            <p>Nowa odpowiedź na zgłoszenie błędu</p>
          </div>
          
          <div class="content">
            <p>Witaj,</p>
            <p><strong>${responderName}</strong> dodał nową odpowiedź do Twojego zgłoszenia błędu:</p>
            
            <p><strong>Tytuł zgłoszenia:</strong> ${reportTitle}</p>
            
            <div class="message-box">
              <p style="margin: 0; white-space: pre-wrap;">${message}</p>
            </div>
            
            <p>Możesz odpowiedzieć na tę wiadomość, wysyłając email na adres:</p>
            <p><strong>${SMTP_REPLY_TO}</strong></p>
            <p style="font-size: 12px; color: #6b7280;">W temacie lub treści wiadomości dodaj: [#${reportId}]</p>
          </div>
          
          <div class="footer">
            <p>To jest automatyczna wiadomość z systemu finansowego OMI.</p>
            <p>&copy; 2024 Oblaci.net. Wszystkie prawa zastrzeżone.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const emailText = `
System Finansowy OMI - Nowa odpowiedź na zgłoszenie błędu

${responderName} dodał nową odpowiedź do Twojego zgłoszenia błędu:

Tytuł zgłoszenia: ${reportTitle}

Odpowiedź:
${message}

Możesz odpowiedzieć na tę wiadomość, wysyłając email na adres:
${SMTP_REPLY_TO}

W temacie lub treści wiadomości dodaj: [#${reportId}]

---
To jest automatyczna wiadomość z systemu finansowego OMI.
© 2024 Oblaci.net. Wszystkie prawa zastrzeżone.
  `;

  const subject = `System Finansowy OMI - Nowa odpowiedź: ${reportTitle} [#${reportId}]`;

  // Use send-email function
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  
  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
    },
    body: JSON.stringify({
      to,
      subject,
      text: emailText,
      html: emailHtml,
      from: SMTP_FROM,
      replyTo: SMTP_REPLY_TO,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
};
