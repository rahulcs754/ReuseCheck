const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDisplayDate(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const dd = d.getDate();
  const mon = MONTH_NAMES[d.getMonth()];
  return `${dd} ${mon} ${year}`;
}
