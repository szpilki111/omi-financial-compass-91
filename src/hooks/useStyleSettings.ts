
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export const useStyleSettings = () => {
  const { user } = useAuth();

  const { data: settings } = useQuery({
    queryKey: ['user-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return { windows98_style: false };
      
      // Query the user_settings table directly
      const { data, error } = await supabase
        .from('user_settings')
        .select('windows98_style')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        // If no settings exist yet, return default
        return { windows98_style: false };
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 300000, // 5 minutes
  });

  return {
    isWindows98Style: settings?.windows98_style || false
  };
};
