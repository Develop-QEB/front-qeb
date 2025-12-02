// Usuario - basado en tabla 'usuario'
export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  area: string;
  puesto: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Cliente - basado en tabla 'cliente' (estructura SAP)
export interface Cliente {
  id: number;
  CUIC: number | null;
  T0_U_IDAsesor: number | null;
  T0_U_Asesor: string | null;
  T0_U_IDAgencia: number | null;
  T0_U_Agencia: string | null;
  T0_U_Cliente: string | null;
  T0_U_RazonSocial: string | null;
  T0_U_IDACA: number | null;
  T1_U_Cliente: string | null;
  T1_U_IDACA: number | null;
  T1_U_IDCM: number | null;
  T1_U_IDMarca: number | null;
  T1_U_UnidadNegocio: string | null;
  T1_U_ValidFrom: string | null;
  T1_U_ValidTo: string | null;
  T2_U_IDCategoria: number | null;
  T2_U_Categoria: string | null;
  T2_U_IDCM: number | null;
  T2_U_IDProducto: number | null;
  T2_U_Marca: string | null;
  T2_U_Producto: string | null;
  T2_U_ValidFrom: string | null;
  T2_U_ValidTo: string | null;
}

// Proveedor - basado en tabla 'proveedores'
export interface Proveedor {
  id: number;
  nombre: string;
  direccion: string | null;
  ciudad: string | null;
  codigo_postal: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  contacto_principal: string | null;
  categoria: string | null;
  fecha_alta: string | null;
  estado: 'activo' | 'inactivo' | null;
  notas: string | null;
  deleted_at: string | null;
}

// Inventario - basado en tabla 'inventarios'
export interface Inventario {
  id: number;
  codigo_unico: string | null;
  ubicacion: string | null;
  tipo_de_cara: string | null;
  cara: string | null;
  mueble: string | null;
  latitud: number;
  longitud: number;
  plaza: string | null;
  estado: string | null;
  municipio: string | null;
  cp: number | null;
  tradicional_digital: string | null;
  sentido: string | null;
  tipo_de_mueble: string | null;
  ancho: number;
  alto: number;
  archivos_id: number | null;
  nivel_socioeconomico: string | null;
  total_espacios: number | null;
  tiempo: number | null;
  estatus: string | null;
  codigo: string | null;
  isla: string | null;
  mueble_isla: string | null;
  entre_calle_1: string | null;
  entre_calle_2: string | null;
  orientacion: string | null;
  tarifa_piso: number | null;
  tarifa_publica: number | null;
}

// Inventario para mapa (campos reducidos)
export interface InventarioMapItem {
  id: number;
  codigo_unico: string | null;
  ubicacion: string | null;
  tipo_de_mueble: string | null;
  tipo_de_cara: string | null;
  cara: string | null;
  latitud: number;
  longitud: number;
  plaza: string | null;
  estado: string | null;
  municipio: string | null;
  estatus: string | null;
  tarifa_publica: number | null;
  tradicional_digital: string | null;
  ancho: number;
  alto: number;
}

export interface InventarioStats {
  total: number;
  disponibles: number;
  ocupados: number;
  mantenimiento: number;
  porTipo: { tipo: string; cantidad: number }[];
  porPlaza: { plaza: string; cantidad: number }[];
}

// Solicitud - basado en tabla 'solicitud'
export interface Solicitud {
  id: number;
  fecha: string;
  descripcion: string;
  presupuesto: number;
  notas: string;
  cliente_id: number;
  usuario_id: number | null;
  status: string;
  deleted_at: string | null;
  nombre_usuario: string | null;
  asignado: string;
  id_asignado: string | null;
  cuic: string | null;
  razon_social: string | null;
  unidad_negocio: string | null;
  marca_id: number | null;
  marca_nombre: string | null;
  asesor: string | null;
  producto_id: number | null;
  producto_nombre: string | null;
  agencia: string | null;
  categoria_id: number | null;
  categoria_nombre: string | null;
  IMU: number;
  archivo: string | null;
  tipo_archivo: string | null;
}

export interface SolicitudStats {
  total: number;
  byStatus: Record<string, number>;
}

// Propuesta - basado en tabla 'propuesta'
export interface Propuesta {
  id: number;
  cliente_id: number;
  fecha: string;
  status: string;
  descripcion: string | null;
  precio: number | null;
  notas: string | null;
  deleted_at: string | null;
  solicitud_id: number;
  precio_simulado: number | null;
  asignado: string;
  id_asignado: string | null;
  inversion: number;
  comentario_cambio_status: string;
  articulo: string;
  updated_at: string | null;
}

export interface PropuestaStats {
  total: number;
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
}

// Campana - basado en tabla 'campania'
export interface Campana {
  id: number;
  cliente_id: number;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  total_caras: string;
  bonificacion: number;
  status: string;
  cotizacion_id: number | null;
  articulo: string;
}

export interface CampanaStats {
  total: number;
  activas: number;
  inactivas: number;
}

// Catorcena - basado en tabla 'catorcenas'
export interface Catorcena {
  id: number;
  a_o: number;
  numero_catorcena: number;
  fecha_inicio: string;
  fecha_fin: string;
}
