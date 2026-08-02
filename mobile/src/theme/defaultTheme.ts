// Fallback theme used before tenant branding is loaded from server
export const defaultTheme = {
  colors: {
    primary: '#1A73E8',
    secondary: '#34A853',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    error: '#D93025',
    warning: '#F9AB00',
    success: '#1E8E3E',
    text: '#202124',
    textSecondary: '#5F6368',
    textOnPrimary: '#FFFFFF',
    border: '#DADCE0',
    divider: '#E8EAED',
    inputBackground: '#F1F3F4',

    // Status colors — fixed regardless of tenant brand
    statusPending: '#F9AB00',
    statusApproved: '#1E8E3E',
    statusRejected: '#D93025',
    statusCompleted: '#1A73E8',
    statusOtpSent: '#E37400',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
    h2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 30 },
    h3: { fontSize: 18, fontWeight: '600' as const, lineHeight: 26 },
    body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
    bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
    label: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },
  },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
  },
};

export type AppTheme = typeof defaultTheme;
