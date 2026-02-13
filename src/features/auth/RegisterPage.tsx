import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../../services/auth.service';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Spinner } from '../../components/ui/spinner';

// Areas disponibles (sincronizado con UsuariosAdminPage)
const AREAS = [
  'Dirección',
  'Comercial',
  'Aeropuerto',
  'Tráfico',
  'Mercadotecnia',
  'Compras',
  'Operaciones',
  'Facturación',
] as const;

// Mapeo de puestos por área (sincronizado con UsuariosAdminPage)
const PUESTOS_POR_AREA: Record<string, string[]> = {
  'Dirección': [
    'Director General',
    'Director Comercial',
  ],
  'Comercial': [
    'Asesor Comercial',
    'Analista de Servicio al Cliente',
    'Jefe Digital Comercial',
    'Especialista de BI',
    'Director de Desarrollo Digital',
  ],
  'Aeropuerto': [
    'Director Comercial Aeropuerto',
    'Gerente Comercial Aeropuerto',
    'Asesor Comercial Aeropuerto',
    'Analista de Aeropuerto',
  ],
  'Tráfico': [
    'Gerente de Tráfico',
    'Coordinador de tráfico',
    'Especialista de tráfico',
    'Auxiliar de tráfico',
  ],
  'Mercadotecnia': [
    'Coordinador de Diseño',
    'Diseñadores',
  ],
  'Compras': [
    'Compradores',
  ],
  'Operaciones': [
    'Director de Operaciones',
    'Call Center CON',
    'Gerente de Operaciones CON',
    'Jefe de Operaciones Digital',
    'Gerente Digital (Operaciones)',
    'Gerentes de Operaciones Plazas (GDL y MTY)',
    'Jefes de Operaciones Plazas',
    'Supervisores de Operaciones',
  ],
  'Facturación': [
    'Coordinador de Facturación y Cobranza',
    'Mesa de Control',
    'Analista de Facturación y Cobranza',
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
      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img
            src="/images/logo-fondo-negro.png"
            alt="QEB OOH Management"
            className="h-32 w-auto"
          />
        </div>

        {/* Form Card */}
        <div className="bg-zinc-900/80 backdrop-blur-sm rounded-2xl p-8 border border-zinc-800">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light text-white tracking-wide">Crear cuenta</h1>
            <p className="text-zinc-400 text-sm mt-2">Completa tus datos para registrarte</p>
          </div>

          {success ? (
            <div className="p-4 text-sm text-green-400 bg-green-900/30 border border-green-800 rounded-lg text-center">
              <p className="font-medium">Registro exitoso</p>
              <p className="mt-1">Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-lg">
                  {error}
                </div>
              )}

              {/* Nombre */}
              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-zinc-300 text-sm font-light">Nombre completo</Label>
                <Input
                  id="nombre"
                  type="text"
                  placeholder="Tu nombre completo"
                  {...register('nombre')}
                  className={`bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:ring-purple-500/20 ${errors.nombre ? 'border-red-500' : ''}`}
                />
                {errors.nombre && (
                  <p className="text-sm text-red-400">{errors.nombre.message}</p>
                )}
              </div>

              {/* Correo */}
              <div className="space-y-2">
                <Label htmlFor="correo" className="text-zinc-300 text-sm font-light">Correo electrónico</Label>
                <Input
                  id="correo"
                  type="email"
                  placeholder="tu@email.com"
                  {...register('correo')}
                  className={`bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:ring-purple-500/20 ${errors.correo ? 'border-red-500' : ''}`}
                />
                {errors.correo && (
                  <p className="text-sm text-red-400">{errors.correo.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300 text-sm font-light">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  {...register('password')}
                  className={`bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:ring-purple-500/20 ${errors.password ? 'border-red-500' : ''}`}
                />
                {errors.password && (
                  <p className="text-sm text-red-400">{errors.password.message}</p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-zinc-300 text-sm font-light">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  {...register('confirmPassword')}
                  className={`bg-zinc-800/50 border-zinc-700 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:ring-purple-500/20 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-400">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Area */}
              <div className="space-y-2">
                <Label htmlFor="area" className="text-zinc-300 text-sm font-light">Área</Label>
                <select
                  id="area"
                  {...register('area')}
                  className={`w-full h-10 px-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-white focus:border-purple-500 focus:ring-purple-500/20 focus:outline-none ${errors.area ? 'border-red-500' : ''}`}
                >
                  <option value="" className="bg-zinc-800">Selecciona un área</option>
                  {AREAS.map((area) => (
                    <option key={area} value={area} className="bg-zinc-800">{area}</option>
                  ))}
                </select>
                {errors.area && (
                  <p className="text-sm text-red-400">{errors.area.message}</p>
                )}
              </div>

              {/* Puesto */}
              <div className="space-y-2">
                <Label htmlFor="puesto" className="text-zinc-300 text-sm font-light">Puesto</Label>
                <select
                  id="puesto"
                  {...register('puesto')}
                  disabled={!selectedArea || puestosDisponibles.length === 0}
                  className={`w-full h-10 px-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-white focus:border-purple-500 focus:ring-purple-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${errors.puesto ? 'border-red-500' : ''}`}
                >
                  <option value="" className="bg-zinc-800">
                    {!selectedArea ? 'Primero selecciona un área' : puestosDisponibles.length === 0 ? 'Sin puestos disponibles' : 'Selecciona un puesto'}
                  </option>
                  {puestosDisponibles.map((puesto) => (
                    <option key={puesto} value={puesto} className="bg-zinc-800">{puesto}</option>
                  ))}
                </select>
                {errors.puesto && (
                  <p className="text-sm text-red-400">{errors.puesto.message}</p>
                )}
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
                <p className="text-zinc-400 text-sm">
                  ¿Ya tienes cuenta?{' '}
                  <Link to="/login" className="text-purple-400 hover:text-purple-300 transition-colors">
                    Inicia sesión aquí
                  </Link>
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs">
          QEB OOH Management Platform
        </p>
      </div>
    </div>
  );
}
