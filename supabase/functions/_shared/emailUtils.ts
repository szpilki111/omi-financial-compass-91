// Send status change notification
export const sendErrorReportUpdateEmail = async (
  to: string,
  reportTitle: string,
  reportId: string,
  previousStatus?: string,
  newStatus?: string
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

  const statusLabels: Record<string, string> = {
    'new': 'Nowe',
    'in_progress': 'W trakcie',
    'resolved': 'Rozwiązane',
    'closed': 'Zamknięte',
    'needs_info': 'Wymaga informacji'
  };

  const statusText = previousStatus && newStatus 
    ? `<p><strong>Poprzedni status:</strong> ${statusLabels[previousStatus] || previousStatus}</p>
       <p><strong>Nowy status:</strong> ${statusLabels[newStatus] || newStatus}</p>`
    : '<p>Nastąpiła aktualizacja Twojego zgłoszenia.</p>';

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
        .status-box { background-color: white; border-left: 4px solid #4F46E5; padding: 15px; margin: 20px 0; }
        .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Zmiana statusu zgłoszenia</h1>
        </div>
        <div class="content">
          <p><strong>Tytuł zgłoszenia:</strong> ${reportTitle}</p>
          <div class="status-box">
            ${statusText}
          </div>
          <a href="${supabaseUrl}/administracja" class="button">Zobacz zgłoszenie</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const statusTextPlain = previousStatus && newStatus 
    ? `Poprzedni status: ${statusLabels[previousStatus] || previousStatus}\nNowy status: ${statusLabels[newStatus] || newStatus}`
    : 'Nastąpiła aktualizacja Twojego zgłoszenia.';

  const textContent = `
Zmiana statusu zgłoszenia

Tytuł zgłoszenia: ${reportTitle}

${statusTextPlain}

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
        subject: 'Zmiana statusu zgłoszenia błędu',
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
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpPort = Deno.env.get('SMTP_PORT');
  const smtpUser = Deno.env.get('SMTP_USER');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    console.error('Missing SMTP configuration');
    return;
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
        .button { display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nowa odpowiedź w zgłoszeniu</h1>
        </div>
        <div class="content">
          <p><strong>Tytuł zgłoszenia:</strong> ${reportTitle}</p>
          <p><strong>Odpowiedział:</strong> ${responderName}</p>
          <div class="message-box">
            <p>${message}</p>
          </div>
          <a href="${supabaseUrl}/administracja" class="button">Zobacz zgłoszenie</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailText = `
Nowa odpowiedź w zgłoszeniu

Tytuł zgłoszenia: ${reportTitle}
Odpowiedział: ${responderName}

Wiadomość:
${message}

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
        subject: 'Nowa odpowiedź w zgłoszeniu błędu',
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send response email:', error);
    }
  } catch (error) {
    console.error('Error sending response email:', error);
  }
};
