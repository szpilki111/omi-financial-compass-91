/**
 * Generuje unikalny fingerprint urządzenia na podstawie dostępnych informacji
 * o przeglądarce i systemie. Nie jest to idealne rozwiązanie, ale wystarczające
 * do podstawowej identyfikacji urządzenia.
 */
export const generateDeviceFingerprint = async (): Promise<string> => {
  const components: string[] = [];

  // User agent
  components.push(navigator.userAgent);

  // Język przeglądarki
  components.push(navigator.language);

  // Strefa czasowa
  components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Rozdzielczość ekranu
  components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

  // Platform
  components.push(navigator.platform);

  // Liczba rdzeni procesora (jeśli dostępne)
  if ('hardwareConcurrency' in navigator) {
    components.push(String(navigator.hardwareConcurrency));
  }

  // Canvas fingerprint (prosty wariant)
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('OMI System', 2, 2);
      components.push(canvas.toDataURL());
    }
  } catch (e) {
    // Canvas może być zablokowany przez niektóre przeglądarki
  }

  // WebGL fingerprint (jeśli dostępne)
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
  } catch (e) {
    // WebGL może nie być dostępny
  }

  // Połącz wszystkie komponenty i zahashuj
  const fingerprint = components.join('|');
  
  // Prosty hash (dla production lepiej użyć crypto.subtle.digest)
  return await simpleHash(fingerprint);
};

/**
 * Prosty hash funkcja używająca Web Crypto API
 */
const simpleHash = async (str: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
};

/**
 * Sprawdza czy urządzenie jest zaufane dla danego użytkownika
 */
export const isDeviceTrusted = async (
  userId: string,
  deviceFingerprint: string,
  supabase: any
): Promise<boolean> => {
  const TRUST_DAYS = 30;
  const TRUST_MS = TRUST_DAYS * 24 * 60 * 60 * 1000;

  const { data, error } = await supabase
    .from('trusted_devices')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('device_fingerprint', deviceFingerprint)
    .maybeSingle();

  if (error) {
    console.error('Error checking trusted device:', error);
    return false;
  }

  if (!data) return false;

  // Ważność zaufania: 30 dni od dodania
  if (data.created_at) {
    const createdAt = new Date(data.created_at).getTime();
    if (!Number.isNaN(createdAt) && Date.now() - createdAt > TRUST_MS) {
      return false;
    }
  }

  return true;
};

/**
 * Dodaje urządzenie do listy zaufanych
 */
export const addTrustedDevice = async (
  userId: string,
  deviceFingerprint: string,
  supabase: any
): Promise<void> => {
  const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
  
  const { error } = await supabase
    .from('trusted_devices')
    .insert({
      user_id: userId,
      device_fingerprint: deviceFingerprint,
      device_name: deviceName,
      user_agent: navigator.userAgent,
    });

  if (error) {
    console.error('Error adding trusted device:', error);
    throw error;
  }
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
    console.error('Error updating trusted device:', error);
  }
};

/**
 * Usuwa wygasłe zaufane urządzenia (starsze niż 30 dni)
 */
export const cleanupExpiredTrustedDevices = async (
  userId: string,
  supabase: any
): Promise<number> => {
  const TRUST_DAYS = 30;
  const expiryDate = new Date(Date.now() - TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('trusted_devices')
    .delete()
    .eq('user_id', userId)
    .lt('created_at', expiryDate)
    .select('id');

  if (error) {
    console.error('Error cleaning up expired devices:', error);
    return 0;
  }

  return data?.length || 0;
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
    console.error('Error removing all trusted devices:', error);
    throw error;
  }

  return data?.length || 0;
};
