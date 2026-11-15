export const Colors = {
  background: '#040814',
  card: '#0A152A',
  surface: '#10203E',
  surfaceElevated: '#172C54',
  border: '#1E3B6E',
  borderLight: '#2C5499',

  textPrimary: '#F0F9FF',
  text: '#F0F9FF',
  textSecondary: '#93C5FD',
  textMuted: '#64748B',

  primary: '#00A3FF',
  primaryLight: '#38BDF8',
  primaryDark: '#0284C7',
  accentNavy: '#0A1931',
  accentCheck: '#00A3FF',

  // Status colors
  present: '#10B981',
  absent: '#EF4444',
  holiday: '#38BDF8',
  cancelled: '#F59E0B',
  shifted: '#00D2FF',

  // Subject palette (neon modern azure-cyan-violet balance)
  subjectColors: [
    '#00A3FF', // electric cyan
    '#2563EB', // royal blue
    '#0D9488', // teal
    '#10B981', // emerald
    '#6366F1', // indigo
    '#8B5CF6', // violet
    '#0284C7', // sky blue
    '#F59E0B', // amber
    '#EC4899', // pink
    '#14B8A6', // aqua
    '#3B82F6', // dodger blue
    '#EF4444', // coral red
  ],

  // Gradients matching new Attendo Logo
  gradientStart: '#00A3FF',
  gradientEnd: '#2563EB',

  // Toast
  toastBg: '#0F203D',

  // Chart
  chartGrid: '#1E3B6E',

  // Heatmap
  heatmapEmpty: '#0A152A',
  heatmapPresent: '#10B981',
  heatmapAbsent: '#EF4444',
  heatmapHoliday: '#38BDF8',
  heatmapCancelled: '#F59E0B',
  heatmapNoClass: '#10203E',
};

export function getStatusColor(status: string | null): string {
  switch (status) {
    case 'present': return Colors.present;
    case 'absent': return Colors.absent;
    case 'holiday': return Colors.holiday;
    case 'cancelled': return Colors.cancelled;
    case 'shifted': return Colors.shifted;
    default: return Colors.surface;
  }
}
