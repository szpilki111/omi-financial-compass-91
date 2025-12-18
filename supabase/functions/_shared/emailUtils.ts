import { buildEmailTemplate, APP_URL } from './emailTemplate.ts';

// Send status change notification
export const sendErrorReportUpdateEmail = async (
  to: string,
  reportTitle: string,
  reportId: string,
  previousStatus?: string,
  newStatus?: string,
) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const statusLabels: Record<string, string> = {
    new: "Nowe",
    in_progress: "W trakcie",
    resolved: "Rozwiązane",
    closed: "Zamknięte",
    needs_info: "Wymaga informacji",
  };

  const alertText = previousStatus && newStatus
    ? `Status zmieniony z "${statusLabels[previousStatus] || previousStatus}" na "${statusLabels[newStatus] || newStatus}"`
    : "Nastąpiła aktualizacja Twojego zgłoszenia.";

  const infoItems: { label: string; value: string }[] = [
    { label: 'Tytuł zgłoszenia', value: reportTitle },
  ];
  if (previousStatus) {
    infoItems.push({ label: 'Poprzedni status', value: statusLabels[previousStatus] || previousStatus });
  }
  if (newStatus) {
    infoItems.push({ label: 'Nowy status', value: statusLabels[newStatus] || newStatus });
  }

  const { html, text } = buildEmailTemplate({
    title: 'Zmiana statusu zgłoszenia',
    subtitle: 'System Finansowy OMI',
    content: '<p style="margin:0;">Nastąpiła aktualizacja Twojego zgłoszenia błędu w systemie.</p>',
    infoItems,
    alertBox: { text: alertText, color: 'blue' },
    color: 'blue',
  });

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        to,
        subject: "Zmiana statusu zgloszenia bledu",
        html,
        text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send update email:", error);
    }
  } catch (error) {
    console.error("Error sending update email:", error);
  }
};

export const sendErrorReportResponseEmail = async (
  to: string,
  reportTitle: string,
  responderName: string,
  message: string,
  reportId: string,
) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const { html, text } = buildEmailTemplate({
    title: 'Nowa odpowiedź w zgłoszeniu',
    subtitle: 'System Finansowy OMI',
    content: `<p style="margin:0 0 12px 0;">Otrzymałeś nową odpowiedź w zgłoszeniu błędu.</p><div style="background-color:#f1f5f9;padding:16px;border-radius:8px;margin:16px 0;"><p style="margin:0;font-style:italic;">"${message}"</p></div>`,
    infoItems: [
      { label: 'Tytuł zgłoszenia', value: reportTitle },
      { label: 'Odpowiedział', value: responderName },
    ],
    color: 'blue',
  });

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        to,
        subject: "Nowa odpowiedz w zgloszeniu bledu",
        html,
        text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send response email:", error);
    }
  } catch (error) {
    console.error("Error sending response email:", error);
  }
};
