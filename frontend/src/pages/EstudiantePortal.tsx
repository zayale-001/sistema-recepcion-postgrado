import React, { useState, useEffect } from 'react';
import { Usuario, DocumentoItem, MiInscripcion, ConvocatoriaAbierta, Categoria, Area } from '../types';
import { SeguimientoService, DocumentosService, CatalogosService } from '../services/api';
import { PdfCompressorModal } from '../components/PdfCompressorModal';
import { 
  GraduationCap, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Eye,
  Download,
  Pencil,
  FileCheck,
  Trash2,
  Minimize2,
  Printer
} from 'lucide-react';

interface EstudiantePortalProps {
  usuario: Usuario;
}

// Categorías iniciales del catálogo creado por semilla_datos.py.
// Se usan como respaldo si el endpoint de categorías responde vacío.
const CATEGORIAS_RESPALDO: Categoria[] = [
  { id: 1, nombre: 'Doctorado', slug: 'doctorado', icono: 'school', orden: 1, areas: [] },
  { id: 2, nombre: 'Maestrías', slug: 'maestrias', icono: 'workspace_premium', orden: 2, areas: [] },
  { id: 3, nombre: 'Especialidad', slug: 'especialidad', icono: 'local_hospital', orden: 3, areas: [] },
  { id: 4, nombre: 'Diplomados', slug: 'diplomados', icono: 'card_membership', orden: 4, areas: [] },
  { id: 5, nombre: 'Cursos', slug: 'cursos', icono: 'menu_book', orden: 5, areas: [] }
];

