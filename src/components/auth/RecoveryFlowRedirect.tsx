import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Supabase recovery links often land on "/" (or hosts may not support deep-linking).
 * If the URL contains a recovery payload, force navigation to /reset-password
 * while preserving the hash (access_token, refresh_token, type=recovery).
 */
export default function RecoveryFlowRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash ?? "";
    const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

    const searchParams = new URLSearchParams(location.search);

    const type = hashParams.get("type") ?? searchParams.get("type");
    if (type !== "recovery") return;

    if (location.pathname !== "/reset-password") {
      navigate(
        {
          pathname: "/reset-password",
          search: location.search,
          hash,
        },
        { replace: true }
      );
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}
