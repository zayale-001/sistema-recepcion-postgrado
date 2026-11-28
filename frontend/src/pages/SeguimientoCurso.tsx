import React, { useState, useEffect, useCallback } from 'react';
import { CursoResumen, EstudianteSeguimiento, DocumentoItem } from '../types';
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
  X,
  Printer,
  RefreshCw,
  ClipboardCheck
} from 'lucide-react';

interface SeguimientoCursoProps {
  curso: CursoResumen;
  onVolver: () => void;
  onVerExpediente: (estudiante: EstudianteSeguimiento) => void;
  refreshKey?: number;
}

export const SeguimientoCurso: React.FC<SeguimientoCursoProps> = ({ 
  curso, 
  onVolver, 
  onVerExpediente,
  refreshKey = 0
}) => {
  const [estudiantes, setEstudiantes] = useState<EstudianteSeguimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [imprimiendoEstId, setImprimiendoEstId] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Estado para modal de importación masiva Excel
  const [modalImportar, setModalImportar] = useState(false);
  const [archivoImportar, setArchivoImportar] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState<string | null>(null);

  const cargarEstudiantes = useCallback(async (silencioso = false) => {
    try {
      if (silencioso) setActualizando(true);
      else setLoading(true);
      const data = await SeguimientoService.getEstudiantesCurso(curso.edicion_id);
      setEstudiantes(data);
    } catch (err) {
      console.error('Error al cargar seguimiento de estudiantes:', err);
    } finally {
      setLoading(false);
      setActualizando(false);
    }
  }, [curso.edicion_id]);

  useEffect(() => {
    cargarEstudiantes();
  }, [cargarEstudiantes, refreshKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarEstudiantes(true);
      }
    }, 12000);
    return () => window.clearInterval(interval);
  }, [cargarEstudiantes]);

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

  const tienePorRevisar = (est: EstudianteSeguimiento) =>
    est.requisitos_subidos > est.requisitos_aprobados + est.requisitos_observados;

  const esObservado = (est: EstudianteSeguimiento) =>
    est.estado_nombre.toLowerCase() === 'observada' || est.requisitos_observados > 0;

  const esCompleto = (est: EstudianteSeguimiento) =>
    ['completa', 'habilitada'].includes(est.estado_nombre.toLowerCase()) ||
    (est.total_requisitos > 0 && est.requisitos_faltantes === 0 && est.requisitos_observados === 0);

  // Generador de enlace WhatsApp directo con mensaje listo según estado
  const generarEnlaceWhatsApp = (est: EstudianteSeguimiento) => {
    let telefono = (est.telefono || '').replace(/\D/g, '');
    if (!telefono) return null;
    if (telefono.length === 8) {
      telefono = `591${telefono}`; // Código de país Bolivia
    }

    let cuerpo = '';
    if (est.requisitos_faltantes > 0) {
      const faltantesTexto = est.documentos_faltantes_nombres.join(', ');
      cuerpo = `Estimado(a) ${est.nombres} ${est.apellidos}, le saludamos desde la Coordinación de Postgrado (${curso.programa_nombre}). Le recordamos que tiene pendiente la entrega de los siguientes requisitos documentales:\n\n*${faltantesTexto}*\n\nPor favor súbalos al sistema a la brevedad para completar su habilitación.`;
    } else if (est.requisitos_observados > 0) {
      cuerpo = `Estimado(a) ${est.nombres} ${est.apellidos}, le saludamos desde la Coordinación de Postgrado (${curso.programa_nombre}). Tiene ${est.requisitos_observados} documento(s) con observaciones en su expediente (${est.codigo_inscripcion}). Por favor revise el portal para subsanarlos a la brevedad.`;
    } else if (tienePorRevisar(est)) {
      cuerpo = `Estimado(a) ${est.nombres} ${est.apellidos}, le saludamos desde la Coordinación de Postgrado (${curso.programa_nombre}). Confirmamos la recepción digital de su expediente (${est.codigo_inscripcion}); actualmente se encuentra en revisión.`;
    } else {
      cuerpo = `Estimado(a) ${est.nombres} ${est.apellidos}, le saludamos desde la Coordinación de Postgrado (${curso.programa_nombre}). Su expediente (${est.codigo_inscripcion}) se encuentra completo y habilitado.`;
    }

    return `https://wa.me/${telefono}?text=${encodeURIComponent(cuerpo)}`;
  };

  // Impresión directa de ficha de requisitos (digital + checklist manual)
  const imprimirFichaEstudiante = async (est: EstudianteSeguimiento) => {
    try {
      setImprimiendoEstId(est.inscripcion_id);
      const docs: DocumentoItem[] = await SeguimientoService.getExpedienteEstudiante(est.inscripcion_id);
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) {
        alert('Por favor permite las ventanas emergentes para imprimir la ficha del postulante.');
        return;
      }

      const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const filas = docs
        .map(
          (d, i) => `
          <tr>
            <td style="text-align:center;">${i + 1}</td>
            <td><strong>${escapeHtml(d.nombre_requisito)}</strong>${d.obligatorio ? ' <span style="color:#c51d25;">*</span>' : ' (Opcional)'}</td>
            <td style="text-align:center;">${d.ruta_archivo ? escapeHtml(d.estado_revision) : 'Pendiente'}</td>
            <td style="text-align:center;">${d.cotejado_fisico ? '[✓] Cotejado' : '[  ] Manual'}</td>
            <td>${escapeHtml(d.observaciones || (d.nombre_archivo ? `Archivo: ${d.nombre_archivo}` : 'Sin archivo adjunto'))}</td>
          </tr>`
        )
        .join('');

      win.document.write(`
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <title>Ficha de Requisitos - ${escapeHtml(est.apellidos)} ${escapeHtml(est.nombres)}</title>
            <style>
              body { font-family: Arial, sans-serif; color: #0f172a; padding: 24px; font-size: 12px; }
              h1 { font-size: 16px; color: #c51d25; margin: 0 0 4px; }
              .sub { color: #475569; margin-bottom: 14px; }
              .info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
              th { background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; }
              .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 44px; text-align: center; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            <h1>UNIDAD DE POSTGRADO (UPI) - FINI</h1>
            <div class="sub">Ficha de Control de Requisitos Documentales (Digital y Manual)</div>
            <div class="info">
              <div><strong>Postulante:</strong> ${escapeHtml(est.apellidos)}, ${escapeHtml(est.nombres)}</div>
              <div><strong>C.I.:</strong> ${escapeHtml(est.ci)}</div>
              <div><strong>Programa:</strong> ${escapeHtml(curso.programa_nombre)}</div>
              <div><strong>Código:</strong> ${escapeHtml(est.codigo_inscripcion)}</div>
              <div><strong>Gestión:</strong> ${escapeHtml(curso.gestion)} (${escapeHtml(curso.version_edicion)})</div>
              <div><strong>Estado:</strong> ${escapeHtml(est.estado_nombre)} (${est.porcentaje_avance}%)</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width:32px;text-align:center;">N°</th>
                  <th>Requisito</th>
                  <th style="width:90px;text-align:center;">Estado Digital</th>
                  <th style="width:95px;text-align:center;">Cotejo Físico</th>
                  <th>Observaciones / Archivo</th>
                </tr>
              </thead>
              <tbody>${filas}</tbody>
            </table>
            <div class="firmas">
              <div>_______________________________<br/><strong>Postulante</strong><br/>C.I.: ${escapeHtml(est.ci)}</div>
              <div>_______________________________<br/><strong>Revisor / Coordinador</strong><br/>UPI - FINI</div>
            </div>
            <script>window.onload = function(){ window.print(); };</script>
          </body>
        </html>
      `);
      win.document.close();
    } catch (err) {
      alert('No se pudo generar la ficha de impresión del estudiante.');
    } finally {
      setImprimiendoEstId(null);
    }
  };

  // Filtrado
  const estudiantesFiltrados = estudiantes.filter((est) => {
    const matchBusqueda = 
      est.nombres.toLowerCase().includes(busqueda.toLowerCase()) ||
      est.apellidos.toLowerCase().includes(busqueda.toLowerCase()) ||
      est.ci.includes(busqueda);

    if (!matchBusqueda) return false;

    if (filtroEstado === 'por_revisar') {
      return tienePorRevisar(est);
    }
    if (filtroEstado === 'faltantes') {
      return est.requisitos_faltantes > 0;
    }
    if (filtroEstado === 'completos') {
      return esCompleto(est);
    }
    if (filtroEstado === 'observados') {
      return esObservado(est);
    }

    return true;
  });

  const getBadgeEstado = (est: EstudianteSeguimiento) => {
    const nombre = est.estado_nombre.toLowerCase();
    if (nombre === 'habilitada') {
      return <span className="badge badge-success"><CheckCircle2 size={12} /> Habilitada</span>;
    }
    if (nombre === 'completa') {
      return <span className="badge badge-info"><CheckCircle2 size={12} /> Completa</span>;
    }
    if (nombre === 'observada' || est.requisitos_observados > 0) {
      return <span className="badge badge-danger"><AlertTriangle size={12} /> Observada</span>;
    }
    if (tienePorRevisar(est)) {
      return <span className="badge badge-info"><ClipboardCheck size={12} /> Por Revisar</span>;
    }
    if (nombre === 'incompleta' || est.requisitos_subidos > 0) {
      return <span className="badge badge-warning"><Clock size={12} /> Incompleta</span>;
    }
    return <span className="badge badge-neutral">Sin Subir</span>;
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#0f172a' }}>
                {curso.programa_nombre}
              </h1>
              <span className="live-badge no-print" title="Actualización automática cada 12 segundos">
                <span className="live-dot" />
                <span>{actualizando ? 'Actualizando...' : 'Tiempo real'}</span>
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '2px' }}>
              Coordinador Encargado: <strong>{curso.coordinador_encargado || 'Sin Asignar'}</strong>
            </p>
          </div>

          {/* Acciones Superiores */}
          <div className="no-print" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => cargarEstudiantes(true)} className="btn btn-outline btn-sm" disabled={actualizando}>
              <RefreshCw size={15} />
              <span>Actualizar</span>
            </button>
            <button type="button" onClick={() => window.print()} className="btn btn-outline btn-sm">
              <Printer size={15} />
              <span>Imprimir resumen</span>
            </button>
            <button type="button" onClick={() => setModalImportar(true)} className="btn btn-outline btn-sm">
              <Upload size={15} />
              <span>Importar Excel</span>
            </button>

            <button type="button" onClick={() => SeguimientoService.descargarExcel(curso.edicion_id)} className="btn btn-success btn-sm">
              <FileSpreadsheet size={16} />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtros Rápidos */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className={`btn btn-sm ${filtroEstado === 'todos' ? 'btn-primary' : 'btn-outline'}`}
          >
            Todos ({estudiantes.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('por_revisar')}
            className={`btn btn-sm ${filtroEstado === 'por_revisar' ? 'btn-primary' : 'btn-outline'}`}
            style={{ color: filtroEstado === 'por_revisar' ? 'white' : '#1d4ed8' }}
          >
            <ClipboardCheck size={14} />
            <span>Por revisar ({estudiantes.filter(tienePorRevisar).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('faltantes')}
            className={`btn btn-sm ${filtroEstado === 'faltantes' ? 'btn-primary' : 'btn-outline'}`}
            style={{ color: filtroEstado === 'faltantes' ? 'white' : '#a16207' }}
          >
            <Clock size={14} />
            <span>Faltan Documentos ({estudiantes.filter(e => e.requisitos_faltantes > 0).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('completos')}
            className={`btn btn-sm ${filtroEstado === 'completos' ? 'btn-primary' : 'btn-outline'}`}
            style={{ color: filtroEstado === 'completos' ? 'white' : '#15803d' }}
          >
            <CheckCircle2 size={14} />
            <span>Completos ({estudiantes.filter(esCompleto).length})</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('observados')}
            className={`btn btn-sm ${filtroEstado === 'observados' ? 'btn-primary' : 'btn-outline'}`}
            style={{ color: filtroEstado === 'observados' ? 'white' : '#dc2626' }}
          >
            <AlertTriangle size={14} />
            <span>Observados ({estudiantes.filter(esObservado).length})</span>
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
              <th style={{ width: '44px', textAlign: 'center' }}>N°</th>
              <th style={{ width: '105px' }}>C.I.</th>
              <th>Postulante / Maestrante</th>
              <th style={{ width: '190px' }}>Avance y Cotejo</th>
              <th style={{ width: '125px' }}>Estado</th>
              <th>Documentos Faltantes</th>
              <th className="no-print" style={{ width: '230px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  Cargando postulantes y seguimiento...
                </td>
              </tr>
            ) : estudiantesFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
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
                        <span style={{ fontWeight: 600 }}>{est.requisitos_subidos}/{est.total_requisitos} digital</span>
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
                      <div style={{ fontSize: '0.73rem', marginTop: '4px', fontWeight: 600, color: est.requisitos_cotejados_fisico === est.total_requisitos && est.total_requisitos > 0 ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Stamp size={12} />
                        <span>Cotejo físico: {est.requisitos_cotejados_fisico}/{est.total_requisitos}</span>
                      </div>
                    </td>
                    <td>{getBadgeEstado(est)}</td>
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
                    <td className="no-print" style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => onVerExpediente(est)}
                          className="btn btn-outline btn-sm"
                          title="Revisar expediente y mostrar documentos"
                        >
                          <Eye size={13} />
                          <span>Revisar</span>
                        </button>

                        {whatsappUrl ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm"
                            style={{ background: '#25D366', color: 'white', padding: '6px 9px' }}
                            title="Abrir WhatsApp con mensaje listo"
                          >
                            <MessageSquare size={14} />
                            <span>Mensaje</span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => alert(`El postulante ${est.nombres} ${est.apellidos} no tiene número de teléfono registrado.`)}
                            className="btn btn-outline btn-sm"
                            style={{ padding: '6px 8px', opacity: 0.6 }}
                            title="Sin teléfono registrado para WhatsApp"
                          >
                            <MessageSquare size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => imprimirFichaEstudiante(est)}
                          disabled={imprimiendoEstId === est.inscripcion_id}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '6px 8px' }}
                          title="Imprimir ficha de requisitos (digital y manual)"
                        >
                          <Printer size={14} />
                        </button>

                        {esCompleto(est) && (
                          <button
                            type="button"
                            onClick={() => SeguimientoService.verComprobantePdf(est.inscripcion_id)}
                            className="btn btn-sm"
                            style={{ background: '#c51d25', color: 'white', padding: '6px 8px' }}
                            title="Mostrar Boleta Oficial de Conformidad Documental (PDF)"
                          >
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
