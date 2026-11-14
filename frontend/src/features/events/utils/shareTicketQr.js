/**
 * Share the ticket QR as a picture.
 * A wa.me text link cannot attach the image, so the phone share sheet
 * or the Android WhatsApp image intent carries the PNG.
 */

export function ticketShareCaption({ name, eventName, entryCode }) {
  const who = String(name || 'Guest').trim() || 'Guest';
  const event = String(eventName || 'the event').trim() || 'the event';
  const code = String(entryCode || '').trim() || 'ticket';
  return `${who}, your ticket for ${event} is ready. Ticket number: ${code}. Show this QR at the entrance.`;
}

export async function shareTicketQrImage({ dataUrl, text, title, fileName }) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) {
    return { ok: false, saved: false };
  }
  const safeName = String(fileName || 'event-ticket.png').endsWith('.png')
    ? String(fileName || 'event-ticket.png')
    : `${fileName}.png`;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && text) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // The picture still shares if the caption cannot be copied.
  }

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
      const plugin = Capacitor.Plugins?.WhatsAppShare;
      if (plugin && typeof plugin.shareToWhatsApp === 'function') {
        await plugin.shareToWhatsApp({
          base64Data: dataUrl,
          fileName: safeName,
          text: '',
        });
        return { ok: true, saved: false };
      }
    }
    if (Capacitor.isNativePlatform()) {
      const { shareViaCapacitorAPI } = await import('../../../shared/utils/shareUtils.js');
      const result = await shareViaCapacitorAPI(dataUrl, {
        title: title || 'Event ticket',
        text,
        fileName: safeName,
      });
      if (result?.ok) return { ok: true, saved: false };
    }
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('abort')) {
      return { ok: true, saved: false };
    }
  }

  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], safeName, { type: 'image/png' });
    if (
      typeof navigator !== 'undefined'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [file] })
      && typeof navigator.share === 'function'
    ) {
      await navigator.share({
        title: title || 'Event ticket',
        text,
        files: [file],
      });
      return { ok: true, saved: false };
    }
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('abort')) {
      return { ok: true, saved: false };
    }
  }

  if (typeof document !== 'undefined') {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = safeName;
    link.click();
    return { ok: false, saved: true };
  }
  return { ok: false, saved: false };
}
