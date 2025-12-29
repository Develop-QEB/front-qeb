import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Mail, Briefcase, Building2, Lock, Save, Eye, EyeOff, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Base URL for static files (without /api)
const STATIC_URL = API_URL.replace(/\/api$/, '');

export function PerfilPage() {
  const queryClient = useQueryClient();
  const { user: storeUser, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados del formulario de perfil
  const [profileForm, setProfileForm] = useState({
    nombre: '',
    area: '',
    puesto: '',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estados del formulario de contraseña
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Estados de feedback
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Query para obtener perfil
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authService.getProfile(),
  });

  // Actualizar formulario cuando se cargan los datos
  useEffect(() => {
    if (profile) {
      setProfileForm({
        nombre: profile.nombre || '',
        area: profile.area || '',
        puesto: profile.puesto || '',
      });
    }
  }, [profile]);

  // Mutation para actualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: authService.updateProfile,
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setUser(updatedUser);
      setIsEditingProfile(false);
      setProfileMessage({ type: 'success', text: 'Perfil actualizado correctamente' });
      setTimeout(() => setProfileMessage(null), 3000);
    },
    onError: (error: Error) => {
      setProfileMessage({ type: 'error', text: error.message });
      setTimeout(() => setProfileMessage(null), 5000);
    },
  });

  // Mutation para cambiar contraseña
  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      authService.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage({ type: 'success', text: 'Contraseña actualizada correctamente' });
      setTimeout(() => setPasswordMessage(null), 3000);
    },
    onError: (error: Error) => {
      setPasswordMessage({ type: 'error', text: error.message });
      setTimeout(() => setPasswordMessage(null), 5000);
    },
  });

  // Mutation para subir foto
  const uploadPhotoMutation = useMutation({
    mutationFn: authService.uploadPhoto,
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      setUser(updatedUser);
      setPhotoMessage({ type: 'success', text: 'Foto actualizada correctamente' });
      setTimeout(() => setPhotoMessage(null), 3000);
    },
    onError: (error: Error) => {
      setPhotoMessage({ type: 'error', text: error.message });
      setTimeout(() => setPhotoMessage(null), 5000);
    },
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setPhotoMessage({ type: 'error', text: 'La imagen no debe superar los 5MB' });
        setTimeout(() => setPhotoMessage(null), 5000);
        return;
      }
      uploadPhotoMutation.mutate(file);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      setTimeout(() => setPasswordMessage(null), 5000);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres' });
      setTimeout(() => setPasswordMessage(null), 5000);
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const cancelProfileEdit = () => {
    setIsEditingProfile(false);
    if (profile) {
      setProfileForm({
        nombre: profile.nombre || '',
        area: profile.area || '',
        puesto: profile.puesto || '',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#0f0a15]">
        <Header title="Mi Perfil" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0f0a15]">
      <Header title="Mi Perfil" />

      <div className="flex-1 p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Avatar y nombre */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6">
            {photoMessage && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                photoMessage.type === 'success'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {photoMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {photoMessage.text}
              </div>
            )}
            <div className="flex items-center gap-6">
              {/* Foto de perfil con opción de cambiar */}
              <div className="relative group">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  className="hidden"
                />
                {profile?.foto_perfil ? (
                  <img
                    src={`${STATIC_URL}${profile.foto_perfil}`}
                    alt="Foto de perfil"
                    className="h-20 w-20 rounded-full object-cover shadow-lg shadow-purple-500/20"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-3xl font-medium shadow-lg shadow-purple-500/20">
                    {profile?.nombre?.charAt(0) || storeUser?.nombre?.charAt(0) || 'U'}
                  </div>
                )}
                {/* Overlay para cambiar foto */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadPhotoMutation.isPending}
                  className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
                >
                  {uploadPhotoMutation.isPending ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </button>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">
                  {profile?.nombre || storeUser?.nombre}
                </h2>
                <p className="text-zinc-400 flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4" />
                  {profile?.email || storeUser?.email}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium">
                    {profile?.rol || storeUser?.rol || 'Usuario'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Información del perfil */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-white flex items-center gap-2">
                <User className="h-5 w-5 text-purple-400" />
                Información Personal
              </h3>
              {!isEditingProfile && (
                <button
                  onClick={() => setIsEditingProfile(true)}
                  className="px-4 py-2 text-sm rounded-lg bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 transition-colors"
                >
                  Editar
                </button>
              )}
            </div>

            {profileMessage && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                profileMessage.type === 'success'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {profileMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {profileMessage.text}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400 flex items-center gap-2">
                  <User className="h-4 w-4" /> Nombre
                </label>
                <input
                  type="text"
                  value={profileForm.nombre}
                  onChange={(e) => setProfileForm({ ...profileForm, nombre: e.target.value })}
                  disabled={!isEditingProfile}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400 flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Área
                  </label>
                  <input
                    type="text"
                    value={profileForm.area}
                    onChange={(e) => setProfileForm({ ...profileForm, area: e.target.value })}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400 flex items-center gap-2">
                    <Briefcase className="h-4 w-4" /> Puesto
                  </label>
                  <input
                    type="text"
                    value={profileForm.puesto}
                    onChange={(e) => setProfileForm({ ...profileForm, puesto: e.target.value })}
                    disabled={!isEditingProfile}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {isEditingProfile && (
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={cancelProfileEdit}
                    className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {updateProfileMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Cambiar contraseña */}
          <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-6">
            <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-6">
              <Lock className="h-5 w-5 text-purple-400" />
              Cambiar Contraseña
            </h3>

            {passwordMessage && (
              <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
                passwordMessage.type === 'success'
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border border-red-500/30'
              }`}>
                {passwordMessage.type === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {passwordMessage.text}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Contraseña Actual</label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
                    placeholder="Ingresa tu contraseña actual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPasswords.current ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPasswords.new ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Confirmar Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
                      placeholder="Repite la nueva contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPasswords.confirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={changePasswordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="h-4 w-4" />
                  {changePasswordMutation.isPending ? 'Cambiando...' : 'Cambiar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
