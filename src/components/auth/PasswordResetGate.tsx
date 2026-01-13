import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Globalny komponent wykrywający token resetowania hasła w URL
 * i przekierowujący na właściwą stronę resetu.
 * Obsługuje różne formaty URL (query string, hash, encoded path).
 */
export const extractResetToken = (): string | null => {
  const { search, hash, pathname } = window.location;
  
  // 1. Standardowy query string: ?token=XXX
  const searchParams = new URLSearchParams(search);
  let token = searchParams.get('token');
  if (token) return token;
  
  // 2. Token w hash: #?token=XXX lub #token=XXX
  if (hash) {
    const hashContent = hash.replace(/^#\/?/, '');
    if (hashContent.includes('token=')) {
      const hashParams = new URLSearchParams(hashContent.replace(/^\?/, ''));
      token = hashParams.get('token');
      if (token) return token;
    }
  }
  
  // 3. Token zakodowany w pathname: /%3Ftoken=XXX lub /token=XXX
  const decodedPath = decodeURIComponent(pathname);
  const tokenMatch = decodedPath.match(/[?&]?token=([a-zA-Z0-9]+)/);
  if (tokenMatch) {
    return tokenMatch[1];
  }
  
  return null;
};

export const PasswordResetGate = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const token = extractResetToken();
    
    // Jeśli znaleziono token i nie jesteśmy już na stronie resetu
    if (token && location.pathname !== '/reset-password') {
      console.log('[PasswordResetGate] Token detected, redirecting to reset-password');
      navigate(`/reset-password?token=${token}`, { replace: true });
    }
  }, [location, navigate]);
  
  return <>{children}</>;
};

export default PasswordResetGate;
