// PURPOSE: Generate a compact SVG QR for a given URL.
// SECURITY: All inputs are server side only. Never eval user content.

import QRCode from 'qrcode';

/**
 * Generate a minimal SVG string for a QR code that encodes `url`.
 * @param url - absolute URL that the QR should open
 * @param size - viewbox size in px (square). The svg scales cleanly in CSS.
 */
export async function generateQrSvg(url: string, size = 256): Promise<string> {
  // IT: use qrcode to build path-only svg string - no external refs
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M', // IT: balance between density and redundancy
    margin: 1,                 // IT: small quiet zone
    width: size
  });

  // IT: toString returns a complete <svg> string already - return as-is
  return svg;
}
