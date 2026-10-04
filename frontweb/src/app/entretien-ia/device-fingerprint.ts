/**
 * Empreinte d'appareil (anti-triche, faits techniques uniquement).
 *
 * Calcule un hash stable des caractéristiques techniques du navigateur :
 * user-agent, langue, résolution, timezone, canvas et rendu WebGL. Aucune
 * donnée personnelle ni biométrique n'est collectée : le résultat est une
 * chaîne hexadécimale (SHA-256) envoyée au backend pour détecter un
 * changement d'appareil en cours d'entretien.
 */
export async function computeDeviceFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth || 24),
    String(window.devicePixelRatio || 1),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    String(navigator.hardwareConcurrency || 0),
    canvasHash(),
    webglHash(),
  ];
  return sha256Hex(parts.join('|'));
}

function canvasHash(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'canvas:na';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 220, 30);
    ctx.fillStyle = '#069';
    ctx.fillText('Entretien IA', 2, 2);
    const data = canvas.toDataURL();
    return `canvas:${data.length}:${data.slice(-64)}`;
  } catch {
    return 'canvas:na';
  }
}

function webglHash(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return 'webgl:na';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg
      ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL))
      : String(gl.getParameter(gl.VENDOR));
    const renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    return `webgl:${vendor}:${renderer}`;
  } catch {
    return 'webgl:na';
  }
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}
