
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export const useStyleSettings = () => {
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return { windows98_style: false };
      
      // Use direct SQL query since the types aren't updated yet
      const { data, error } = await supabase
        .rpc('get_user_setting', { p_user_id: user.id })
        .single();

      if (error) {
        // If no settings exist yet, return default
        return { windows98_style: false };
      }

      return data || { windows98_style: false };
    },
    enabled: !!user?.id,
    staleTime: 300000, // 5 minutes
  });

  return {
    isWindows98Style: settings?.windows98_style || false
  };
};
