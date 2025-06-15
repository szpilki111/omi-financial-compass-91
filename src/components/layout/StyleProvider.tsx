
import React, { useEffect } from 'react';
import { useStyleSettings } from '@/hooks/useStyleSettings';

interface StyleProviderProps {
  children: React.ReactNode;
}

const StyleProvider = ({ children }: StyleProviderProps) => {
  const { isWindows98Style } = useStyleSettings();

  useEffect(() => {
    if (isWindows98Style) {
      document.documentElement.classList.add('windows98-theme');
    } else {
      document.documentElement.classList.remove('windows98-theme');
    }
  }, [isWindows98Style]);

  return <>{children}</>;
};

export default StyleProvider;
