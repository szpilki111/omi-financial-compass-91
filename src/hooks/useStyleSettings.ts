
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export const useStyleSettings = () => {
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return { windows98_style: false };
      
      const { data, error } = await supabase
        .from('user_settings')
        .select('windows98_style')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        return { windows98_style: false };
      }

      return data || { windows98_style: false };
    },
    enabled: !!user?.id,
    staleTime: 300000, // 5 minut
  });

  return {
    isWindows98Style: settings?.windows98_style || false
  };
};
