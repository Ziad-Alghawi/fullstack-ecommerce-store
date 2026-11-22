// "jane.doe@example.com" is shown as "ja***", so the email can't be worked out from it
export function maskEmail(email: string | null | undefined) {
  const localPart = email?.split('@')[0];
  return localPart ? `${localPart.slice(0, 2)}***` : 'Customer';
}
