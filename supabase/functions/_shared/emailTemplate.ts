// Shared professional email template for System Finansowy OMI
// All emails should use this template for consistent branding

// Convert Polish characters to ASCII for email subjects to avoid encoding issues
export function toAscii(str: string): string {
  const polishMap: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n',
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N',
    'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  };
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => polishMap[char] || char);
}

export type EmailColor = 'blue' | 'green' | 'red' | 'orange' | 'gold';

interface EmailTemplateParams {
  title: string;
  subtitle?: string;
  greeting?: string;
  content: string;
  alertBox?: {
    text: string;
    color: EmailColor;
  };
  infoItems?: { label: string; value: string }[];
  buttonText?: string;
  buttonUrl?: string;
  footerText?: string;
  color?: EmailColor;
}

const colorMap: Record<EmailColor, { primary: string; light: string; gradient: string }> = {
  blue: { primary: '#3b82f6', light: '#dbeafe', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
  green: { primary: '#10b981', light: '#d1fae5', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
  red: { primary: '#ef4444', light: '#fee2e2', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
  orange: { primary: '#f59e0b', light: '#fef3c7', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
  gold: { primary: '#E6B325', light: '#fef9e7', gradient: 'linear-gradient(135deg, #E6B325, #D4A017)' },
};

const APP_URL = 'https://vzalrnwnpzbpzvcrjitt.lovable.app';

export function buildEmailTemplate(params: EmailTemplateParams): { html: string; text: string } {
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
    color = 'blue',
  } = params;

  const colors = colorMap[color];
  const alertColors = alertBox ? colorMap[alertBox.color] : null;

  // Build HTML without extra whitespace to avoid =20 encoding issues
  let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>';
  html += '<body style="margin:0;padding:0;font-family:Segoe UI,Tahoma,Geneva,Verdana,sans-serif;background-color:#f8fafc;">';
  html += '<table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:40px 20px;">';
  html += '<table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">';
  
  // Header
  html += `<tr><td style="padding:32px 40px;background:${colors.gradient};border-radius:12px 12px 0 0;">`;
  html += `<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">${title}</h1>`;
  if (subtitle) {
    html += `<p style="margin:8px 0 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${subtitle}</p>`;
  }
  html += '</td></tr>';
  
  // Content
  html += '<tr><td style="padding:32px 40px;">';
  
  if (greeting) {
    html += `<p style="margin:0 0 16px 0;color:#334155;font-size:16px;">${greeting}</p>`;
  }
  
  if (alertBox && alertColors) {
    html += `<div style="background-color:${alertColors.light};border-left:4px solid ${alertColors.primary};padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">`;
    html += `<p style="margin:0;color:${alertColors.primary};font-weight:600;font-size:16px;">${alertBox.text}</p></div>`;
  }
  
  html += `<div style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">${content}</div>`;
  
  if (infoItems && infoItems.length > 0) {
    html += `<div style="background-color:#f8fafc;border-left:4px solid ${colors.primary};padding:16px 20px;margin:24px 0;border-radius:0 8px 8px 0;">`;
    for (const item of infoItems) {
      html += `<p style="margin:0 0 8px 0;color:#334155;font-size:15px;"><strong>${item.label}:</strong> ${item.value}</p>`;
    }
    html += '</div>';
  }
  
  if (buttonText && buttonUrl) {
    html += '<table role="presentation" style="width:100%;margin-top:24px;"><tr><td align="center">';
    html += `<a href="${buttonUrl}" style="display:inline-block;padding:14px 32px;background:${colors.gradient};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${buttonText}</a>`;
    html += '</td></tr></table>';
  }
  
  html += '</td></tr>';
  
  // Footer
  html += '<tr><td style="padding:24px 40px;background-color:#f8fafc;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">';
  html += `<p style="margin:0;color:#64748b;font-size:13px;text-align:center;">${footerText}</p>`;
  html += '<p style="margin:8px 0 0 0;color:#94a3b8;font-size:12px;text-align:center;">System Finansowy OMI</p>';
  html += '</td></tr>';
  
  html += '</table></td></tr></table></body></html>';

  // Build plain text version
  const textParts: string[] = [];
  textParts.push(title);
  if (subtitle) textParts.push(subtitle);
  textParts.push('');
  if (greeting) textParts.push(greeting.replace(/<[^>]*>/g, ''));
  if (alertBox) {
    textParts.push('');
    textParts.push(alertBox.text);
  }
  textParts.push('');
  textParts.push(content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''));
  if (infoItems && infoItems.length > 0) {
    textParts.push('');
    for (const item of infoItems) {
      textParts.push(`${item.label}: ${item.value}`);
    }
  }
  if (buttonText && buttonUrl) {
    textParts.push('');
    textParts.push(`${buttonText}: ${buttonUrl}`);
  }
  textParts.push('');
  textParts.push('---');
  textParts.push(footerText);
  textParts.push('System Finansowy OMI');

  const text = textParts.join('\n');

  return { html, text };
}

export { APP_URL };
