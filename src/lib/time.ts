import { TZDate } from '@date-fns/tz';
import { format as dateFormat, type FormatOptions } from 'date-fns';
/** All business dates use Asia/Tokyo, independent of the browser timezone. */
export function jstDate(value: Date | string | number = new Date()): TZDate {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(value))
    value = value.includes('T') ? `${value}+09:00` : `${value}T00:00:00+09:00`;
  return new TZDate(new Date(value).getTime(), 'Asia/Tokyo');
}
export function format(value: Date | string | number, pattern: string, options?: FormatOptions) {
  return dateFormat(jstDate(value), pattern, options);
}
