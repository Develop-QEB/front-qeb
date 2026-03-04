import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

// Areas disponibles (sincronizado con UsuariosAdminPage)
const AREAS = [
  'Dirección General',
  'Comercial',
  'Dirección Comercial Aeropuerto',
  'Departamento de Tráfico',
  'Dirección de Mercadotecnia',
  'Compras',
  'Operaciones',
  'Facturación',
  'Mejora Continua',
  'TI',
] as const;

// Mapeo de puestos por área (sincronizado con UsuariosAdminPage)
const PUESTOS_POR_AREA: Record<string, string[]> = {
  'Dirección General': [
    'Director General',
  ],
  'Comercial': [
    'Director Comercial',
    'Asesor Comercial',
    'Analista de Servicio al Cliente',
    'Jefe Digital Comercial',
    'Especialista de BI',
  ],
  'Dirección Comercial Aeropuerto': [
    'Director Comercial Aeropuerto',
    'Gerente Comercial Aeropuerto',
    'Asesor Comercial (Aeropuerto)',
    'Analista de Aeropuerto',
  ],
  'Departamento de Tráfico': [
    'Gerente de Tráfico',
    'Coordinador de tráfico',
    'Especialista de tráfico',
    'Auxiliar de tráfico',
  ],
  'Dirección de Mercadotecnia': [
    'Coordinador de Diseño',
    'Diseñadores',
  ],
  'Compras': [
    'Compradores',
  ],
  'Operaciones': [
    'Call Center (CON)',
    'Director de Operaciones',
    'Gerente de Operaciones CON',
    'Gerentes de Operaciones Plazas (GDL y MTY)',
    'Jefes de Operaciones Plazas',
    'Gerente Digital (Operaciones)',
    'Jefe de Operaciones Digital',
  ],
  'Facturación': [
    'Coordinador de Facturación y Cobranza',
    'Mesa de Control',
    'Analista de Facturación y Cobranza',
  ],
  'Mejora Continua': [
    'Mejora Continua',
  ],
  'TI': [
    'TI',
  ],
};

// Función para obtener puestos según área
const getPuestosPorArea = (area: string): string[] => {
  return PUESTOS_POR_AREA[area] || [];
};

