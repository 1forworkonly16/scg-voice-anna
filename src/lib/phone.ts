// Phone number normalisation for book_inspection / request_callback. Returns E.164 or null (-> invalid_phone).
// Spoken numbers arrive as text from ASR, e.g. "+371 22 84 81 44", "22848144", "00371 29327275", "8 (916) 123-45-67".
export function normalizePhone(raw: string): string | null {
  let s = raw.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(s)) return null;
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) {
    const digits = s.slice(1);
    if (digits.startsWith("371")) return /^371[2-7]\d{7}$/.test(digits) ? `+${digits}` : null;
    return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0") ? `+${digits}` : null;
  }
  // bare Latvian number: 8 digits, mobile 2xxxxxxx, landline 6xxxxxxx / 7xxxxxxx
  if (/^[2-7]\d{7}$/.test(s)) return `+371${s}`;
  if (/^371[2-7]\d{7}$/.test(s)) return `+${s}`;
  return null;
}
