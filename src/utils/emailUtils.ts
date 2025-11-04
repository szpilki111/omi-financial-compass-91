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
 * Wysyła email powiadomienia o zmianie statusu raportu
 */
export const sendReportStatusEmail = async (
  recipientEmail: string,
  reportTitle: string,
  status: string,
  reviewerName: string,
  comments?: string
) => {
  const statusText = {
    'approved': 'zaakceptowany',
    'to_be_corrected': 'odrzucony do poprawy',
    'submitted': 'złożony',
  }[status] || status;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #d97706;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 0 0 5px 5px;
          }
          .status {
            font-weight: bold;
            font-size: 18px;
            color: ${status === 'approved' ? '#059669' : '#dc2626'};
          }
          .comments {
            background-color: #fff;
            padding: 15px;
            margin-top: 15px;
            border-left: 4px solid #d97706;
            border-radius: 3px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Finansowy OMI</h1>
          </div>
          <div class="content">
            <h2>Szczęść Boże!</h2>
            <p>Informujemy o zmianie statusu raportu:</p>
            
            <p><strong>Raport:</strong> ${reportTitle}</p>
            <p><strong>Status:</strong> <span class="status">${statusText}</span></p>
            <p><strong>Sprawdził:</strong> ${reviewerName}</p>
            
            ${comments ? `
              <div class="comments">
                <strong>Uwagi prowincjała:</strong>
                <p>${comments}</p>
              </div>
            ` : ''}
            
            <p style="margin-top: 20px;">
              Zaloguj się do systemu, aby zobaczyć szczegóły raportu.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} System Finansowy OMI</p>
            <p>Misjonarze Oblaci Maryi Niepokalanej</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Szczęść Boże!

Informujemy o zmianie statusu raportu:

Raport: ${reportTitle}
Status: ${statusText}
Sprawdził: ${reviewerName}

${comments ? `Uwagi prowincjała:\n${comments}` : ''}

Zaloguj się do systemu, aby zobaczyć szczegóły raportu.

---
© ${new Date().getFullYear()} System Finansowy OMI
Misjonarze Oblaci Maryi Niepokalanej
  `;

  return sendEmail({
    to: recipientEmail,
    subject: `System Finansowy OMI - Raport ${statusText}`,
    text,
    html,
  });
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
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #d97706;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 0 0 5px 5px;
          }
          .response {
            background-color: #fff;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #d97706;
            border-radius: 3px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            margin: 15px 0;
            background-color: #d97706;
            color: white;
            text-decoration: none;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Finansowy OMI</h1>
          </div>
          <div class="content">
            <h2>Szczęść Boże!</h2>
            <p>Otrzymałeś nową odpowiedź na zgłoszenie błędu:</p>
            
            <p><strong>Zgłoszenie:</strong> ${reportTitle}</p>
            <p><strong>Odpowiedź od:</strong> ${responderName}</p>
            
            <div class="response">
              <strong>Treść odpowiedzi:</strong>
              <p>${responseMessage}</p>
            </div>
            
            <p style="margin-top: 20px;">
              Możesz odpowiedzieć na tę wiadomość, aby dodać swoją odpowiedź do zgłoszenia.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} System Finansowy OMI</p>
            <p>Misjonarze Oblaci Maryi Niepokalanej</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
Szczęść Boże!

Otrzymałeś nową odpowiedź na zgłoszenie błędu:

Zgłoszenie: ${reportTitle}
Odpowiedź od: ${responderName}

Treść odpowiedzi:
${responseMessage}

Możesz odpowiedzieć na tę wiadomość, aby dodać swoją odpowiedź do zgłoszenia.

---
© ${new Date().getFullYear()} System Finansowy OMI
Misjonarze Oblaci Maryi Niepokalanej
  `;

  const fromAddress = 'finanse@oblaci.pl'; // Must match SMTP_USER
  const replyToAddress = `finanse@oblaci.pl`; // Keep replies to same address

  return sendEmail({
    to: recipientEmail,
    subject: `System Finansowy OMI - Nowa odpowiedź: ${reportTitle} [#${reportId}]`,
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

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #d97706;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 0 0 5px 5px;
          }
          .report-box {
            background-color: #fff;
            padding: 15px;
            margin: 15px 0;
            border-left: 4px solid #d97706;
            border-radius: 3px;
          }
          .priority {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: bold;
            background-color: ${priority === 'critical' ? '#dc2626' : priority === 'high' ? '#ea580c' : priority === 'medium' ? '#d97706' : '#65a30d'};
            color: white;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Finansowy OMI</h1>
          </div>
          <div class="content">
            <h2>Szczęść Boże ${userName}!</h2>
            <p>Potwierdzamy otrzymanie Twojego zgłoszenia błędu.</p>
            
            <div class="report-box">
              <p><strong>Tytuł:</strong> ${reportTitle}</p>
              <p><strong>Priorytet:</strong> <span class="priority">${priorityLabels[priority] || priority}</span></p>
              <p><strong>Opis:</strong></p>
              <p>${reportDescription}</p>
            </div>
            
            <p>Numer zgłoszenia: <strong>#${reportId.slice(0, 8)}</strong></p>
            
            <p style="margin-top: 20px;">
              Administrator zostanie powiadomiony o zgłoszeniu i skontaktuje się z Tobą w sprawie rozwiązania problemu.
            </p>
            
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              Możesz odpowiedzieć na tę wiadomość, aby dodać dodatkowe informacje do zgłoszenia.
            </p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} System Finansowy OMI</p>
            <p>Misjonarze Oblaci Maryi Niepokalanej</p>
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

---
© ${new Date().getFullYear()} System Finansowy OMI
Misjonarze Oblaci Maryi Niepokalanej
  `;

  const fromAddress = 'finanse@oblaci.pl'; // Must match SMTP_USER
  const replyToAddress = `finanse@oblaci.pl`;

  return sendEmail({
    to: recipientEmail,
    subject: `System Finansowy OMI - Potwierdzenie zgłoszenia: ${reportTitle} [#${reportId}]`,
    text,
    html,
    from: `System Finansowy OMI <${fromAddress}>`,
    replyTo: replyToAddress,
  });
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
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #d97706;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 0 0 5px 5px;
          }
          .code {
            background-color: #fff;
            font-size: 32px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            margin: 20px 0;
            border: 2px dashed #d97706;
            border-radius: 5px;
            letter-spacing: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Finansowy OMI</h1>
          </div>
          <div class="content">
            <h2>Szczęść Boże ${userName}!</h2>
            <p>Twój kod weryfikacyjny do logowania:</p>
            
            <div class="code">${code}</div>
            
            <p>Kod jest ważny przez 10 minut.</p>
            <p>Jeśli nie próbowałeś się logować, zignoruj tę wiadomość.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} System Finansowy OMI</p>
            <p>Misjonarze Oblaci Maryi Niepokalanej</p>
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

---
© ${new Date().getFullYear()} System Finansowy OMI
Misjonarze Oblaci Maryi Niepokalanej
  `;

  return sendEmail({
    to: recipientEmail,
    subject: 'System Finansowy OMI - Kod weryfikacyjny',
    text,
    html,
  });
};
