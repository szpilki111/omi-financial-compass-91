import { supabase } from '@/integrations/supabase/client';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
}

const APP_URL = 'https://vzalrnwnpzbpzvcrjitt.lovable.app';

// Convert Polish characters to ASCII for email subjects to avoid encoding issues
function toAscii(str: string): string {
  const polishMap: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
    'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  };
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polishMap[char] || char);
}

// Build HTML without extra whitespace to avoid =20 encoding issues
function buildEmailHtml(params: {
  title: string;
  subtitle?: string;
  greeting?: string;
  content: string;
  alertBox?: { text: string; color: string };
  infoItems?: { label: string; value: string }[];
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
  primaryColor?: string;
}): string {
  const {
    title,
    subtitle,
    greeting,
    content,
    alertBox,
    infoItems,
    buttonText,
    buttonUrl,
    footerText = 'Ta wiadomość została wygenerowana automatycznie przez System Finansowy OMI.',
    primaryColor = '#3b82f6',
  } = params;

  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>';
  html += '<body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f8fafc;">';
  html += '<table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;">';
  html += '<table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">';
  
  html += `<tr><td style="padding:32px 40px;background:linear-gradient(135deg,${primaryColor},${primaryColor}dd);border-radius:12px 12px 0 0;">`;
  html += `<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">${title}</h1>`;
  if (subtitle) {
    html += `<p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${subtitle}</p>`;
  }
  html += '</td></tr>';
  
  html += '<tr><td style="padding:32px 40px;">';
  
  if (greeting) {
    html += `<p style="margin:0 0 16px 0;color:#334155;font-size:16px;">${greeting}</p>`;
  }
  
  if (alertBox) {
    html += `<div style="background-color:${alertBox.color}15;border-left:4px solid ${alertBox.color};padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">`;
    html += `<p style="margin:0;color:${alertBox.color};font-weight:600;font-size:16px;">${alertBox.text}</p></div>`;
  }
  
  html += `<div style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">${content}</div>`;
  
  if (infoItems && infoItems.length > 0) {
    html += `<div style="background-color:#f8fafc;border-left:4px solid ${primaryColor};padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">`;
    for (const item of infoItems) {
      html += `<p style="margin:0 0 8px 0;color:#334155;font-size:15px;"><strong>${item.label}:</strong> ${item.value}</p>`;
    }
    html += '</div>';
  }
  
  if (buttonText && buttonUrl) {
    html += '<table role="presentation" style="width:100%;margin-top:24px;"><tr><td align="center">';
    html += `<a href="${buttonUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,${primaryColor},${primaryColor}dd);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${buttonText}</a>`;
    html += '</td></tr></table>';
  }
  
  html += '</td></tr>';
  
  html += '<tr><td style="padding:24px 40px;background-color:#f8fafc;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">';
  html += `<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">${footerText}</p>`;
  html += '<p style="margin:8px 0 0 0;color:#94a3b8;font-size:12px;text-align:center;">System Finansowy OMI</p>';
  html += '</td></tr>';
  
  html += '</table></td></tr></table></body></html>';

  return html;
}

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

export const sendErrorReportResponseEmail = async (
  recipientEmail: string,
  reportTitle: string,
  responderName: string,
  responseMessage: string,
  reportId: string
) => {
  const html = buildEmailHtml({
    title: 'Nowa odpowiedź w zgłoszeniu',
    subtitle: 'System Finansowy OMI',
    greeting: 'Szczęść Boże!',
    content: `<p style="margin:0 0 12px 0;">Otrzymałeś nową odpowiedź w zgłoszeniu błędu.</p><div style="background-color:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:0;font-style:italic;">"${responseMessage.replace(/\n/g, '<br>')}"</p></div><p style="margin:0;">Możesz odpowiedzieć na tę wiadomość, aby dodać swoją odpowiedź do zgłoszenia.</p>`,
    infoItems: [
      { label: 'Tytuł zgłoszenia', value: reportTitle },
      { label: 'Odpowiedział', value: responderName },
    ],
    buttonText: 'Zobacz szczegóły',
    buttonUrl: `${APP_URL}/administracja`,
    primaryColor: '#4F46E5',
  });

  const text = `Nowa odpowiedź w zgłoszeniu\n\nTytuł zgłoszenia: ${reportTitle}\nOdpowiedział: ${responderName}\n\nWiadomość:\n${responseMessage}\n\nMożesz odpowiedzieć na tę wiadomość, aby dodać swoją odpowiedź do zgłoszenia.`;

  return sendEmail({
    to: recipientEmail,
    subject: `Nowa odpowiedz w zgloszeniu: ${toAscii(reportTitle)}`,
    text,
    html,
    from: `System Finansowy OMI <finanse@oblaci.pl>`,
    replyTo: 'finanse@oblaci.pl',
  });
};