const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  correo: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
  area: z.string().min(1, 'Selecciona un área'),
  puesto: z.string().min(1, 'Selecciona un puesto'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedArea, setSelectedArea] = useState('');
  const [puestosDisponibles, setPuestosDisponibles] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const areaValue = watch('area');

  // Actualizar puestos cuando cambia el área
  useEffect(() => {
    if (areaValue && areaValue !== selectedArea) {
      setSelectedArea(areaValue);
      const puestos = getPuestosPorArea(areaValue);
      setPuestosDisponibles(puestos);
      setValue('puesto', ''); // Resetear puesto cuando cambia el área
    }
  }, [areaValue, selectedArea, setValue]);

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError(null);

    try {
      await authService.register({
        nombre: data.nombre,
        correo: data.correo,
        password: data.password,
        area: data.area,
        puesto: data.puesto,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const inputCls = `focus:border-purple-500 focus:ring-purple-500/20 ${
    isDark
      ? 'bg-zinc-800/50 border-purple-500/20 text-white placeholder:text-zinc-500'
      : 'bg-gray-50 border-purple-200 text-gray-800 placeholder:text-gray-400'
  }`;

  const selectCls = `w-full h-10 px-3 rounded-md border focus:border-purple-500 focus:ring-purple-500/20 focus:outline-none ${
    isDark
      ? 'bg-zinc-800/50 border-purple-500/20 text-white'
      : 'bg-gray-50 border-purple-200 text-gray-800'
  }`;

  const optionCls = isDark ? 'bg-zinc-800' : 'bg-white';

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
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
            <img src="/images/logo-bco.png" alt="QEB OOH Management" className="h-20 w-auto" />
          ) : (
            <img src="/images/logo-ooh.png" alt="QEB OOH Management" className="h-20 w-auto" />
          )}
        </div>

        {/* Form Card */}
        <div className={`backdrop-blur-sm rounded-2xl p-8 border shadow-xl ${
          isDark
            ? 'bg-[#1a1025]/90 border-purple-900/30 shadow-purple-900/10'
            : 'bg-white/90 border-purple-200/50 shadow-purple-100/20'
        }`}>
          <div className="text-center mb-8">
            <h1 className={`text-2xl font-light tracking-wide ${isDark ? 'text-white' : 'text-gray-800'}`}>Crear cuenta</h1>
            <p className={`text-sm mt-2 ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Completa tus datos para registrarte</p>
          </div>

          {success ? (
            <div className={`p-4 text-sm rounded-lg text-center border ${
              isDark
                ? 'text-green-400 bg-green-500/10 border-green-500/30'
                : 'text-green-600 bg-green-50 border-green-200'
            }`}>
              <p className="font-medium">Registro exitoso</p>
              <p className="mt-1">Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className={`p-3 text-sm rounded-lg border ${
                  isDark
                    ? 'text-red-400 bg-red-500/10 border-red-500/30'
                    : 'text-red-600 bg-red-50 border-red-200'
                }`}>
                  {error}
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="nombre" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Nombre completo</Label>
                <Input id="nombre" type="text" placeholder="Tu nombre completo" {...register('nombre')} className={`${inputCls} ${errors.nombre ? 'border-red-500' : ''}`} />
                {errors.nombre && <p className="text-sm text-red-400">{errors.nombre.message}</p>}
              </div>

              {/* Correo */}
              <div className="space-y-2">
                <Label htmlFor="correo" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Correo electrónico</Label>
                <Input id="correo" type="email" placeholder="tu@email.com" {...register('correo')} className={`${inputCls} ${errors.correo ? 'border-red-500' : ''}`} />
                {errors.correo && <p className="text-sm text-red-400">{errors.correo.message}</p>}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Contraseña</Label>
                <Input id="password" type="password" placeholder="Mínimo 6 caracteres" {...register('password')} className={`${inputCls} ${errors.password ? 'border-red-500' : ''}`} />
                {errors.password && <p className="text-sm text-red-400">{errors.password.message}</p>}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Confirmar contraseña</Label>
                <Input id="confirmPassword" type="password" placeholder="Repite tu contraseña" {...register('confirmPassword')} className={`${inputCls} ${errors.confirmPassword ? 'border-red-500' : ''}`} />
                {errors.confirmPassword && <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>}
              </div>

              {/* Area */}
              <div className="space-y-2">
                <Label htmlFor="area" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Área</Label>
                <select id="area" {...register('area')} className={`${selectCls} ${errors.area ? 'border-red-500' : ''}`}>
                  <option value="" className={optionCls}>Selecciona un área</option>
                  {AREAS.map((area) => (
                    <option key={area} value={area} className={optionCls}>{area}</option>
                  ))}
                </select>
                {errors.area && <p className="text-sm text-red-400">{errors.area.message}</p>}
              </div>

              {/* Puesto */}
              <div className="space-y-2">
                <Label htmlFor="puesto" className={`text-sm font-light ${isDark ? 'text-zinc-300' : 'text-gray-600'}`}>Puesto</Label>
                <select
                  id="puesto"
                  {...register('puesto')}
                  disabled={!selectedArea || puestosDisponibles.length === 0}
                  className={`${selectCls} disabled:opacity-50 disabled:cursor-not-allowed ${errors.puesto ? 'border-red-500' : ''}`}
                >
                  <option value="" className={optionCls}>
                    {!selectedArea ? 'Primero selecciona un área' : puestosDisponibles.length === 0 ? 'Sin puestos disponibles' : 'Selecciona un puesto'}
                  </option>
                  {puestosDisponibles.map((puesto) => (
                    <option key={puesto} value={puesto} className={optionCls}>{puesto}</option>
                  ))}
                </select>
                {errors.puesto && <p className="text-sm text-red-400">{errors.puesto.message}</p>}
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-light tracking-wide py-5"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Registrando...
                  </>
                ) : (
                  'Registrarse'
                )}
              </Button>

              {/* Link to login */}
              <div className="text-center">
                <p className={`text-sm ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                  ¿Ya tienes cuenta?{' '}
                  <Link to="/login" className={`transition-colors ${isDark ? 'text-purple-300 hover:text-purple-200' : 'text-purple-600 hover:text-purple-500'}`}>
                    Inicia sesión aquí
                  </Link>
                </p>
              </div>
            </form>
          )}
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
