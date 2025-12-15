import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReminderType = '5_days' | '1_day' | 'overdue';

const monthNames = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
];

function reminderTypeLabel(type: ReminderType) {
  if (type === 'overdue') return 'po terminie';
  if (type === '1_day') return '1 dzień';
  return '5 dni';
}

function buildEmail(
  params: {
    reminderType: ReminderType;
    daysUntilDeadline: number;
    deadlineDay: number;
    currentMonth: number;
    reportMonth: number;
    reportYear: number;
    locationName: string;
    economistName: string;
  },
) {
  const { reminderType, daysUntilDeadline, deadlineDay, currentMonth, reportMonth, reportYear, locationName, economistName } = params;

  const subject = reminderType === 'overdue'
    ? `⚠️ Termin złożenia raportu minął - ${locationName}`
    : `📋 Przypomnienie o raporcie - ${daysUntilDeadline} dni do terminu`;

  const urgencyColor = reminderType === 'overdue'
    ? '#dc2626'
    : reminderType === '1_day'
      ? '#f59e0b'
      : '#3b82f6';

  const urgencyText = reminderType === 'overdue'
    ? 'Termin złożenia raportu minął!'
    : `Do terminu pozostało ${daysUntilDeadline} dni`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 32px 40px; background: linear-gradient(135deg, ${urgencyColor}, ${urgencyColor}dd); border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                📋 System Finansowy OMI
              </h1>
              <p style="margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                Przypomnienie o raporcie miesięcznym
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 16px 0; color: #334155; font-size: 16px;">
                Dzień dobry, <strong>${economistName}</strong>!
              </p>
              <div style="background-color: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: ${urgencyColor}; font-weight: 600; font-size: 16px;">
                  ${urgencyText}
                </p>
              </div>
              <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px;">
                Raport miesięczny za <strong>${monthNames[reportMonth - 1]} ${reportYear}</strong> dla placówki <strong>${locationName}</strong> nie został jeszcze złożony.
              </p>
              <p style="margin: 0 0 24px 0; color: #334155; font-size: 15px;">
                Termin składania raportów upływa <strong>${deadlineDay} ${monthNames[currentMonth - 1]}</strong>.
              </p>
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="https://vzalrnwnpzbpzvcrjitt.lovable.app/raporty" 
                       style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${urgencyColor}, ${urgencyColor}dd); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Przejdź do raportów →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 13px; text-align: center;">
                Ta wiadomość została wygenerowana automatycznie przez System Finansowy OMI.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `System Finansowy OMI - przypomnienie o raporcie miesięcznym`,
    ``,
    `Dzień dobry, ${economistName}!`,
    `${urgencyText}`,
    ``,
    `Raport za ${monthNames[reportMonth - 1]} ${reportYear} dla placówki "${locationName}" nie został jeszcze złożony.`,
    `Termin: ${deadlineDay} ${monthNames[currentMonth - 1]}.`,
    ``,
    `Link: https://vzalrnwnpzbpzvcrjitt.lovable.app/raporty`,
  ].join('\n');

  return { subject, html, text };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional location_id (single reminder)
    let singleLocationId: string | null = null;
    let listOnly = false;
    try {
      const body = await req.json();
      singleLocationId = body?.location_id || null;
      listOnly = body?.list_only === true;
    } catch {
      // No body or invalid JSON - continue with batch mode
    }

    console.log('Starting report reminders check...');
    if (singleLocationId) console.log(`Single location mode: ${singleLocationId}`);
    if (listOnly) console.log('List only mode');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const deadlineDay = 10;

    const deadline = new Date(currentYear, currentMonth - 1, deadlineDay);
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Report month/year (previous month)
    let reportMonth = currentMonth - 1;
    let reportYear = currentYear;
    if (reportMonth === 0) {
      reportMonth = 12;
      reportYear = currentYear - 1;
    }

    console.log(`Current date: ${now.toISOString()}`);
    console.log(`Report period: ${reportMonth}/${reportYear}`);
    console.log(`Days until deadline: ${daysUntilDeadline}`);

    // For single location, always allow sending (admin override)
    const reminderType: ReminderType = daysUntilDeadline === 5 ? '5_days' : daysUntilDeadline === 1 ? '1_day' : 'overdue';
    console.log(`Reminder type: ${reminderType}`);

    // Get locations (single or all)
    let locationsQuery = supabase.from('locations').select('id, name');
    if (singleLocationId) {
      locationsQuery = locationsQuery.eq('id', singleLocationId);
    }
    const { data: locations, error: locationsError } = await locationsQuery;

    if (locationsError) throw locationsError;

    // Get reports for this period
    const { data: existingReports, error: reportsError } = await supabase
      .from('reports')
      .select('location_id, status')
      .eq('year', reportYear)
      .eq('month', reportMonth);

    if (reportsError) throw reportsError;

    const submittedLocationIds = new Set(
      (existingReports ?? [])
        .filter((r) => r.status === 'submitted' || r.status === 'approved')
        .map((r) => r.location_id),
    );

    const locationsNeedingReminder = (locations ?? []).filter((l) => !submittedLocationIds.has(l.id));
    console.log(`Locations needing reminder: ${locationsNeedingReminder.length}`);

    if (locationsNeedingReminder.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          sent: 0, 
          remaining: 0, 
          reminderType, 
          pendingLocations: [],
          message: singleLocationId 
            ? 'Ta placówka już złożyła raport.' 
            : 'Wszystkie raporty zostały złożone. Brak przypomnień do wysłania.' 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const locationIds = locationsNeedingReminder.map((l) => l.id);

    // Economists directly assigned via profiles.location_id
    const { data: directProfiles, error: directProfilesError } = await supabase
      .from('profiles')
      .select('id, email, name, location_id')
      .eq('role', 'ekonom')
      .in('location_id', locationIds);

    if (directProfilesError) throw directProfilesError;

    // Economists assigned via user_locations
    const { data: userLocations, error: userLocationsError } = await supabase
      .from('user_locations')
      .select('user_id, location_id')
      .in('location_id', locationIds);

    if (userLocationsError) throw userLocationsError;

    const ulUserIds = (userLocations ?? []).map((ul) => ul.user_id);
    const ulProfiles = ulUserIds.length
      ? await supabase
          .from('profiles')
          .select('id, email, name')
          .eq('role', 'ekonom')
          .in('id', ulUserIds)
      : { data: [], error: null };

    if (ulProfiles.error) throw ulProfiles.error;

    const economistsByLocation = new Map<string, { email: string; name: string }[]>();

    for (const p of directProfiles ?? []) {
      if (!p.location_id) continue;
      const list = economistsByLocation.get(p.location_id) ?? [];
      if (!list.some((x) => x.email === p.email)) list.push({ email: p.email, name: p.name });
      economistsByLocation.set(p.location_id, list);
    }

    const ulProfilesMap = new Map((ulProfiles.data ?? []).map((p: any) => [p.id, p]));

    for (const ul of userLocations ?? []) {
      const p = ulProfilesMap.get(ul.user_id);
      if (!p) continue;
      const list = economistsByLocation.get(ul.location_id) ?? [];
      if (!list.some((x) => x.email === p.email)) list.push({ email: p.email, name: p.name });
      economistsByLocation.set(ul.location_id, list);
    }

    // Previously sent reminders
    const { data: sentReminders, error: sentError } = await supabase
      .from('reminder_logs')
      .select('location_id, recipient_email')
      .eq('reminder_type', reminderType)
      .eq('month', reportMonth)
      .eq('year', reportYear);

    if (sentError) throw sentError;

    const sentSet = new Set((sentReminders ?? []).map((r) => `${r.location_id}-${r.recipient_email}`));

    const emailsToSend: { locationId: string; locationName: string; to: string; name: string }[] = [];

    for (const loc of locationsNeedingReminder) {
      const economists = economistsByLocation.get(loc.id) ?? [];
      for (const eco of economists) {
        const key = `${loc.id}-${eco.email}`;
        if (!sentSet.has(key)) {
          emailsToSend.push({ locationId: loc.id, locationName: loc.name, to: eco.email, name: eco.name });
        }
      }
    }

    console.log(`Emails to send: ${emailsToSend.length}`);

    // Build pending locations list for UI
    const pendingLocations = locationsNeedingReminder.map((loc) => {
      const economists = economistsByLocation.get(loc.id) ?? [];
      return {
        id: loc.id,
        name: loc.name,
        economists: economists.map((e) => ({ email: e.email, name: e.name })),
      };
    });

    // If list_only mode, just return the pending list without sending
    if (listOnly) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          remaining: emailsToSend.length,
          reminderType,
          pendingLocations,
          reportMonth,
          reportYear,
          message: `${locationsNeedingReminder.length} placówek wymaga przypomnienia.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    if (emailsToSend.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          remaining: 0,
          reminderType,
          pendingLocations: [],
          message: singleLocationId
            ? 'Przypomnienie dla tej placówki zostało już wysłane.'
            : `Wszystkie przypomnienia (${reminderTypeLabel(reminderType)}) zostały już wysłane dla okresu ${reportMonth}/${reportYear}.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    // Send max N per run (or all for single location)
    const maxEmailsPerRun = singleLocationId ? emailsToSend.length : 5;
    const batch = emailsToSend.slice(0, maxEmailsPerRun);

    let sent = 0;
    const errors: string[] = [];

    for (const item of batch) {
      try {
        const { subject, html, text } = buildEmail({
          reminderType,
          daysUntilDeadline,
          deadlineDay,
          currentMonth,
          reportMonth,
          reportYear,
          locationName: item.locationName,
          economistName: item.name,
        });

        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            to: item.to,
            from: 'System Finansowy OMI <finanse@oblaci.pl>',
            subject,
            text,
            html,
            replyTo: 'finanse@oblaci.pl',
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        // some implementations return { error } in data
        if ((data as any)?.error) {
          throw new Error((data as any).error);
        }

        await supabase.from('reminder_logs').insert({
          location_id: item.locationId,
          reminder_type: reminderType,
          recipient_email: item.to,
          month: reportMonth,
          year: reportYear,
        });

        sent++;
      } catch (e: any) {
        const msg = e?.message || String(e);
        console.error(`Failed to send email to ${item.to}: ${msg}`);
        errors.push(`${item.to}: ${msg}`);
      }
    }

    const remaining = emailsToSend.length - sent;

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        remaining,
        reminderType,
        errors: errors.length ? errors : undefined,
        message: remaining > 0
          ? `Wysłano ${sent} przypomnień. Pozostało ${remaining} do wysłania - kliknij ponownie.`
          : `Wysłano ${sent} przypomnień.`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  } catch (error: any) {
    console.error('Error in send-report-reminders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    );
  }
});