export const sendErrorReportConfirmationEmail = async (
  recipientEmail: string,
  userName: string,
  reportTitle: string,
  reportDescription: string,
  priority: string,
  reportId: string
) => {
  const priorityLabels: Record<string, string> = {
    low: "Niski", medium: "Średni", high: "Wysoki", critical: "Krytyczny",
  };

  const html = buildEmailHtml({
    title: 'Potwierdzenie zgłoszenia',
    subtitle: 'System Finansowy OMI',
    greeting: `Szczęść Boże ${userName}!`,
    content: `<p style="margin:0 0 12px 0;">Potwierdzamy otrzymanie Twojego zgłoszenia błędu.</p><p style="margin:0 0 8px 0;"><strong>Opis:</strong></p><p style="margin:0 0 16px 0;">${reportDescription.replace(/\n/g, '<br>')}</p><p style="margin:0;">Administrator zostanie powiadomiony o zgłoszeniu i skontaktuje się z Tobą w sprawie rozwiązania problemu.</p>`,
    infoItems: [
      { label: 'Tytuł', value: reportTitle },
      { label: 'Priorytet', value: priorityLabels[priority] || priority },
      { label: 'Numer zgłoszenia', value: `#${reportId.slice(0, 8)}` },
    ],
    buttonText: 'Zobacz szczegóły',
    buttonUrl: `${APP_URL}/administracja`,
    primaryColor: '#10B981',
  });

  const text = `Szczęść Boże ${userName}!\n\nPotwierdzamy otrzymanie Twojego zgłoszenia błędu.\n\nTytuł: ${reportTitle}\nPriorytet: ${priorityLabels[priority] || priority}\nOpis: ${reportDescription}\nNumer zgłoszenia: #${reportId.slice(0, 8)}\n\nAdministrator zostanie powiadomiony o zgłoszeniu.`;

  return sendEmail({
    to: recipientEmail,
    subject: `Potwierdzenie zgloszenia: ${toAscii(reportTitle)}`,
    text,
    html,
    from: `System Finansowy OMI <finanse@oblaci.pl>`,
    replyTo: 'finanse@oblaci.pl',
  });
};

export const sendNewErrorReportEmailToAdmins = async (
  reportTitle: string,
  reportDescription: string,
  priority: string,
  reportId: string,
  reporterName: string,
  adminEmails: string[]
) => {
  const priorityLabels: Record<string, string> = {
    low: "Niski", medium: "Średni", high: "Wysoki", critical: "Krytyczny",
  };

  const alertBox = (priority === 'critical' || priority === 'high') 
    ? { text: `Priorytet: ${priorityLabels[priority]}`, color: priority === 'critical' ? '#dc2626' : '#ea580c' }
    : undefined;

  const html = buildEmailHtml({
    title: 'Nowe zgłoszenie błędu',
    subtitle: 'System Finansowy OMI',
    content: `<p style="margin:0 0 12px 0;">Użytkownik zgłosił nowy błąd w systemie.</p><p style="margin:0 0 8px 0;"><strong>Opis:</strong></p><p style="margin:0 0 16px 0;">${reportDescription.replace(/\n/g, '<br>')}</p><p style="margin:0;">Zaloguj się do panelu administracyjnego, aby przejrzeć szczegóły i odpowiedzieć na zgłoszenie.</p>`,
    infoItems: [
      { label: 'Od', value: reporterName },
      { label: 'Tytuł', value: reportTitle },
      { label: 'Priorytet', value: priorityLabels[priority] || priority },
      { label: 'Numer zgłoszenia', value: `#${reportId.slice(0, 8)}` },
    ],
    alertBox,
    buttonText: 'Zobacz szczegóły',
    buttonUrl: `${APP_URL}/administracja`,
    primaryColor: '#EF4444',
  });

  const text = `Nowe zgłoszenie błędu\n\nOd: ${reporterName}\nTytuł: ${reportTitle}\nPriorytet: ${priorityLabels[priority] || priority}\nOpis: ${reportDescription}\nNumer zgłoszenia: #${reportId.slice(0, 8)}\n\nZaloguj się do panelu administracyjnego.`;

  for (const email of adminEmails) {
    try {
      await sendEmail({
        to: email,
        subject: `Nowe zgloszenie bledu: ${toAscii(reportTitle)}`,
        text,
        html,
        from: `System Finansowy OMI <finanse@oblaci.pl>`,
        replyTo: 'finanse@oblaci.pl',
      });
    } catch (error) {
      console.error(`Failed to send email to admin ${email}:`, error);
    }
  }
};

export const sendVerificationCodeEmail = async (
  recipientEmail: string,
  code: string,
  userName: string
) => {
  const html = buildEmailHtml({
    title: 'Kod weryfikacyjny',
    subtitle: 'System Finansowy OMI',
    greeting: `Szczęść Boże ${userName}!`,
    content: `<p style="margin:0 0 12px 0;">Twój kod weryfikacyjny do logowania:</p><div style="background-color:#fef9e7;border:2px solid #E6B325;border-radius:12px;padding:24px;text-align:center;margin:24px 0;"><p style="margin:0;font-size:36px;font-weight:bold;letter-spacing:8px;color:#E6B325;">${code}</p></div><p style="margin:0 0 8px 0;">Kod jest ważny przez 10 minut.</p><p style="margin:0;">Jeśli nie próbowałeś się logować, zignoruj tę wiadomość.</p>`,
    primaryColor: '#E6B325',
  });

  const text = `Szczęść Boże ${userName}!\n\nTwój kod weryfikacyjny do logowania:\n\n${code}\n\nKod jest ważny przez 10 minut.\nJeśli nie próbowałeś się logować, zignoruj tę wiadomość.`;

  return sendEmail({
    to: recipientEmail,
    subject: 'Kod weryfikacyjny - System Finansowy OMI',
    text,
    html,
  });
};