export const EstudiantePortal: React.FC<EstudiantePortalProps> = ({ usuario }) => {
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [inscripciones, setInscripciones] = useState<MiInscripcion[]>([]);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaAbierta[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [areaSeleccionada, setAreaSeleccionada] = useState('');
  const [convocatoriaSeleccionada, setConvocatoriaSeleccionada] = useState('');
  const [inscripcionId, setInscripcionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subiendoId, setSubiendoId] = useState<string | null>(null);
  const [porcentajeCarga, setPorcentajeCarga] = useState(0);
  const [inscribiendo, setInscribiendo] = useState(false);
  const [cargandoConvocatorias, setCargandoConvocatorias] = useState(false);
  const [mostrarOferta, setMostrarOferta] = useState(false);
  const [compresorDocTarget, setCompresorDocTarget] = useState<DocumentoItem | null>(null);
  const [mostrarCompresorGeneral, setMostrarCompresorGeneral] = useState(false);

  const nombreEstudiante = usuario.persona 
    ? `${usuario.persona.nombres} ${usuario.persona.apellidos}`
    : usuario.nombre_usuario;

  const ciEstudiante = usuario.persona?.nro_documento || 'S/N';

  useEffect(() => {
    cargarDatosEstudiante();
  }, [usuario.id_usuario]);

  useEffect(() => {
    if (!inscripcionId) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarExpediente(inscripcionId).catch(() => {});
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [inscripcionId]);

  const cargarExpediente = async (id: string) => {
    const docs = await SeguimientoService.getExpedienteEstudiante(id);
    setDocumentos(docs);
  };

  const cargarDatosEstudiante = async () => {
    try {
      setLoading(true);
      const mias = await SeguimientoService.getMiInscripcion();
      setInscripciones(mias);
      const categoriasCatalogo = await CatalogosService.getCategorias().catch(() => []);
      setCategorias(categoriasCatalogo.length > 0 ? categoriasCatalogo : CATEGORIAS_RESPALDO);
      if (mias.length > 0) {
        setInscripcionId(mias[0].inscripcion_id);
        await cargarExpediente(mias[0].inscripcion_id);
      } else {
        setMostrarOferta(true);
      }
    } catch (err) {
      console.error('Error al cargar portal del estudiante:', err);
    } finally {
      setLoading(false);
    }
  };

  const cambiarInscripcion = async (id: string) => {
    setInscripcionId(id);
    await cargarExpediente(id);
  };

  const cambiarCategoria = async (id: string) => {
    setCategoriaSeleccionada(id);
    setAreaSeleccionada('');
    setAreas([]);
    setConvocatoriaSeleccionada('');
    setConvocatorias([]);
    if (!id) return;
    try {
      setCargandoConvocatorias(true);
      const categoria = categorias.find(c => c.id === Number(id));
      const areasCategoria = await CatalogosService.getAreas(Number(id)).catch(() => categoria?.areas || []);
      setAreas(areasCategoria);
      if (areasCategoria.length === 0) {
        const abiertas = await SeguimientoService.getConvocatoriasAbiertas(Number(id));
        const yaInscritas = new Set(inscripciones.map(i => i.edicion_id));
        setConvocatorias(abiertas.filter(c => !yaInscritas.has(c.id_convocatoria)));
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudieron cargar los programas disponibles.');
    } finally {
      setCargandoConvocatorias(false);
    }
  };

  const cambiarArea = async (id: string) => {
    setAreaSeleccionada(id);
    setConvocatoriaSeleccionada('');
    setConvocatorias([]);
    if (!id || !categoriaSeleccionada) return;
    try {
      setCargandoConvocatorias(true);
      const abiertas = await SeguimientoService.getConvocatoriasAbiertas(Number(categoriaSeleccionada), Number(id));
      const yaInscritas = new Set(inscripciones.map(i => i.edicion_id));
      setConvocatorias(abiertas.filter(c => !yaInscritas.has(c.id_convocatoria)));
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudieron cargar los programas de esta área.');
    } finally {
      setCargandoConvocatorias(false);
    }
  };

  const handleInscribirse = async () => {
    if (!convocatoriaSeleccionada) return;
    const convocatoria = convocatorias.find(c => c.id_convocatoria === convocatoriaSeleccionada);
    if (!convocatoria || !window.confirm(`¿Deseas inscribirte al programa ${convocatoria.titulo_completo}?`)) return;
    try {
      setInscribiendo(true);
      const nueva = await SeguimientoService.inscribirse(convocatoriaSeleccionada);
      const mias = await SeguimientoService.getMiInscripcion();
      setInscripciones(mias);
      if (categoriaSeleccionada) {
        const abiertas = await SeguimientoService.getConvocatoriasAbiertas(
          Number(categoriaSeleccionada), areaSeleccionada ? Number(areaSeleccionada) : undefined
        );
        setConvocatorias(abiertas.filter(c => !mias.some(i => i.edicion_id === c.id_convocatoria)));
      }
      setConvocatoriaSeleccionada('');
      setInscripcionId(nueva.inscripcion_id);
      setMostrarOferta(false);
      await cargarExpediente(nueva.inscripcion_id);
      alert('Inscripción realizada. Ya puedes cargar la documentación solicitada.');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'No se pudo completar la inscripción.');
    } finally {
      setInscribiendo(false);
    }
  };

  const handleEliminarArchivo = async (doc: DocumentoItem) => {
    if (!window.confirm(`¿Eliminar el archivo “${doc.nombre_archivo}”?`)) return;
    try {
      setSubiendoId(doc.id_requisito);
      await DocumentosService.eliminarDocumento(doc.id_documento);
      if (inscripcionId) await cargarExpediente(inscripcionId);
      alert('Documento eliminado correctamente.');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al eliminar el documento.');
    } finally {
      setSubiendoId(null);
    }
  };

  const inscripcionActual = inscripciones.find(i => i.inscripcion_id === inscripcionId) || null;
  const codigoInscripcion = inscripcionActual?.codigo_inscripcion || '';

  const subirArchivoDirecto = async (doc: DocumentoItem, file: File) => {
    if (!inscripcionId) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('El archivo supera el límite permitido de 10 MB. Usa "Ajustar / Achicar PDF" para reducir su tamaño.');
      return;
    }
    if (doc.estado_revision === 'Válido') {
      const seguir = window.confirm(
        'Este documento ya fue aprobado. Si lo reemplazas, volverá a revisión de la UPI. ¿Deseas continuar?'
      );
      if (!seguir) return;
    }
    try {
      setSubiendoId(doc.id_requisito);
      setPorcentajeCarga(0);
      await DocumentosService.subirDocumento(inscripcionId, doc.id_requisito, file, setPorcentajeCarga);
      await cargarExpediente(inscripcionId);
      alert('Documento subido correctamente para revisión de la UPI.');
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error al subir el archivo.');
    } finally {
      setSubiendoId(null);
      setPorcentajeCarga(0);
    }
  };

  const handleSubirArchivo = async (doc: DocumentoItem, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await subirArchivoDirecto(doc, file);
    e.target.value = '';
  };

  const totalRequisitos = documentos.length;
  const subidos = documentos.filter(d => Boolean(d.ruta_archivo)).length;
  const porcentaje = totalRequisitos > 0 ? Math.round((subidos / totalRequisitos) * 100) : 0;
  const documentosOrdenados = [...documentos].sort((a, b) => {
    const prioridad = (doc: DocumentoItem) => doc.estado_revision === 'Observado' ? 0 : !doc.ruta_archivo ? 1 : doc.estado_revision === 'Pendiente' ? 2 : 3;
    return prioridad(a) - prioridad(b);
  });
  const documentosPorResolver = documentos.filter(d => d.estado_revision === 'Observado' || !d.ruta_archivo).length;

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando requisitos del postulante...</div>;
  }

  return (
    <div className={`student-portal ${inscripciones.length > 0 ? 'has-enrollment' : 'no-enrollment'}`}>
      <div className="card student-welcome" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #c51d25 0%, #9f1720 100%)', color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.15)', padding: '16px', borderRadius: '12px' }}>
            <img src="/upi_escudo.png" alt="Escudo UPI" className="student-hero-emblem" />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#fecaca', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Portal de Postulaciones • UPI - FINI
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '4px 0' }}>
              {nombreEstudiante}
            </h1>
            <div style={{ fontSize: '0.85rem', opacity: 0.9 }}>
              C.I.: <strong>{ciEstudiante}</strong> • Código: <strong>{codigoInscripcion || 'INS-PENDIENTE'}</strong>
            </div>
            <div style={{ fontSize: '0.82rem', marginTop: '2px', color: '#fca5a5' }}>
              {inscripcionActual?.programa_nombre || 'Programa de Posgrado'}
            </div>
            {inscripcionActual && <div style={{ fontSize: '0.82rem', marginTop: '5px', color: '#fee2e2' }}>
              Estado: <strong>{inscripcionActual.estado_nombre}</strong>
              {inscripcionActual.fecha_solicitud && <> · Solicitud: {new Date(inscripcionActual.fecha_solicitud).toLocaleDateString()}</>}
              {inscripcionActual.fecha_fin && <> · Cierre: {new Date(inscripcionActual.fecha_fin).toLocaleDateString()}</>}
              {inscripcionActual.convocatoria_estado === 'Cerrada' && ' · Convocatoria cerrada'}
            </div>}
          </div>
        </div>
      </div>

      {inscripciones.length > 1 && (
        <div className="card student-enrollment-selector" style={{ marginBottom: '24px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Consulta la documentación de una inscripción
          </label>
          <select
            value={inscripcionId || ''}
            onChange={(e) => cambiarInscripcion(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
          >
            {inscripciones.map(i => (
              <option key={i.inscripcion_id} value={i.inscripcion_id}>
                {i.programa_nombre} — {i.version_edicion} ({i.gestion})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="card student-offer" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
          Explora la oferta académica UPI
        </h2>
        <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '12px' }}>
          Sigue la estructura académica: tipo de posgrado, área de conocimiento y programa disponible.
        </p>
        <button type="button" className="student-offer-toggle" onClick={() => setMostrarOferta(!mostrarOferta)}>
          {mostrarOferta ? 'Ocultar opciones de inscripción' : inscripciones.length > 0 ? 'Iniciar otra postulación' : 'Ver programas disponibles'}
        </button>
        {mostrarOferta && <div className="student-offer-fields" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={categoriaSeleccionada}
            onChange={e => cambiarCategoria(e.target.value)}
            disabled={inscribiendo || cargandoConvocatorias}
            style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
          >
            <option value="">1. Selecciona el tipo de posgrado</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {categoriaSeleccionada && areas.length > 0 && <select
            value={areaSeleccionada}
            onChange={e => cambiarArea(e.target.value)}
            disabled={inscribiendo || cargandoConvocatorias}
            style={{ flex: '1 1 250px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
          >
            <option value="">2. Selecciona el área de conocimiento</option>
            {areas.map(area => <option key={area.id} value={area.id}>{area.nombre}</option>)}
          </select>}
          {categoriaSeleccionada && (areas.length === 0 || areaSeleccionada) && <select
            value={convocatoriaSeleccionada}
            onChange={e => setConvocatoriaSeleccionada(e.target.value)}
            disabled={convocatorias.length === 0 || inscribiendo || cargandoConvocatorias}
            style={{ flex: '1 1 300px', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
          >
            <option value="">{cargandoConvocatorias ? 'Cargando programas...' : convocatorias.length ? `${areas.length > 0 ? '3. ' : '2. '}Selecciona un programa y convocatoria` : 'No hay convocatorias abiertas en esta selección'}</option>
            {convocatorias.map(c => (
              <option key={c.id_convocatoria} value={c.id_convocatoria}>{c.titulo_completo}</option>
            ))}
          </select>}
          {categoriaSeleccionada && (areas.length === 0 || areaSeleccionada) && <button className="btn btn-primary" onClick={handleInscribirse} disabled={!convocatoriaSeleccionada || inscribiendo || cargandoConvocatorias}>
            <GraduationCap size={16} />
            <span>{inscribiendo ? 'Inscribiendo...' : 'Inscribirme'}</span>
          </button>}
        </div>}
      </div>

      {inscripciones.length === 0 && (
        <div className="card student-empty-enrollment" style={{ marginBottom: '24px', textAlign: 'center', color: '#64748b' }}>
          Aún no tienes una inscripción registrada. Puedes elegir un programa arriba para comenzar.
        </div>
      )}

      {/* Tarjeta de estado de avance */}
      <div className="card student-progress-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Estado de tu Documentación
            </h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Has presentado {subidos} de {totalRequisitos} requisitos exigidos
            </p>
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: porcentaje === 100 ? '#16a34a' : '#c51d25' }}>
            {porcentaje}%
          </div>
        </div>

        <div className="progress-container" style={{ height: '10px' }}>
          <div 
            className="progress-bar"
            style={{
              width: `${porcentaje}%`,
              background: porcentaje === 100 ? '#16a34a' : '#c51d25'
            }}
          />
        </div>

        {porcentaje === 100 && inscripcionId && (
          <div className="no-print" style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => SeguimientoService.verComprobantePdf(inscripcionId)} className="btn btn-primary btn-sm">
              <FileCheck size={16} />
              <span>Mostrar Boleta de Conformidad (PDF)</span>
            </button>
          </div>
        )}
      </div>

      {/* Lista de requisitos con botón de subida */}
      <div className="card student-documents-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
            Requisitos Documentales Exigidos
          </h3>
          <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setMostrarCompresorGeneral(true)} className="btn btn-outline btn-sm">
              <Minimize2 size={14} />
              <span>Ajustar / Achicar PDF</span>
            </button>
            <button type="button" onClick={() => window.print()} className="btn btn-outline btn-sm">
              <Printer size={14} />
              <span>Imprimir requisitos</span>
            </button>
          </div>
        </div>
        <p className="student-documents-hint">{documentosPorResolver > 0 ? `${documentosPorResolver} documento(s) necesitan tu atención. Los pendientes aparecen primero.` : 'Tus documentos están al día.'}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {documentosOrdenados.map((doc) => {
            const subido = Boolean(doc.ruta_archivo);
            const idx = documentos.indexOf(doc);

            return (
              <div 
                key={doc.id_documento}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '16px',
                  background: doc.estado_revision === 'Válido' ? '#f0fdf4' : doc.estado_revision === 'Observado' ? '#fff1f2' : '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
                      {idx + 1}. {doc.nombre_requisito}
                    </div>

                    {subido ? (
                      <div style={{ fontSize: '0.8rem', color: '#c51d25', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} />
                        <span>Archivo adjunto: <strong>{doc.nombre_archivo}</strong></span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#ca8a04', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} />
                        <span>Falta presentar este documento (PDF, JPG o PNG)</span>
                      </div>
                    )}
                  </div>

                  <div>
                    {doc.estado_revision === 'Válido' && <span className="badge badge-success"><CheckCircle2 size={12} /> Aprobado</span>}
                    {doc.estado_revision === 'Observado' && <span className="badge badge-danger"><AlertTriangle size={12} /> Observado</span>}
                    {doc.estado_revision === 'Pendiente' && subido && <span className="badge badge-info"><Clock size={12} /> En Revisión</span>}
                    {!subido && <span className="badge badge-neutral">Pendiente</span>}
                  </div>
                </div>

                {doc.observaciones && (
                  <div style={{
                    marginTop: '10px',
                    background: '#fee2e2',
                    borderLeft: '4px solid #dc2626',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '0.82rem',
                    color: '#991b1b'
                  }}>
                    <strong>Observación del Revisor:</strong> {doc.observaciones}
                  </div>
                )}

                  {doc.historial && doc.historial.length > 0 && (
                    <details style={{ marginTop: '10px', fontSize: '0.78rem', color: '#475569' }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Historial de cambios ({doc.historial.length})</summary>
                      <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                        {doc.historial.slice(0, 5).map(h => (
                          <li key={h.id_historial}>
                            {h.accion}{h.nombre_archivo ? `: ${h.nombre_archivo}` : ''} · {new Date(h.fecha_cambio).toLocaleString()}
                            {h.usuario_nombre ? ` · ${h.usuario_nombre}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                <div className="no-print" style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  {subido ? (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => DocumentosService.abrirDocumento(doc.id_documento)} className="btn btn-outline btn-sm">
                        <Eye size={14} />
                        <span>Mostrar</span>
                      </button>
                      <button type="button" onClick={() => DocumentosService.descargarDocumento(doc.id_documento, doc.nombre_archivo || 'documento')} className="btn btn-outline btn-sm">
                        <Download size={14} />
                        <span>Descargar</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ color: '#b91c1c' }}
                        disabled={subiendoId !== null}
                        onClick={() => handleEliminarArchivo(doc)}
                      >
                        <Trash2 size={14} />
                        <span>{subiendoId === doc.id_requisito ? 'Procesando...' : 'Eliminar'}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCompresorDocTarget(doc)}
                      className="btn btn-outline btn-sm"
                      title="Optimizar o achicar PDF antes de subir"
                    >
                      <Minimize2 size={14} />
                      <span>Achicar PDF</span>
                    </button>
                  )}

                  <label
                    className={subido ? 'btn btn-outline btn-sm' : 'btn btn-primary'}
                    style={{ cursor: 'pointer' }}
                  >
                    {subido ? <Pencil size={14} /> : <Upload size={16} />}
                    <span>
                      {subiendoId === doc.id_requisito
                        ? `Subiendo ${porcentajeCarga}%...`
                        : subido
                          ? 'Editar (reemplazar)'
                          : 'Subir documento'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      disabled={subiendoId !== null}
                      onChange={(e) => handleSubirArchivo(doc, e)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(mostrarCompresorGeneral || compresorDocTarget) && (
        <PdfCompressorModal
          tituloRequisito={compresorDocTarget?.nombre_requisito}
          onClose={() => {
            setMostrarCompresorGeneral(false);
            setCompresorDocTarget(null);
          }}
          onUseFile={
            compresorDocTarget
              ? (file) => subirArchivoDirecto(compresorDocTarget, file)
              : undefined
          }
        />
      )}
    </div>
  );
};
