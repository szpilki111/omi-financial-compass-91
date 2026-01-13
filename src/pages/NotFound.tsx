import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { extractResetToken } from "@/components/auth/PasswordResetGate";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Sprawdź czy w URL jest token resetu hasła (np. zakodowany w path)
    const token = extractResetToken();
    if (token) {
      console.log('[NotFound] Token detected in 404, redirecting to reset-password');
      navigate(`/reset-password?token=${token}`, { replace: true });
      return;
    }

    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Strona nie została znaleziona</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Wróć do strony głównej
        </a>
      </div>
    </div>
  );
};

export default NotFound;
