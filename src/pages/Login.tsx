
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Get the redirect path or use home page as default
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const success = await login(email, password);
      if (success) {
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      console.error(err);
      setError('Wystąpił problem podczas logowania. Spróbuj ponownie.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-omi-gray-100">
      <div className="bg-white p-8 rounded-md shadow-md w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-omi-500">OMI Finanse</h1>
          <p className="text-omi-gray-500 mt-1">Zaloguj się do systemu</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="omi-form-label">
              Adres email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="omi-form-input"
              required
              placeholder="Wprowadź adres email"
            />
          </div>

          <div>
            <label htmlFor="password" className="omi-form-label">
              Hasło
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="omi-form-input"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 border-omi-gray-300 rounded text-omi-500 focus:ring-omi-500"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-omi-gray-700">
                Zapamiętaj mnie
              </label>
            </div>

            <div>
              <a href="#" className="text-sm text-omi-500 hover:text-omi-600">
                Zapomniałeś hasła?
              </a>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="omi-btn omi-btn-primary w-full flex justify-center"
          >
            {isLoading ? <Spinner size="sm" /> : 'Zaloguj się'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
