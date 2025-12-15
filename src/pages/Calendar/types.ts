export type EventType = 'deadline' | 'reminder' | 'meeting' | 'celebration' | 'other' | 'report_submitted' | 'report_approved' | 'budget_submitted' | 'budget_approved';

export type EventPriority = 'low' | 'medium' | 'high';

export interface CalendarEvent {
  id: string;
  location_id?: string;
  user_id?: string;
  title: string;
  description?: string;
  event_date: string;
  event_type: EventType;
  priority: EventPriority;
  is_recurring: boolean;
  recurring_pattern?: 'yearly' | 'monthly' | 'weekly';
  is_global: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // For system-generated events
  source?: 'calendar' | 'reports' | 'budgets' | 'reminders';
  location_name?: string;
}

export const EVENT_TYPE_CONFIG: Record<EventType, { label: string; color: string; bgColor: string; icon: string }> = {
  deadline: { label: 'Termin', color: 'text-red-600', bgColor: 'bg-red-500', icon: '🔴' },
  reminder: { label: 'Przypomnienie', color: 'text-orange-600', bgColor: 'bg-orange-500', icon: '🟠' },
  meeting: { label: 'Spotkanie', color: 'text-blue-600', bgColor: 'bg-blue-500', icon: '🔵' },
  celebration: { label: 'Święto/Rocznica', color: 'text-green-600', bgColor: 'bg-green-500', icon: '🟢' },
  other: { label: 'Inne', color: 'text-gray-600', bgColor: 'bg-gray-500', icon: '⚪' },
  report_submitted: { label: 'Raport wysłany', color: 'text-yellow-600', bgColor: 'bg-yellow-500', icon: '🟡' },
  report_approved: { label: 'Raport zatwierdzony', color: 'text-emerald-600', bgColor: 'bg-emerald-500', icon: '✅' },
  budget_submitted: { label: 'Budżet złożony', color: 'text-indigo-600', bgColor: 'bg-indigo-500', icon: '📊' },
  budget_approved: { label: 'Budżet zatwierdzony', color: 'text-teal-600', bgColor: 'bg-teal-500', icon: '💰' },
};
