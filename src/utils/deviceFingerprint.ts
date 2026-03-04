/**
 * Deterministyczny hash JS — fallback gdy crypto.subtle niedostępne
 * (HTTP, starsze mobile, ograniczone konteksty).
 * Implementacja FNV-1a 128-bit (daje hex string, stabilny cross-platform).
 */
const fnv1aHash = (str: string): string => {
  let h1 = 0x811c9dc5 >>> 0;
  let h2 = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x01000193) >>> 0;
  }
  const hex1 = h1.toString(16).padStart(8, '0');
  const hex2 = h2.toString(16).padStart(8, '0');
  // Powtórz, żeby uzyskać dłuższy hash (lepsze rozróżnienie)
  const h3 = Math.imul(h1 ^ h2, 0x01000193) >>> 0;
  const h4 = Math.imul(h2 ^ h1, 0x16f11fe5) >>> 0;
  return hex1 + hex2 + h3.toString(16).padStart(8, '0') + h4.toString(16).padStart(8, '0');
};

/**
 * Hash: najpierw WebCrypto (SHA-256), fallback na FNV-1a JS.
 * NIGDY nie rzuca wyjątku.
 */
const safeHash = async (str: string): Promise<string> => {
  try {
    if (globalThis.crypto?.subtle?.digest) {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // WebCrypto niedostępne — kontynuuj do fallbacku
  }
  console.warn('[deviceFingerprint] crypto.subtle niedostępne, używam fallback hash (FNV-1a)');
  return fnv1aHash(str);
};

/**
 * Zbiera komponent fingerprintu bezpiecznie (guard na brak window/navigator/screen).
 */
const collectComponents = (): string[] => {
  const components: string[] = [];
  
  try {
    if (typeof navigator !== 'undefined') {
      components.push(navigator.userAgent || 'unknown-ua');
      components.push(navigator.language || 'unknown-lang');
      components.push(navigator.platform || 'unknown-platform');
      if ('hardwareConcurrency' in navigator) {
        components.push(String(navigator.hardwareConcurrency));
      }
    }
  } catch { /* guard */ }

  try {
    if (typeof Intl !== 'undefined') {
      components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown-tz');
    }
  } catch { /* guard */ }

  try {
    if (typeof screen !== 'undefined') {
      components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    }
  } catch { /* guard */ }

  // Canvas fingerprint
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('OMI System', 2, 2);
      components.push(canvas.toDataURL());
    }
  } catch { /* guard */ }

  // WebGL fingerprint
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
      }
    }
  } catch { /* guard */ }

  // Jeśli nie udało się zebrać nic — dodaj stały marker
  if (components.length === 0) {
    components.push('fallback-empty-fingerprint');
  }

  return components;
};

/**
 * Generuje fingerprint urządzenia. NIGDY nie rzuca wyjątku — zawsze zwraca string.
 */
export const generateDeviceFingerprint = async (): Promise<string> => {
  try {
    const components = collectComponents();
    const raw = components.join('|');
    return await safeHash(raw);
  } catch (e) {
    console.error('[deviceFingerprint] Nieoczekiwany błąd generowania fingerprint:', e);
    // Ostateczny fallback — deterministyczny, ale ograniczony
    return fnv1aHash('emergency-fallback-' + (typeof navigator !== 'undefined' ? navigator.userAgent : 'no-ua'));
  }
};

/**
 * Sprawdza czy urządzenie jest zaufane dla danego użytkownika
 */
export const isDeviceTrusted = async (
  userId: string,
  deviceFingerprint: string,
  supabase: any
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('trusted_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('device_fingerprint', deviceFingerprint)
    .maybeSingle();

  if (error) {
    console.error('[deviceFingerprint] Error checking trusted device:', error);
    return false;
  }

  return !!data;
};

/**
 * Generuje czytelną nazwę urządzenia na podstawie user agent
 */
const getDeviceName = (): string => {
  try {
    const ua = navigator.userAgent;
    let browser = 'Przeglądarka';
    let os = 'System';
    
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Opera')) browser = 'Opera';
    
    if (ua.includes('Windows NT 10')) os = 'Windows 10/11';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    
    return `${browser} na ${os}`;
  } catch {
    return 'Nieznane urządzenie';
  }
};

/**
 * Dodaje urządzenie do listy zaufanych (UPSERT)
 */
export const addTrustedDevice = async (
  userId: string,
  deviceFingerprint: string,
  supabase: any
): Promise<void> => {
  const deviceName = getDeviceName();
  const now = new Date().toISOString();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  
  const { data: existing } = await supabase
    .from('trusted_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('device_fingerprint', deviceFingerprint)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('trusted_devices')
      .update({
        device_name: deviceName,
        user_agent: userAgent,
        last_used_at: now,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('[deviceFingerprint] Error updating trusted device:', error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('trusted_devices')
      .insert({
        user_id: userId,
        device_fingerprint: deviceFingerprint,
        device_name: deviceName,
        user_agent: userAgent,
        last_used_at: now,
      });

    if (error) {
      console.error('[deviceFingerprint] Error adding trusted device:', error);
      throw error;
    }
  }

  // Weryfikacja zapisu (assert)
  const { data: verification } = await supabase
    .from('trusted_devices')
    .select('id')
    .eq('user_id', userId)
    .eq('device_fingerprint', deviceFingerprint)
    .maybeSingle();

  if (!verification) {
    throw new Error('Zapis urządzenia nie powiódł się — brak rekordu po insercie');
  }

  console.log('[deviceFingerprint] Urządzenie zaufane zapisane pomyślnie:', verification.id);
};

/**
 * Aktualizuje datę ostatniego użycia zaufanego urządzenia
 */
export const updateTrustedDeviceLastUsed = async (
  userId: string,
  deviceFingerprint: string,
  supabase: any
): Promise<void> => {
  const { error } = await supabase
    .from('trusted_devices')
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('device_fingerprint', deviceFingerprint);

  if (error) {
    console.error('[deviceFingerprint] Error updating trusted device:', error);
  }
};

/**
 * Usuwa wszystkie zaufane urządzenia użytkownika
 */
export const removeAllTrustedDevices = async (
  userId: string,
  supabase: any
): Promise<number> => {
  const { data, error } = await supabase
    .from('trusted_devices')
    .delete()
    .eq('user_id', userId)
    .select('id');

  if (error) {
    console.error('[deviceFingerprint] Error removing all trusted devices:', error);
    throw error;
  }

  return data?.length || 0;
};
