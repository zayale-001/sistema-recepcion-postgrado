export type RolUsuario = 'ADMINISTRADOR' | 'COORDINADOR' | 'REVISOR' | 'POSTULANTE';

export interface Persona {
  id_persona: string;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  nro_documento: string;
  correo: string;
  telefono?: string;
  fecha_registro: string;
}

export interface Usuario {
  id_usuario: string;
  id_persona?: string;
  nombre_usuario: string;
  rol: RolUsuario | string;
  activo: boolean;
  debe_cambiar_contrasena?: boolean;
  ultimo_acceso?: string;
  persona?: Persona;
}

export interface Area {
  id: number;
  nombre: string;
  slug: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  icono: string;
  orden: number;
  areas: Area[];
}

export interface CursoResumen {
  edicion_id: string; // id_convocatoria
  programa_nombre: string;
  categoria_nombre: string;
  version_edicion: string;
  gestion: string;
  fecha_fin?: string;
  dias_restantes?: number;
  estado_plazo: 'VIGENTE' | 'POR_VENCER' | 'VENCIDO';
  total_estudiantes: number;
  estudiantes_completos: number;
  estudiantes_faltantes: number;
  estudiantes_observados: number;
  estudiantes_aprobados: number;
  coordinador_encargado?: string;
}

export interface ReportePostulante {
  inscripcion_id: string;
  codigo_inscripcion: string;
  ci: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string;
  programa_nombre: string;
  categoria_nombre: string;
  gestion: string;
  estado_nombre: string;
  total_requisitos: number;
  requisitos_subidos: number;
  requisitos_aprobados: number;
  requisitos_observados: number;
  requisitos_faltantes: number;
  porcentaje_avance: number;
  fecha_solicitud?: string | null;
}

export interface EstudianteSeguimiento {
  inscripcion_id: string;
  id_persona: string;
  codigo_inscripcion: string;
  ci: string;
  nombres: string;
  apellidos: string;
  email: string;
  telefono?: string;
  estado_id: number;
  estado_nombre: string;
  total_requisitos: number;
  requisitos_subidos: number;
  requisitos_aprobados: number;
  requisitos_observados: number;
  requisitos_faltantes: number;
  requisitos_cotejados_fisico: number;
  porcentaje_avance: number;
  documentos_faltantes_nombres: string[];
}

export interface HistorialItem {
  id_historial: string;
  id_estado: number;
  estado_nombre?: string;
  fecha_cambio: string;
  comentario?: string;
  usuario_nombre?: string;
}

export interface HistorialDocumentoItem {
  id_historial: string;
  accion: string;
  nombre_archivo?: string;
  fecha_cambio: string;
  usuario_nombre?: string;
}

export interface DocumentoItem {
  id_documento: string;
  id_requisito: string;
  nombre_requisito: string;
  obligatorio: boolean;
  nombre_archivo?: string;
  ruta_archivo?: string;
  fecha_carga?: string;
  estado_revision: string; // 'Pendiente' | 'Válido' | 'Observado' | 'Rechazado'
  observaciones?: string;
  cotejado_fisico: boolean;
  fecha_cotejo_fisico?: string;
  cotejador_nombre?: string;
  historial?: HistorialDocumentoItem[];
}

export interface MiInscripcion {
  inscripcion_id: string;
  codigo_inscripcion: string;
  edicion_id: string;
  programa_nombre: string;
  categoria_nombre: string;
  version_edicion: string;
  gestion: string;
  estado_nombre: string;
  fecha_solicitud?: string;
  fecha_fin?: string;
  convocatoria_estado?: string;
}

export interface ConvocatoriaAbierta {
  id_convocatoria: string;
  id_programa: string;
  gestion: string;
  version: string;
  edicion: string;
  fecha_inicio: string;
  fecha_fin?: string;
  cupo: number;
  estado: string;
  titulo_completo: string;
}
