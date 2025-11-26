import { supabase } from '@/integrations/supabase/client';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

/**
 * Wysyła email przez serwer SMTP organizacji
 * @param params Parametry emaila (to, subject, text lub html)
 * @returns Promise z wynikiem wysyłania
 */
export const sendEmail = async (params: SendEmailParams) => {
  try {
    console.log('Sending email via edge function:', params.subject);
    
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: params,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};


/**
 * Wysyła email z powiadomieniem o nowej odpowiedzi na zgłoszenie błędu
 */
export const sendErrorReportResponseEmail = async (
  recipientEmail: string,
  reportTitle: string,
  responderName: string,
  responseMessage: string,
  reportId: string
) => {
  const html = `
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
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nowa odpowiedź w zgłoszeniu</h1>
        </div>
        <div class="content">
          <p>Szczęść Boże!</p>
          <p><strong>Tytuł zgłoszenia:</strong> ${reportTitle}</p>
          <p><strong>Odpowiedział:</strong> ${responderName}</p>
          <div class="message-box">
            <p>${responseMessage.replace(/\n/g, '<br>')}</p>
          </div>
          <p style="margin-top: 20px;">
            Możesz odpowiedzieć na tę wiadomość, aby dodać swoją odpowiedź do zgłoszenia.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Nowa odpowiedź w zgłoszeniu

Tytuł zgłoszenia: ${reportTitle}
Odpowiedział: ${responderName}

Wiadomość:
${responseMessage}

Możesz odpowiedzieć na tę wiadomość, aby dodać swoją odpowiedź do zgłoszenia.
  `;

  const fromAddress = 'finanse@oblaci.pl';
  const replyToAddress = `finanse@oblaci.pl`;

  return sendEmail({
    to: recipientEmail,
    subject: `Nowa odpowiedź w zgłoszeniu: ${reportTitle}`,
    text,
    html,
    from: `System Finansowy OMI <${fromAddress}>`,
    replyTo: replyToAddress,
  });
};

/**
 * Wysyła potwierdzenie zgłoszenia błędu do użytkownika
 */
export const sendErrorReportConfirmationEmail = async (
  recipientEmail: string,
  userName: string,
  reportTitle: string,
  reportDescription: string,
  priority: string,
  reportId: string
) => {
  const priorityLabels: Record<string, string> = {
    low: "Niski",
    medium: "Średni", 
    high: "Wysoki",
    critical: "Krytyczny",
  };

  const priorityColor = priority === 'critical' ? '#dc2626' : priority === 'high' ? '#ea580c' : priority === 'medium' ? '#d97706' : '#65a30d';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
        .report-box { background-color: white; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; }
        .priority { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; background-color: ${priorityColor}; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Potwierdzenie zgłoszenia</h1>
        </div>
        <div class="content">
          <p>Szczęść Boże ${userName}!</p>
          <p>Potwierdzamy otrzymanie Twojego zgłoszenia błędu.</p>
          <div class="report-box">
            <p><strong>Tytuł:</strong> ${reportTitle}</p>
            <p><strong>Priorytet:</strong> <span class="priority">${priorityLabels[priority] || priority}</span></p>
            <p><strong>Opis:</strong></p>
            <p>${reportDescription.replace(/\n/g, '<br>')}</p>
          </div>
          <p>Numer zgłoszenia: <strong>#${reportId.slice(0, 8)}</strong></p>
          <p style="margin-top: 20px;">
            Administrator zostanie powiadomiony o zgłoszeniu i skontaktuje się z Tobą w sprawie rozwiązania problemu.
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            Możesz odpowiedzieć na tę wiadomość, aby dodać dodatkowe informacje do zgłoszenia.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Szczęść Boże ${userName}!

Potwierdzamy otrzymanie Twojego zgłoszenia błędu.

Tytuł: ${reportTitle}
Priorytet: ${priorityLabels[priority] || priority}

Opis:
${reportDescription}

Numer zgłoszenia: #${reportId.slice(0, 8)}

Administrator zostanie powiadomiony o zgłoszeniu i skontaktuje się z Tobą w sprawie rozwiązania problemu.

Możesz odpowiedzieć na tę wiadomość, aby dodać dodatkowe informacje do zgłoszenia.
  `;

  const fromAddress = 'finanse@oblaci.pl';
  const replyToAddress = `finanse@oblaci.pl`;

  return sendEmail({
    to: recipientEmail,
    subject: `Potwierdzenie zgłoszenia: ${reportTitle}`,
    text,
    html,
    from: `System Finansowy OMI <${fromAddress}>`,
    replyTo: replyToAddress,
  });
};

/**
 * Wysyła email do administratorów o nowym zgłoszeniu błędu
 */
export const sendNewErrorReportEmailToAdmins = async (
  reportTitle: string,
  reportDescription: string,
  priority: string,
  reportId: string,
  reporterName: string,
  adminEmails: string[]
) => {
  const priorityLabels: Record<string, string> = {
    low: "Niski",
    medium: "Średni", 
    high: "Wysoki",
    critical: "Krytyczny",
  };

  const priorityColor = priority === 'critical' ? '#dc2626' : priority === 'high' ? '#ea580c' : priority === 'medium' ? '#d97706' : '#65a30d';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
        .report-box { background-color: white; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; }
        .priority { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; background-color: ${priorityColor}; color: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Nowe zgłoszenie błędu</h1>
        </div>
        <div class="content">
          <p>Użytkownik zgłosił nowy błąd w systemie:</p>
          <div class="report-box">
            <p><strong>Od:</strong> ${reporterName}</p>
            <p><strong>Tytuł:</strong> ${reportTitle}</p>
            <p><strong>Priorytet:</strong> <span class="priority">${priorityLabels[priority] || priority}</span></p>
            <p><strong>Opis:</strong></p>
            <p>${reportDescription.replace(/\n/g, '<br>')}</p>
          </div>
          <p>Numer zgłoszenia: <strong>#${reportId.slice(0, 8)}</strong></p>
          <p style="margin-top: 20px;">
            Zaloguj się do panelu administracyjnego, aby przejrzeć szczegóły i odpowiedzieć na zgłoszenie.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Nowe zgłoszenie błędu

Użytkownik zgłosił nowy błąd w systemie:

Od: ${reporterName}
Tytuł: ${reportTitle}
Priorytet: ${priorityLabels[priority] || priority}

Opis:
${reportDescription}

Numer zgłoszenia: #${reportId.slice(0, 8)}

Zaloguj się do panelu administracyjnego, aby przejrzeć szczegóły i odpowiedzieć na zgłoszenie.
  `;

  const fromAddress = 'finanse@oblaci.pl';

  // Send to all admin emails
  for (const email of adminEmails) {
    try {
      await sendEmail({
        to: email,
        subject: `Nowe zgłoszenie błędu: ${reportTitle}`,
        text,
        html,
        from: `System Finansowy OMI <${fromAddress}>`,
        replyTo: fromAddress,
      });
    } catch (error) {
      console.error(`Failed to send email to admin ${email}:`, error);
    }
  }
};

/**
 * Wysyła email z kodem weryfikacyjnym 2FA
 */
export const sendVerificationCodeEmail = async (
  recipientEmail: string,
  code: string,
  userName: string
) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
        .code { background-color: white; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; border: 2px dashed #4F46E5; border-radius: 5px; letter-spacing: 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Kod weryfikacyjny</h1>
        </div>
        <div class="content">
          <p>Szczęść Boże ${userName}!</p>
          <p>Twój kod weryfikacyjny do logowania:</p>
          <div class="code">${code}</div>
          <p>Kod jest ważny przez 10 minut.</p>
          <p>Jeśli nie próbowałeś się logować, zignoruj tę wiadomość.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Szczęść Boże ${userName}!

Twój kod weryfikacyjny do logowania:

${code}

Kod jest ważny przez 10 minut.
Jeśli nie próbowałeś się logować, zignoruj tę wiadomość.
  `;

  return sendEmail({
    to: recipientEmail,
    subject: 'Kod weryfikacyjny',
    text,
    html,
  });
};
