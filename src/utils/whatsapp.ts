// WhatsApp Click-to-Chat utilities

/**
 * Normalize Indian phone numbers to E.164 format
 * @param phone - Raw phone number string
 * @returns E.164 formatted number or null if invalid
 */
export function normalizeIndiaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  
  // Handle various Indian phone formats
  if (digits.length === 10) {
    // 10 digit: add 91 prefix
    digits = '91' + digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    // 11 digit starting with 0: remove 0, add 91
    digits = '91' + digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    // Already has country code
    // digits is fine
  } else if (digits.length === 13 && digits.startsWith('091')) {
    // 091 prefix
    digits = '91' + digits.slice(3);
  } else {
    // Invalid format
    return null;
  }
  
  // Validate: must be 12 digits starting with 91 and then a valid mobile prefix (6-9)
  if (digits.length === 12 && digits.startsWith('91') && /^91[6-9]\d{9}$/.test(digits)) {
    return digits;
  }
  
  return null;
}

/**
 * Build WhatsApp click-to-chat link
 * @param phoneOrNull - Phone number or null for group share
 * @param text - Message text
 * @returns WhatsApp URL
 */
export function buildWaLink(phoneOrNull: string | null, text: string): string {
  const encodedText = encodeURIComponent(text);
  
  if (phoneOrNull) {
    const normalizedPhone = normalizeIndiaPhone(phoneOrNull);
    if (normalizedPhone) {
      return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
    }
  }
  
  // Fallback: open WhatsApp without specific contact (user chooses)
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Open WhatsApp with prefilled message
 * @param phoneOrNull - Phone number or null for group share
 * @param text - Message text
 */
export function openWhatsApp(phoneOrNull: string | null, text: string): void {
  const url = buildWaLink(phoneOrNull, text);
  window.open(url, '_blank', 'noopener,noreferrer');
}
