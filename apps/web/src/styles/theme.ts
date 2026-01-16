// ConvoLens Brand Theme
const theme = {
  colors: {
    // ConvoLens Primary Brand Colors
    primary: '#6B46C1', // Deep Purple - Main brand color
    secondary: '#06B6D4', // Bright Cyan - Secondary brand color
    accent: '#C4B5FD', // Soft Lavender - Accent color
    
    // WhatsApp Integration Colors (for WhatsApp-specific features only)
    whatsappGreen: '#25D366', // Use only for WhatsApp chat indicators
    whatsappDark: '#128C7E', // Use only for WhatsApp-specific elements
    
    // Semantic Colors
    error: '#f5222d',
    warning: '#faad14',
    success: '#52c41a',
    text: 'rgba(0, 0, 0, 0.85)',
    textSecondary: 'rgba(0, 0, 0, 0.45)',
    border: '#f0f0f0',
    background: '#f5f5f5',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  breakpoints: {
    xs: '480px',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1600px',
  },
  zIndex: {
    modal: 1000,
    dropdown: 1050,
    tooltip: 1060,
    notification: 1070,
  },
};

export default theme;
