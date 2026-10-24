import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const config = { schedule: '* * * * *' };

export async function handler() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@activityday.app';
  if (!url || !serviceKey || !publicKey || !privateKey) {
    console.error('Configuração incompleta: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY são obrigatórias.');
    return { statusCode: 500, body: 'Configuração incompleta.' };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type)?.value || '00';
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const localHour = Number(part('hour'));
  const localMinute = Number(part('minute'));
  const localMinutes = localHour * 60 + localMinute;
  const yesterdayDate = new Date(`${today}T12:00:00+01:00`); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterdayDate);
  const { data: activities, error: activitiesError } = await supabase.from('activities')
    .select('id,user_id,title,due_date,reminder_time,category')
    .eq('done', false).not('due_date', 'is', null).not('reminder_time', 'is', null)
    .gte('due_date', yesterday).lte('due_date', today);
  if (activitiesError) { console.error('Erro ao consultar actividades:', activitiesError.message); return { statusCode: 500, body: 'Erro ao consultar actividades.' }; }
  let sent = 0;
  for (const activity of activities || []) {
    const dueTime = String(activity.reminder_time).slice(0, 5).split(':').map(Number);
    const dueMinutes = dueTime[0] * 60 + dueTime[1];
    if (activity.due_date === today && dueMinutes > localMinutes) continue;
    const { data: alreadySent, error: deliveryReadError } = await supabase.from('push_deliveries').select('id')
      .eq('activity_id', activity.id).eq('due_date', activity.due_date).eq('reminder_time', activity.reminder_time).limit(1);
    if (deliveryReadError) { console.error(deliveryReadError.message); continue; }
    if (alreadySent?.length) continue;
    const { data: subscriptions, error: subscriptionError } = await supabase.from('push_subscriptions').select('id,endpoint,subscription').eq('user_id', activity.user_id);
    if (subscriptionError) { console.error(subscriptionError.message); continue; }
    let delivered = false;
    for (const item of subscriptions || []) {
      try {
        await webpush.sendNotification(item.subscription, JSON.stringify({
          title: 'ActivityDay — lembrete',
          body: `${activity.title} · ${activity.due_date} às ${String(activity.reminder_time).slice(0, 5)}`,
          url: '/reminders',
          tag: `activity-${activity.id}-${activity.due_date}-${String(activity.reminder_time).slice(0, 5)}`,
        }));
        delivered = true;
        sent += 1;
      } catch (error) {
        console.error('Falha ao enviar push:', error.statusCode || '', error.message);
        if (error.statusCode === 404 || error.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', item.id);
        }
      }
    }
    if (delivered) {
      const { error: insertError } = await supabase.from('push_deliveries').insert({
        activity_id: activity.id, user_id: activity.user_id, due_date: activity.due_date, reminder_time: activity.reminder_time,
      });
      if (insertError && insertError.code !== '23505') console.error('Erro ao registar envio:', insertError.message);
    }
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true, sent, checkedAt: now.toISOString() }) };
}
