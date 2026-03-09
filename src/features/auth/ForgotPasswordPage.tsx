import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../services/auth.service';
import { useThemeStore } from '../../store/themeStore';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';
import { ThemeToggle } from '../../components/ui/ThemeToggle';

type Step = 'email' | 'codigo' | 'password';

const emailSchema = z.object({ correo: z.string().email('Email inválido') });
const codigoSchema = z.object({ codigo: z.string().length(6, 'El código debe tener 6 dígitos') });
const passwordSchema = z.object({
  nuevaPassword: z.string().min(6, 'Mínimo 6 caracteres'),
  confirmar: z.string().min(1, 'Confirma tu contraseña'),
}).refine((d) => d.nuevaPassword === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
});

export function ForgotPasswordPage() {
  const isDark = useThemeStore((s) => s.theme === 'dark');
  const [step, setStep] = useState<Step>('email');
  const [correo, setCorreo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const emailForm = useForm({ resolver: zodResolver(emailSchema) });
  const codigoForm = useForm({ resolver: zodResolver(codigoSchema) });
  const passwordForm = useForm({ resolver: zodResolver(passwordSchema) });

  const inputCls = `focus:border-purple-500 focus:ring-purple-500/20 ${
    isDark
      ? 'bg-zinc-800/50 border-purple-500/20 text-white placeholder:text-zinc-500'
      : 'bg-gray-50 border-purple-200 text-gray-800 placeholder:text-gray-400'
  }`;

  const onSendEmail = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.forgotPassword(data.correo);
      setCorreo(data.correo);
      setStep('codigo');
    } catch {
      setError('Error al enviar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyCodigo = (data: any) => {
    // Solo avanzar, el código se verifica al cambiar la contraseña
    codigoForm.setValue('codigo', data.codigo);
    setStep('password');
  };

  const onResetPassword = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      await authService.resetPassword(correo, codigoForm.getValues('codigo'), data.nuevaPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Código inválido o expirado');
      setStep('codigo'); // Volver a pedir código si falla
    } finally {
      setIsLoading(false);
    }
  };

  const cardCls = `backdrop-blur-sm rounded-2xl p-8 border shadow-xl ${
    isDark
      ? 'bg-[#1a1025]/90 border-purple-900/30 shadow-purple-900/10'
      : 'bg-white/90 border-purple-200/50 shadow-purple-100/20'
  }`;

  const stepTitles = { email: 'Recuperar contraseña', codigo: 'Ingresa el código', password: 'Nueva contraseña' };
  const stepSubtitles = {
    email: 'Te enviaremos un código de 6 dígitos',
    codigo: `Código enviado a ${correo}`,
    password: 'Elige tu nueva contraseña',
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: isDark
          ? 'linear-gradient(to bottom right, #0f0a18, #1a1025, #0f0a18)'
          : 'linear-gradient(to bottom right, #ffffff, rgb(250 245 255 / 0.5), rgb(243 232 255 / 0.3))',
      }}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          {isDark
            ? <img src="/images/logo-bco.png" alt="QEB" className="h-20 w-auto" />
            : <img src="/images/logo-ooh.png" alt="QEB" className="h-20 w-auto" />}
        </div>

        <div className={cardCls}>
          <div className="text-center mb-8">
            <h1 className={`text-2xl font-light tracking-wide ${isDark ? 'text-white' : 'text-gray-800'}`}>
              {stepTitles[step]}
            </h1>
            <p className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
              {stepSubtitles[step]}
            </p>
          </div>

          {success ? (
            <div className={`p-4 text-sm rounded-lg text-center border ${
              isDark ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-green-600 bg-green-50 border-green-200'
            }`}>
              <p className="font-medium">Contraseña actualizada</p>
              <p className="mt-1">
                <Link to="/login" className={isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-600 hover:text-purple-500'}>
                  Iniciar sesión
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className={`p-3 text-sm rounded-lg border ${
                  isDark ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-red-600 bg-red-50 border-red-200'
                }`}>
                  {error}
                </div>
              )}

              {/* Paso 1: Email */}
              {step === 'email' && (
                <form onSubmit={emailForm.handleSubmit(onSendEmail)} className="space-y-5">
                  <div className="space-y-2">
                    <Label className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Correo electrónico</Label>
                    <Input type="email" placeholder="tu@email.com" {...emailForm.register('correo')}
                      className={`${inputCls} ${emailForm.formState.errors.correo ? 'border-red-500' : ''}`} />
                    {emailForm.formState.errors.correo && (
                      <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{emailForm.formState.errors.correo.message as string}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-light tracking-wide py-5" disabled={isLoading}>
                    {isLoading ? <><Spinner size="sm" className="mr-2" />Enviando...</> : 'Enviar código'}
                  </Button>
                </form>
              )}

              {/* Paso 2: Código */}
              {step === 'codigo' && (
                <form onSubmit={codigoForm.handleSubmit(onVerifyCodigo)} className="space-y-5">
                  <div className="space-y-2">
                    <Label className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Código de 6 dígitos</Label>
                    <Input type="text" placeholder="123456" maxLength={6} {...codigoForm.register('codigo')}
                      className={`${inputCls} text-center text-2xl tracking-widest ${codigoForm.formState.errors.codigo ? 'border-red-500' : ''}`} />
                    {codigoForm.formState.errors.codigo && (
                      <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{codigoForm.formState.errors.codigo.message as string}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-light tracking-wide py-5">
                    Verificar código
                  </Button>
                  <button type="button" onClick={() => onSendEmail({ correo })}
                    className={`w-full text-sm text-center ${isDark ? 'text-zinc-400 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-600'}`}>
                    Reenviar código
                  </button>
                </form>
              )}

              {/* Paso 3: Nueva contraseña */}
              {step === 'password' && (
                <form onSubmit={passwordForm.handleSubmit(onResetPassword)} className="space-y-5">
                  <div className="space-y-2">
                    <Label className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Nueva contraseña</Label>
                    <Input type="password" placeholder="Mínimo 6 caracteres" {...passwordForm.register('nuevaPassword')}
                      className={`${inputCls} ${passwordForm.formState.errors.nuevaPassword ? 'border-red-500' : ''}`} />
                    {passwordForm.formState.errors.nuevaPassword && (
                      <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{passwordForm.formState.errors.nuevaPassword.message as string}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Confirmar contraseña</Label>
                    <Input type="password" placeholder="Repite tu contraseña" {...passwordForm.register('confirmar')}
                      className={`${inputCls} ${passwordForm.formState.errors.confirmar ? 'border-red-500' : ''}`} />
                    {passwordForm.formState.errors.confirmar && (
                      <p className={`text-sm ${isDark ? 'text-red-400' : 'text-red-600'}`}>{passwordForm.formState.errors.confirmar.message as string}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-light tracking-wide py-5" disabled={isLoading}>
                    {isLoading ? <><Spinner size="sm" className="mr-2" />Guardando...</> : 'Cambiar contraseña'}
                  </Button>
                </form>
              )}

              <div className="text-center pt-2">
                <Link to="/login" className={`text-sm transition-colors ${isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-600 hover:text-purple-500'}`}>
                  Volver al inicio de sesión
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className={`text-center text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          QEB OOH Management Platform
        </p>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}