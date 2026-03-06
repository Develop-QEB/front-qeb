import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/auth.service';
import { useThemeStore } from '../../store/themeStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Password requerido'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login(data.email, data.password);
      queryClient.clear();
      setAuth(response.user, response.accessToken, response.refreshToken);
      navigate('/');
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Error al iniciar sesion';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 bg-gradient-to-br transition-colors duration-300"
      style={{
        background: isDark
          ? 'linear-gradient(to bottom right, #0f0a18, #1a1025, #0f0a18)'
          : 'linear-gradient(to bottom right, #ffffff, rgb(250 245 255 / 0.5), rgb(243 232 255 / 0.3))',
      }}
    >
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          {isDark ? (
            <img src="/images/logo-bco.png" alt="QEB OOH Management" className="h-24 w-auto" />
          ) : (
            <img src="/images/logo-ooh.png" alt="QEB OOH Management" className="h-24 w-auto" />
          )}
        </div>

        {/* Form Card */}
        <div className={`backdrop-blur-sm rounded-2xl p-8 border shadow-xl ${
          isDark
            ? 'bg-[#1a1025]/90 border-purple-900/30 shadow-purple-900/10'
            : 'bg-white/90 border-purple-200/50 shadow-purple-100/20'
        }`}>
          <div className="text-center mb-8">
            <h1 className={`text-2xl font-light tracking-wide ${isDark ? 'text-white' : 'text-gray-800'}`}>
              Bienvenido
            </h1>
            <p className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              Ingresa tus credenciales para acceder
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className={`p-3 text-sm rounded-lg border ${
                isDark
                  ? 'text-red-400 bg-red-500/10 border-red-500/30'
                  : 'text-red-600 bg-red-50 border-red-200'
              }`}>
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                {...register('email')}
                className={`focus:border-purple-500 focus:ring-purple-500/20 ${
                  isDark
                    ? 'bg-zinc-800/50 border-purple-500/20 text-white placeholder:text-zinc-500'
                    : 'bg-gray-50 border-purple-200 text-gray-800 placeholder:text-gray-400'
                } ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && (
                <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Tu password"
                {...register('password')}
                className={`focus:border-purple-500 focus:ring-purple-500/20 ${
                  isDark
                    ? 'bg-zinc-800/50 border-purple-500/20 text-white placeholder:text-zinc-500'
                    : 'bg-gray-50 border-purple-200 text-gray-800 placeholder:text-gray-400'
                } ${errors.password ? 'border-red-500' : ''}`}
              />
              {errors.password && (
                <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{errors.password.message}</p>
              )}
            </div>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className={`text-sm transition-colors ${
                  isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-600 hover:text-purple-500'
                }`}
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-light tracking-wide py-5"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Ingresando...
                </>
              ) : (
                'Ingresar'
              )}
            </Button>

            {/* Link to register */}
            <div className="text-center pt-2">
              <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                ¿No estás registrado?{' '}
                <Link
                  to="/register"
                  className={`transition-colors ${
                    isDark
                      ? 'text-purple-300 hover:text-purple-200'
                      : 'text-purple-600 hover:text-purple-500'
                  }`}
                >
                  Regístrate aquí
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className={`text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          QEB OOH Management Platform
        </p>
      </div>

      {/* Theme toggle */}
      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}
