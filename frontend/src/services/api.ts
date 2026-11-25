import axios from 'axios';
import { Usuario, Categoria, Area, CursoResumen, EstudianteSeguimiento, DocumentoItem, MiInscripcion, ConvocatoriaAbierta, ReportePostulante } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const AuthService = {
  login: async (email_o_ci: string, password: string) => {
    const res = await api.post('/auth/login', { email_o_ci, password });
    localStorage.setItem('token', res.data.access_token);
    localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
    return res.data;
  },
  solicitarRecuperacion: async (email_o_ci: string) => {
    const res = await api.post('/auth/recuperar-contrasena', { email_o_ci });
    return res.data;
  },
  restablecerContrasena: async (token: string, nueva_contrasena: string) => {
    const res = await api.post('/auth/restablecer-contrasena', { token, nueva_contrasena });
    return res.data;
  },
  buscarPostulantesAdmin: async (buscar: string) => {
    const res = await api.get('/auth/admin/postulantes', { params: { buscar } });
    return res.data;
  },
  generarClaveTemporalPostulante: async (idUsuario: string) => {
    const res = await api.post(`/auth/admin/postulantes/${idUsuario}/clave-temporal`);
    return res.data;
  },
  listarSolicitudesRecuperacionAdmin: async () => {
    const res = await api.get('/auth/admin/solicitudes-recuperacion');
    return res.data;
  },
  resolverSolicitudRecuperacionAdmin: async (solicitudId: string) => {
    const res = await api.post(`/auth/admin/solicitudes-recuperacion/${solicitudId}/resolver`);
    return res.data;
  },
  cambiarContrasena: async (contrasena_actual: string, nueva_contrasena: string) => {
    const res = await api.post('/auth/cambiar-contrasena', { contrasena_actual, nueva_contrasena });
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  },
  getCurrentUser: (): Usuario | null => {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  },
  crearUsuario: async (datos: any) => {
    const res = await api.post('/auth/crear-usuario', datos);
    return res.data;
  }
};

export const SeguimientoService = {
  getMisCursos: async (): Promise<CursoResumen[]> => {
    const res = await api.get('/seguimiento/mis-cursos');
    return res.data;
  },
  getMiInscripcion: async (): Promise<MiInscripcion[]> => {
    const res = await api.get('/seguimiento/mi-inscripcion');
    return res.data;
  },
  getConvocatoriasAbiertas: async (categoriaId?: number, areaId?: number): Promise<ConvocatoriaAbierta[]> => {
    const res = await api.get('/seguimiento/convocatorias-abiertas', {
      params: { ...(categoriaId ? { categoria_id: categoriaId } : {}), ...(areaId ? { area_id: areaId } : {}) }
    });
    return res.data;
  },
  inscribirse: async (convocatoriaId: string) => {
    const res = await api.post(`/seguimiento/inscribirse/${convocatoriaId}`);
    return res.data;
  },
  getEstudiantesCurso: async (edicionId: string): Promise<EstudianteSeguimiento[]> => {
    const res = await api.get(`/seguimiento/curso/${edicionId}/estudiantes`);
    return res.data;
  },
  getExpedienteEstudiante: async (inscripcionId: string): Promise<DocumentoItem[]> => {
    const res = await api.get(`/seguimiento/inscripcion/${inscripcionId}/expediente`);
    return res.data;
  },
  validarDocumento: async (documentoId: string, estado_revision: string, observaciones?: string) => {
    const res = await api.post(`/seguimiento/documento/${documentoId}/validar`, { estado_revision, observaciones });
    return res.data;
  },
  marcarCotejoFisico: async (documentoId: string, cotejado: boolean) => {
    const res = await api.post(`/seguimiento/documento/${documentoId}/cotejo-fisico`, { cotejado });
    return res.data;
  },
  importarEstudiantes: async (edicionId: string, file: File) => {
    const formData = new FormData();
    formData.append('archivo', file);
    const res = await api.post(`/seguimiento/curso/${edicionId}/importar-estudiantes`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  plantillaExcelUrl: () => {
    return `${API_BASE_URL}/seguimiento/plantilla-estudiantes-excel`;
  },
  descargarExcel: async (edicionId: string) => {
    const res = await api.get(`/reportes/curso/${edicionId}/exportar-excel`, { responseType: 'blob' });
    descargarBlob(res.data, `seguimiento_${edicionId}.xlsx`);
  },
  descargarComprobantePdf: async (inscripcionId: string) => {
    const res = await api.get(`/reportes/inscripcion/${inscripcionId}/comprobante-pdf`, { responseType: 'blob' });
    descargarBlob(res.data, `comprobante_${inscripcionId}.pdf`);
  }
};

export const ReportesService = {
  obtenerResumenAdmin: async (): Promise<{ programas: CursoResumen[]; postulantes: ReportePostulante[] }> => {
    const res = await api.get('/reportes/admin/resumen');
    return res.data;
  },
  descargarReporteAdmin: async (params: { categoria?: string; gestion?: string; estado?: string; busqueda?: string }) => {
    const res = await api.get('/reportes/admin/exportar-excel', { params, responseType: 'blob' });
    descargarBlob(res.data, 'Reporte_General_Postulantes.xlsx');
  }
};

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nombre;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const DocumentosService = {
  subirDocumento: async (inscripcionId: string, requisitoId: string, file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('inscripcion_id', inscripcionId);
    formData.append('requisito_id', requisitoId);
    formData.append('archivo', file);
    const res = await api.post('/documentos/subir', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total) onProgress?.(Math.round((event.loaded * 100) / event.total));
      }
    });
    return res.data;
  },
  eliminarDocumento: async (documentoId: string) => {
    const res = await api.delete(`/documentos/${documentoId}`);
    return res.data;
  },
  obtenerDocumentoUrl: async (documentoId: string) => {
    const res = await api.get(`/documentos/ver/${documentoId}`, { responseType: 'blob' });
    return URL.createObjectURL(res.data);
  },
  abrirDocumento: async (documentoId: string) => {
    const tab = window.open('about:blank', '_blank');
    try {
      const url = await DocumentosService.obtenerDocumentoUrl(documentoId);
      if (tab) tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      throw error;
    }
  },
  descargarDocumento: async (documentoId: string, nombre: string) => {
    const res = await api.get(`/documentos/ver/${documentoId}`, { params: { descargar: true }, responseType: 'blob' });
    descargarBlob(res.data, nombre);
  }
};

export const CatalogosService = {
  getCategorias: async (): Promise<Categoria[]> => {
    const res = await api.get('/catalogos/categorias');
    return res.data;
  },
  getConvocatorias: async (): Promise<ConvocatoriaAbierta[]> => {
    const res = await api.get('/catalogos/convocatorias');
    return res.data;
  },
  actualizarConvocatoria: async (id: string, cambios: { estado?: string; cupo?: number; fecha_fin?: string | null }) => {
    const res = await api.patch(`/catalogos/convocatorias/${id}`, cambios);
    return res.data;
  },
  getAreas: async (categoriaId?: number): Promise<Area[]> => {
    const url = categoriaId ? `/catalogos/areas?categoria_id=${categoriaId}` : '/catalogos/areas';
    const res = await api.get(url);
    return res.data;
  },
  crearPrograma: async (datos: any) => {
    const res = await api.post('/catalogos/programas', datos);
    return res.data;
  },
  desactivarPrograma: async (programaId: string) => {
    const res = await api.delete(`/catalogos/programas/${programaId}`);
    return res.data;
  },
  getCoordinadores: async (): Promise<Usuario[]> => {
    const res = await api.get('/coordinadores/lista');
    return res.data;
  }
};
