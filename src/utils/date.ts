import dayjs from 'dayjs';

export function formatDeliveryDate(timeMs: number) {
  return dayjs(timeMs).format('dddd, MMMM D');
}

export function formatDate(date: string) {
  return dayjs(date).format('MMMM D, YYYY');
}

