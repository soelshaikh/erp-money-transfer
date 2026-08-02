import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { defaultTheme, AppTheme } from './defaultTheme';

const ThemeContext = createContext<AppTheme>(defaultTheme);

interface Props {
  children: React.ReactNode;
}

export function TenantThemeProvider({ children }: Props) {
  const tenant = useAuthStore((s) => s.tenant);
  const { width } = useWindowDimensions();

  const theme = useMemo(() => {
    // Scale fonts down 10% on small screens (< 375px — older Android, iPhone SE 1st gen)
    const fontScale = width < 375 ? 0.9 : 1;

    const scaledTypography = Object.fromEntries(
      Object.entries(defaultTheme.typography).map(([key, style]) => [
        key,
        { ...style, fontSize: Math.round(style.fontSize * fontScale) },
      ])
    ) as typeof defaultTheme.typography;

    const base = {
      ...defaultTheme,
      typography: scaledTypography,
    };

    const branding = tenant?.branding;
    if (!branding) return base;

    return {
      ...base,
      colors: {
        ...base.colors,
        ...(branding.primaryColor && { primary: branding.primaryColor }),
        ...(branding.secondaryColor && { secondary: branding.secondaryColor }),
      },
      appName: branding.appName || 'Money Transfer',
      logoUrl: branding.logoUrl || null,
    };
  }, [tenant?.branding, width]);

  return <ThemeContext.Provider value={theme as AppTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}
