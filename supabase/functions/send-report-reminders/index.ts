import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildEmailTemplate, APP_URL, toAscii } from '../_shared/emailTemplate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ReminderType = '5_days' | '1_day' | 'overdue';

const monthNames = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];

function reminderTypeLabel(type: ReminderType) {
  if (type === 'overdue') return 'po terminie';
  if (type === '1_day') return '1 dzień';
  return '5 dni';
}

function buildEmail(params: {
  reminderType: ReminderType;
  daysUntilDeadline: number;
  deadlineDay: number;
  currentMonth: number;
  reportMonth: number;
  reportYear: number;
  locationName: string;
  economistName: string;
}) {
  const { reminderType, daysUntilDeadline, deadlineDay, currentMonth, reportMonth, reportYear, locationName, economistName } = params;

  // Use toAscii for subject to avoid encoding issues with Polish characters
  const subject = reminderType === 'overdue'
    ? `Termin zlozenia raportu minal - ${toAscii(locationName)}`
    : `Przypomnienie o raporcie - ${daysUntilDeadline} dni do terminu`;

  const color = reminderType === 'overdue' ? 'red' : reminderType === '1_day' ? 'orange' : 'blue';
  const urgencyText = reminderType === 'overdue'
    ? 'Termin złożenia raportu minął!'
    : `Do terminu pozostało ${daysUntilDeadline} dni`;

  const { html, text } = buildEmailTemplate({
    title: 'System Finansowy OMI',
    subtitle: 'Przypomnienie o raporcie miesięcznym',
    greeting: `Dzień dobry, <strong>${economistName}</strong>!`,
    content: `<p style="margin:0 0 12px 0;">Raport miesięczny za <strong>${monthNames[reportMonth - 1]} ${reportYear}</strong> dla placówki <strong>${locationName}</strong> nie został jeszcze złożony.</p><p style="margin:0;">Termin składania raportów upływa <strong>${deadlineDay} ${monthNames[currentMonth - 1]}</strong>.</p>`,
    alertBox: { text: urgencyText, color: color as any },
    buttonText: 'Przejdź do raportów',
    buttonUrl: `${APP_URL}/raporty`,
    color: color as any,
  });

  return { subject, html, text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let singleLocationId: string | null = null;
    let listOnly = false;
    let forceSend = false;
    try {
      const body = await req.json();
      singleLocationId = body?.location_id || null;
      listOnly = body?.list_only === true;
      forceSend = body?.force_send === true;
    } catch {
      // No body or invalid JSON - continue with batch mode
    }

    console.log('Starting report reminders check...');
    if (singleLocationId) console.log(`Single location mode: ${singleLocationId}`);
    if (listOnly) console.log('List only mode');
    if (forceSend) console.log('Force send mode - skipping sent check');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const deadlineDay = 10;

    const deadline = new Date(currentYear, currentMonth - 1, deadlineDay);
    const daysUntilDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let reportMonth = currentMonth - 1;
    let reportYear = currentYear;
    if (reportMonth === 0) {
      reportMonth = 12;
      reportYear = currentYear - 1;
    }

    console.log(`Current date: ${now.toISOString()}`);
    console.log(`Report period: ${reportMonth}/${reportYear}`);
    console.log(`Days until deadline: ${daysUntilDeadline}`);

    const reminderType: ReminderType = daysUntilDeadline === 5 ? '5_days' : daysUntilDeadline === 1 ? '1_day' : 'overdue';
    console.log(`Reminder type: ${reminderType}`);

    let locationsQuery = supabase.from('locations').select('id, name');
    if (singleLocationId) {
      locationsQuery = locationsQuery.eq('id', singleLocationId);
    }
    const { data: locations, error: locationsError } = await locationsQuery;
    if (locationsError) throw locationsError;

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
          success: true, sent: 0, remaining: 0, reminderType, pendingLocations: [],
          message: singleLocationId ? 'Ta placówka już złożyła raport.' : 'Wszystkie raporty zostały złożone.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const locationIds = locationsNeedingReminder.map((l) => l.id);

    const { data: directProfiles, error: directProfilesError } = await supabase
      .from('profiles')
      .select('id, email, name, location_id')
      .eq('role', 'ekonom')
      .in('location_id', locationIds);
    if (directProfilesError) throw directProfilesError;

    const { data: userLocations, error: userLocationsError } = await supabase
      .from('user_locations')
      .select('user_id, location_id')
      .in('location_id', locationIds);
    if (userLocationsError) throw userLocationsError;

    const ulUserIds = (userLocations ?? []).map((ul) => ul.user_id);
    const ulProfiles = ulUserIds.length
      ? await supabase.from('profiles').select('id, email, name').eq('role', 'ekonom').in('id', ulUserIds)
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
        if (forceSend || !sentSet.has(key)) {
          emailsToSend.push({ locationId: loc.id, locationName: loc.name, to: eco.email, name: eco.name });
        }
      }
    }

    console.log(`Emails to send: ${emailsToSend.length}`);

    const pendingLocations = locationsNeedingReminder.map((loc) => {
      const economists = economistsByLocation.get(loc.id) ?? [];
      return { id: loc.id, name: loc.name, economists: economists.map((e) => ({ email: e.email, name: e.name })) };
    });

    if (listOnly) {
      return new Response(
        JSON.stringify({
          success: true, sent: 0, remaining: emailsToSend.length, reminderType, pendingLocations,
          reportMonth, reportYear, message: `${locationsNeedingReminder.length} placówek wymaga przypomnienia.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    if (emailsToSend.length === 0) {
      return new Response(
        JSON.stringify({
          success: true, sent: 0, remaining: 0, reminderType, pendingLocations: [],
          message: singleLocationId
            ? 'Przypomnienie dla tej placówki zostało już wysłane.'
            : `Wszystkie przypomnienia (${reminderTypeLabel(reminderType)}) zostały już wysłane.`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      );
    }

    const maxEmailsPerRun = singleLocationId ? emailsToSend.length : 5;
    const batch = emailsToSend.slice(0, maxEmailsPerRun);

    let sent = 0;
    const errors: string[] = [];

    for (const item of batch) {
      try {
        const { subject, html, text } = buildEmail({
          reminderType, daysUntilDeadline, deadlineDay, currentMonth, reportMonth, reportYear,
          locationName: item.locationName, economistName: item.name,
        });

        const { data, error } = await supabase.functions.invoke('send-email', {
          body: { to: item.to, from: 'System Finansowy OMI <finanse@oblaci.pl>', subject, text, html, replyTo: 'finanse@oblaci.pl' },
        });

        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);

        await supabase.from('reminder_logs').insert({
          location_id: item.locationId, reminder_type: reminderType, recipient_email: item.to, month: reportMonth, year: reportYear,
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
        success: true, sent, remaining, reminderType, errors: errors.length ? errors : undefined,
        message: remaining > 0 ? `Wysłano ${sent} przypomnień. Pozostało ${remaining}.` : `Wysłano ${sent} przypomnień.`,
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
