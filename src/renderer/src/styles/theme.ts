export const theme = {
  colors: {
    // Backgrounds
    bg: '#ffffff',
    bgSecondary: '#f9fafb',
    bgTertiary: '#f3f4f6',

    // Borders
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    borderFocus: '#3b82f6',

    // Text
    text: '#111827',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    textMuted: '#d1d5db',

    // Accents
    blue: '#3b82f6',
    blueLight: '#eff6ff',
    green: '#22c55e',
    greenLight: '#f0fdf4',
    red: '#ef4444',
    redLight: '#fef2f2',
    orange: '#f97316',
    orangeLight: '#fff7ed',
    purple: '#8b5cf6',
    amber: '#f59e0b',
    amberLight: '#fffbeb',

    // Claude panel
    userBubble: '#2563eb',
    assistantBg: '#ffffff',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },

  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
  },

  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },
} as const
