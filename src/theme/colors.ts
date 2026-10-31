export const Colors = {
  background: '#05050A',
  card: '#101018',
  surface: '#181824',
  surfaceElevated: '#202030',
  border: '#272738',
  borderLight: '#3B3B54',

  textPrimary: '#F4F4FF',
  textSecondary: '#9494B8',
  textMuted: '#5C5C7A',

  primary: '#8B5CF6',
  primaryLight: '#A855F7',

  // Status colors
  present: '#22C55E',
  absent: '#EF4444',
  holiday: '#60A5FA',
  cancelled: '#F59E0B',
  shifted: '#EC4899',

  // Subject palette (neon)
  subjectColors: [
    '#7C3AED', // violet
    '#DB2777', // pink
    '#0891B2', // cyan
    '#059669', // emerald
    '#D97706', // amber
    '#DC2626', // red
    '#7C3AED', // violet (repeat)
    '#2563EB', // blue
    '#9333EA', // purple
    '#0D9488', // teal
    '#B45309', // yellow-brown
    '#BE185D', // hot pink
  ],

  // Gradients
  gradientStart: '#7C3AED',
  gradientEnd: '#DB2777',

  // Toast
  toastBg: '#1C1C27',

  // Chart
  chartGrid: '#2A2A3D',

  // Heatmap
  heatmapEmpty: '#13131A',
  heatmapPresent: '#22C55E',
  heatmapAbsent: '#EF4444',
  heatmapHoliday: '#60A5FA',
  heatmapCancelled: '#F59E0B',
  heatmapNoClass: '#1C1C27',
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
