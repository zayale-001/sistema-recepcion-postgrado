import React, { useState, useEffect } from 'react';
import { CursoResumen, EstudianteSeguimiento } from '../types';
import { SeguimientoService } from '../services/api';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Eye, 
  MessageSquare,
  Upload,
  Download,
  FileCheck,
  Stamp,
  Calendar,
  X
} from 'lucide-react';

interface SeguimientoCursoProps {
  curso: CursoResumen;
  onVolver: () => void;
  onVerExpediente: (estudiante: EstudianteSeguimiento) => void;
}

export const SeguimientoCurso: React.FC<SeguimientoCursoProps> = ({ 
  curso, 
  onVolver, 
  onVerExpediente 
}) => {
  const [estudiantes, setEstudiantes] = useState<EstudianteSeguimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Estado para modal de importación masiva Excel
  const [modalImportar, setModalImportar] = useState(false);
  const [archivoImportar, setArchivoImportar] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState<string | null>(null);

  useEffect(() => {
    cargarEstudiantes();
  }, [curso.edicion_id]);

  const cargarEstudiantes = async () => {
    try {
      setLoading(true);
      const data = await SeguimientoService.getEstudiantesCurso(curso.edicion_id);
      setEstudiantes(data);
    } catch (err) {
      console.error('Error al cargar seguimiento de estudiantes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportarExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivoImportar) return;

    try {
      setImportando(true);
      const res = await SeguimientoService.importarEstudiantes(curso.edicion_id, archivoImportar);
      setResultadoImportacion(`¡Éxito! Se importaron ${res.estudiantes_importados} nuevos postulantes.`);
      setArchivoImportar(null);
      await cargarEstudiantes();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Error al importar archivo Excel.');
    } finally {
      setImportando(false);
    }
  };

  // Generador de enlace WhatsApp directo
  const generarEnlaceWhatsApp = (est: EstudianteSeguimiento) => {
    let telefono = (est.telefono || '').replace(/\D/g, '');
    if (!telefono) return null;
    if (telefono.length === 8) {
      telefono = `591${telefono}`; // Código de país Bolivia
    }

    const faltantesTexto = est.documentos_faltantes_nombres.join(', ');
    const mensaje = encodeURIComponent(
      `Estimado(a) ${est.nombres} ${est.apellidos}, le saludamos desde la Coordinación de Postgrado (${curso.programa_nombre}). Le recordamos que tiene pendiente la entrega de los siguientes requisitos documentales:\n\n*${faltantesTexto}*\n\nPor favor súbalos al sistema a la brevedad para completar su habilitación.`
    );

    return `https://wa.me/${telefono}?text=${mensaje}`;
  };

  // Filtrado
  const estudiantesFiltrados = estudiantes.filter((est) => {
    const matchBusqueda = 
      est.nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
      est.apellidos.toLowerCase().includes(busqueda.toLowerCase()) ||
      est.ci.includes(busqueda);

    if (!matchBusqueda) return false;

    if (filtroEstado === 'faltantes') {
      return est.requisitos_faltantes > 0;
    }
    if (filtroEstado === 'completos') {
      return est.estado_expediente === 'COMPLETO' || est.estado_expediente === 'APROBADO';
    }
    if (filtroEstado === 'observados') {
      return est.estado_expediente === 'OBSERVADO';
    }
    if (filtroEstado === 'aprobados') {
      return est.estado_expediente === 'APROBADO';
    }

    return true;
  });

  const getBadgeEstado = (estado: string) => {
    switch (estado) {
      case 'APROBADO':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Aprobado</span>;
      case 'COMPLETO':
        return <span className="badge badge-info"><CheckCircle2 size={12} /> Completo</span>;
      case 'OBSERVADO':
        return <span className="badge badge-danger"><AlertTriangle size={12} /> Observado</span>;
      case 'INCOMPLETO':
        return <span className="badge badge-warning"><Clock size={12} /> Incompleto</span>;
      default:
        return <span className="badge badge-neutral">Sin Subir</span>;
    }
  };

  return (
    <div>
      {/* Cabecera y Volver */}
      <div style={{ marginBottom: '20px' }}>
        <button onClick={onVolver} className="btn btn-outline btn-sm" style={{ marginBottom: '12px' }}>
          <ArrowLeft size={16} />
          <span>Volver al listado de programas</span>
        </button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <span className="badge badge-info">{curso.categoria_nombre}</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{curso.version_edicion} • Gestión {curso.gestion}</span>

              {/* Semáforo de Plazos */}
              {curso.estado_plazo === 'VIGENTE' && (
                <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> Convocatoria Vigente
                </span>
              )}
              {curso.estado_plazo === 'POR_VENCER' && (
                <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} /> Cierra en {curso.dias_restantes} días
                </span>
              )}
              {curso.estado_plazo === 'VENCIDO' && (
                <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> Convocatoria Cerrada
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>
              {curso.programa_nombre}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2px' }}>
              Coordinador Encargado: <strong>{curso.coordinador_encargado || 'Sin Asignar'}</strong>
            </p>
          </div>

          {/* Acciones Superiores */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setModalImportar(true)} className="btn btn-outline">
              <Upload size={16} />
              <span>Importar Estudiantes (Excel)</span>
            </button>

            <button type="button" onClick={() => SeguimientoService.descargarExcel(curso.edicion_id)} className="btn btn-success">
              <FileSpreadsheet size={18} />
              <span>Exportar Matriz a Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros Rápidos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFiltroEstado('todos')}
            className={`btn btn-sm ${filtroEstado === 'todos' ? 'btn-primary' : 'btn-outline'}`}
          >
            Todos ({estudiantes.length})
          </button>
          <button
            onClick={() => setFiltroEstado('faltantes')}
            className={`btn btn-sm ${filtroEstado === 'faltantes' ? 'btn-primary' : 'btn-outline'}`}
            style={{ color: filtroEstado === 'faltantes' ? 'white' : '#ca8a04' }}
          >
            <Clock size={14} />
            <span>Faltan Documentos ({estudiantes.filter(e => e.requisitos_faltantes > 0).length})</span>
          </button>
          <button
            onClick={() => setFiltroEstado('completos')}
            className={`btn btn-sm ${filtroEstado === 'completos' ? 'btn-primary' : 'btn-outline'}`}
            style={{ color: filtroEstado === 'completos' ? 'white' : '#c51d25' }}
          >
            <CheckCircle2 size={14} />
            <span>Completos ({estudiantes.filter(e => e.estado_expediente === 'COMPLETO' || e.estado_expediente === 'APROBADO').length})</span>
          </button>
          <button
            onClick={() => setFiltroEstado('observados')}
            className={`btn btn-sm ${filtroEstado === 'observados' ? 'btn-primary' : 'btn-outline'}`}
            style={{ color: filtroEstado === 'observados' ? 'white' : '#dc2626' }}
          >
            <AlertTriangle size={14} />
            <span>Observados ({estudiantes.filter(e => e.estado_expediente === 'OBSERVADO').length})</span>
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            placeholder="Buscar por C.I. o apellidos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
        </div>
      </div>

      {/* Tabla Principal */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>N°</th>
              <th style={{ width: '110px' }}>C.I.</th>
              <th>Postulante / Maestrante</th>
              <th style={{ width: '180px' }}>Avance Digital</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Cotejo Físico</th>
              <th style={{ width: '130px' }}>Estado</th>
              <th>Documentos Faltantes</th>
              <th style={{ width: '180px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Cargando postulantes y seguimiento...
                </td>
              </tr>
            ) : estudiantesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  No hay maestrantes en este filtro.
                </td>
              </tr>
            ) : (
              estudiantesFiltrados.map((est, idx) => {
                const whatsappUrl = generarEnlaceWhatsApp(est);

                return (
                  <tr key={est.inscripcion_id}>
                    <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#c51d25' }}>{est.ci}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{est.apellidos}, {est.nombres}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{est.email} • Tel: {est.telefono || 'S/N'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 600 }}>{est.requisitos_subidos} de {est.total_requisitos}</span>
                        <span>{est.porcentaje_avance}%</span>
                      </div>
                      <div className="progress-container">
                        <div 
                          className="progress-bar"
                          style={{
                            width: `${est.porcentaje_avance}%`,
                            background: est.porcentaje_avance === 100 ? '#16a34a' : '#c51d25'
                          }}
                        />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: est.requisitos_cotejados_fisico === est.total_requisitos ? '#16a34a' : '#64748b' }}>
                        <Stamp size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                        {est.requisitos_cotejados_fisico}/{est.total_requisitos}
                      </span>
                    </td>
                    <td>{getBadgeEstado(est.estado_expediente)}</td>
                    <td>
                      {est.documentos_faltantes_nombres.length === 0 ? (
                        <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> Todo entregado
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {est.documentos_faltantes_nombres.map((docNombre, i) => (
                            <span 
                              key={i} 
                              style={{
                                fontSize: '0.72rem',
                                background: '#fff1f2',
                                color: '#e11d48',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                border: '1px solid #ffe4e6'
                              }}
                            >
                              • {docNombre}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => onVerExpediente(est)}
                          className="btn btn-outline btn-sm"
                          title="Revisar expediente en Split-View"
                        >
                          <Eye size={13} />
                          <span>Revisar</span>
                        </button>

                        {/* Botón WhatsApp de 1 Clic si tiene faltantes */}
                        {est.requisitos_faltantes > 0 && whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{ background: '#25D366', color: 'white', padding: '6px 8px' }}
                            title="Enviar recordatorio por WhatsApp de requisitos faltantes"
                          >
                            <MessageSquare size={14} />
                          </a>
                        )}

                        {/* Botón Comprobante PDF si está habilitado */}
                        {(est.estado_expediente === 'COMPLETO' || est.estado_expediente === 'APROBADO') && (
                          <button type="button" onClick={() => SeguimientoService.descargarComprobantePdf(est.inscripcion_id)} className="btn btn-sm" style={{ background: '#c51d25', color: 'white', padding: '6px 8px' }} title="Descargar Boleta Oficial de Conformidad Documental (PDF)">
                            <FileCheck size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE IMPORTACIÓN MASIVA EXCEL */}
      {modalImportar && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Importar Estudiantes desde Excel</h2>
              <button onClick={() => setModalImportar(false)} className="btn btn-outline btn-sm" style={{ padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleImportarExcel}>
              <div className="modal-body">
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '14px' }}>
                  Carga la lista de estudiantes inscritos. El sistema creará sus cuentas automáticamente y generará sus carpetas de expediente para este programa.
                </p>

                <div className="import-access-note">
                  Las cuentas nuevas pueden ingresar con el CI o correo del Excel y la clave inicial <strong>estudiante123</strong>. Las cuentas existentes conservan sus credenciales. Cada postulante verá solo su propio expediente.
                </div>

                <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#c51d25', marginBottom: '4px' }}>
                    ¿No tienes el formato?
                  </div>
                  <a
                    href={SeguimientoService.plantillaExcelUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    <Download size={14} />
                    <span>Descargar Plantilla Excel de Ejemplo</span>
                  </a>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                    Selecciona el archivo Excel (.xlsx):
                  </label>
                  <input
                    type="file"
                    required
                    accept=".xlsx,.xls"
                    onChange={(e) => setArchivoImportar(e.target.files?.[0] || null)}
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                {resultadoImportacion && (
                  <div style={{ background: '#dcfce7', color: '#15803d', padding: '10px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '12px' }}>
                    {resultadoImportacion}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModalImportar(false)} className="btn btn-outline">
                  Cerrar
                </button>
                <button type="submit" disabled={importando || !archivoImportar} className="btn btn-primary">
                  <Upload size={16} />
                  <span>{importando ? 'Procesando...' : 'Iniciar Importación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
