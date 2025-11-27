import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocationWithEconomist {
  id: string;
  name: string;
  economists: { email: string; name: string }[];
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

    console.log('Starting report reminders check...');

    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // Report deadline is 10th of each month for previous month
    const deadlineDay = 10;
    
    // Calculate days until deadline
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

    // Only send reminders at 5 days, 1 day before deadline, or if overdue
    const shouldSendReminder = daysUntilDeadline === 5 || daysUntilDeadline === 1 || daysUntilDeadline < 0;
    
    if (!shouldSendReminder) {
      console.log('No reminders needed today');
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders needed today', daysUntilDeadline }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const reminderType = daysUntilDeadline === 5 ? '5_days' : daysUntilDeadline === 1 ? '1_day' : 'overdue';
    console.log(`Reminder type: ${reminderType}`);

    // Get all locations
    const { data: locations, error: locationsError } = await supabase
      .from('locations')
      .select('id, name');

    if (locationsError) {
      console.error('Error fetching locations:', locationsError);
      throw locationsError;
    }

    // Get reports for this period
    const { data: existingReports, error: reportsError } = await supabase
      .from('reports')
      .select('location_id, status')
      .eq('year', reportYear)
      .eq('month', reportMonth);

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      throw reportsError;
    }

    // Find locations without submitted/approved reports
    const submittedLocationIds = new Set(
      existingReports
        ?.filter(r => r.status === 'submitted' || r.status === 'approved')
        .map(r => r.location_id) || []
    );

    const locationsNeedingReminder = locations?.filter(l => !submittedLocationIds.has(l.id)) || [];
    console.log(`Locations needing reminder: ${locationsNeedingReminder.length}`);

    if (locationsNeedingReminder.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'All reports submitted', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Get economists for each location
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, name, location_id, role')
      .eq('role', 'ekonom')
      .in('location_id', locationsNeedingReminder.map(l => l.id));

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Check which reminders were already sent
    const { data: sentReminders, error: sentError } = await supabase
      .from('reminder_logs')
      .select('location_id, recipient_email')
      .eq('reminder_type', reminderType)
      .eq('month', reportMonth)
      .eq('year', reportYear);

    if (sentError) {
      console.error('Error fetching sent reminders:', sentError);
    }

    const sentSet = new Set(
      sentReminders?.map(r => `${r.location_id}-${r.recipient_email}`) || []
    );

    // Get SMTP configuration
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpPort = Deno.env.get('SMTP_PORT');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      console.error('Missing SMTP configuration');
      throw new Error('SMTP configuration is incomplete');
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: parseInt(smtpPort),
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    let sentCount = 0;
    const errors: string[] = [];

    // Send reminders
    for (const location of locationsNeedingReminder) {
      const locationEconomists = profiles?.filter(p => p.location_id === location.id) || [];
      
      for (const economist of locationEconomists) {
        const key = `${location.id}-${economist.email}`;
        if (sentSet.has(key)) {
          console.log(`Reminder already sent to ${economist.email} for ${location.name}`);
          continue;
        }

        const monthNames = [
          'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
          'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'
        ];

        const subject = reminderType === 'overdue'
          ? `⚠️ Termin złożenia raportu minął - ${location.name}`
          : `📋 Przypomnienie o raporcie - ${daysUntilDeadline} dni do terminu`;

        const urgencyColor = reminderType === 'overdue' ? '#dc2626' : 
                            reminderType === '1_day' ? '#f59e0b' : '#3b82f6';
        
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
          <!-- Header -->
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
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px 40px;">
              <p style="margin: 0 0 16px 0; color: #334155; font-size: 16px;">
                Dzień dobry, <strong>${economist.name}</strong>!
              </p>
              
              <div style="background-color: ${urgencyColor}15; border-left: 4px solid ${urgencyColor}; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: ${urgencyColor}; font-weight: 600; font-size: 16px;">
                  ${urgencyText}
                </p>
              </div>
              
              <p style="margin: 0 0 16px 0; color: #334155; font-size: 15px;">
                Raport miesięczny za <strong>${monthNames[reportMonth - 1]} ${reportYear}</strong> dla placówki <strong>${location.name}</strong> nie został jeszcze złożony.
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
          
          <!-- Footer -->
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

        try {
          await client.send({
            from: 'System Finansowy OMI <finanse@oblaci.pl>',
            to: economist.email,
            subject: subject,
            html: html,
            charset: 'UTF-8',
            encoding: '8bit',
          });

          // Log the reminder
          await supabase.from('reminder_logs').insert({
            location_id: location.id,
            reminder_type: reminderType,
            recipient_email: economist.email,
            month: reportMonth,
            year: reportYear,
          });

          sentCount++;
          console.log(`Reminder sent to ${economist.email} for ${location.name}`);
        } catch (emailError: any) {
          console.error(`Failed to send email to ${economist.email}:`, emailError);
          errors.push(`${economist.email}: ${emailError.message}`);
        }
      }
    }

    await client.close();

    console.log(`Reminders sent: ${sentCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: sentCount,
        reminderType,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in send-report-reminders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
