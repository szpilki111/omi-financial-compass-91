import { supabase } from '@/integrations/supabase/client';

interface BudgetNotificationParams {
  type: 'budget_submitted' | 'budget_approved' | 'budget_rejected' | 'budget_exceeded';
  budgetId: string;
  recipientEmail: string;
  budgetYear: number;
  locationName: string;
  rejectionReason?: string;
  exceededPercentage?: number;
  month?: string;
}

export const sendBudgetNotification = async (params: BudgetNotificationParams) => {
  try {
    const { data, error } = await supabase.functions.invoke('send-budget-notification', {
      body: params,
    });

    if (error) {
      console.error('Error sending budget notification:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to send budget notification:', error);
    throw error;
  }
};
