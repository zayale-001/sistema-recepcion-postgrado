import React, { useState, useEffect } from 'react';
import { EstudianteSeguimiento, DocumentoItem } from '../types';
import { SeguimientoService, DocumentosService } from '../services/api';
import { PdfCompressorModal } from '../components/PdfCompressorModal';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Upload, 
  Clock, 
  History, 
  Stamp, 
  Maximize2,
  Eye,
  Printer,
  Minimize2
} from 'lucide-react';

interface DetalleExpedienteModalProps {
  estudiante: EstudianteSeguimiento;
  onClose: () => void;
  onActualizado: () => void;
}

export const DetalleExpedienteModal: React.FC<DetalleExpedienteModalProps> = ({
  estudiante,
  onClose,
  onActualizado
}) => {
  const [documentos, setDocumentos] = useState<DocumentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [docSeleccionado, setDocSeleccionado] = useState<DocumentoItem | null>(null);
  const [documentoUrl, setDocumentoUrl] = useState<string | null>(null);
  const [observandoDocId, setObservandoDocId] = useState<string | null>(null);
  const [motivoObservacion, setMotivoObservacion] = useState('');
  const [subiendoReqId, setSubiendoReqId] = useState<string | null>(null);
  const [tabDerecha, setTabDerecha] = useState<'visor' | 'auditoria'>('visor');
  const [mostrarCompresor, setMostrarCompresor] = useState(false);

  useEffect(() => {
    cargarExpediente();
  }, [estudiante.inscripcion_id]);

  useEffect(() => {
    let vigente = true;
    let urlTemporal: string | null = null;
    setDocumentoUrl(null);
    if (docSeleccionado?.ruta_archivo) {
      DocumentosService.obtenerDocumentoUrl(docSeleccionado.id_documento)
        .then(url => {
          urlTemporal = url;
          if (vigente) setDocumentoUrl(url);
          else URL.revokeObjectURL(url);
        })
        .catch(() => { if (vigente) setDocumentoUrl(null); });
    }
    return () => {
      vigente = false;
      if (urlTemporal) URL.revokeObjectURL(urlTemporal);
    };
  }, [docSeleccionado?.id_documento, docSeleccionado?.ruta_archivo]);

  const cargarExpediente = async () => {
    try {
      setLoading(true);
      const docs = await SeguimientoService.getExpedienteEstudiante(estudiante.inscripcion_id);
      setDocumentos(docs);
      
      const primerConArchivo = docs.find(d => d.ruta_archivo);
      if (primerConArchivo) {
        setDocSeleccionado(primerConArchivo);
      } else if (docs.length > 0) {
        setDocSeleccionado(docs[0]);
      }
    } catch (err) {
      console.error('Error al cargar expediente:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleValidar = async (docId: string, estado: string, obs?: string) => {
    try {
      await SeguimientoService.validarDocumento(docId, estado, obs);
      setObservandoDocId(null);
      setMotivoObservacion('');
      await cargarExpediente();
      onActualizado();
    } catch (err) {
      alert('Error al actualizar el estado del documento.');
    }
  };

  const handleToggleCotejoFisico = async (doc: DocumentoItem) => {
    try {
      const nuevoEstado = !doc.cotejado_fisico;
      await SeguimientoService.marcarCotejoFisico(doc.id_documento, nuevoEstado);
      await cargarExpediente();
      onActualizado();
    } catch (err) {
      alert('Error al actualizar el cotejo físico.');
    }
  };

  const handleSubirArchivo = async (requisitoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setSubiendoReqId(requisitoId);
      await DocumentosService.subirDocumento(estudiante.inscripcion_id, requisitoId, file);
      await cargarExpediente();
      onActualizado();
    } catch (err) {
      alert('Error al subir el archivo.');
    } finally {
      setSubiendoReqId(null);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '1200px', width: '95vw', height: '90vh' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                Expediente Documental • UPI - FINI
              </h2>
              <span className="badge badge-info">{estudiante.codigo_inscripcion}</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
              <strong>{estudiante.apellidos}, {estudiante.nombres}</strong> • C.I.: {estudiante.ci} • Estado Actual: <strong>{estudiante.estado_nombre}</strong>
            </div>
          </div>
          <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" onClick={() => setMostrarCompresor(true)} className="btn btn-outline btn-sm" title="Ajustar o reducir el peso de un PDF">
              <Minimize2 size={15} />
              <span>Achicar PDF</span>
            </button>
            <button type="button" onClick={() => window.print()} className="btn btn-outline btn-sm" title="Imprimir requisitos del estudiante">
              <Printer size={15} />
              <span>Imprimir</span>
            </button>
            <button type="button" onClick={onClose} className="btn btn-outline btn-sm" style={{ padding: '6px' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', flex: 1, overflow: 'hidden' }}>
          
          {/* PANEL IZQUIERDO: REQUISITOS */}
          <div style={{ padding: '20px', overflowY: 'auto', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                Cargando requisitos del estudiante...
              </div>
            ) : (
              documentos.map((doc, idx) => {
                const subido = Boolean(doc.ruta_archivo);
                const estaSeleccionado = docSeleccionado?.id_documento === doc.id_documento;

                return (
                  <div 
                    key={doc.id_documento}
                    onClick={() => { setDocSeleccionado(doc); setTabDerecha('visor'); }}
                    style={{
                      border: estaSeleccionado ? '2px solid #c51d25' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px',
                      background: estaSeleccionado ? '#fff5f5' : doc.estado_revision === 'Válido' ? '#f0fdf4' : doc.estado_revision === 'Observado' ? '#fef2f2' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, color: '#c51d25', fontSize: '0.88rem' }}>
                            {idx + 1}. {doc.nombre_requisito}
                          </span>
                          {doc.obligatorio ? (
                            <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>* Obligatorio</span>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Opcional</span>
                          )}
                        </div>

                        {subido ? (
                          <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={13} color="#c51d25" />
                            <span>{doc.nombre_archivo || 'documento.pdf'}</span>
                            {doc.fecha_carga && <span>({new Date(doc.fecha_carga).toLocaleDateString()})</span>}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.76rem', color: '#ca8a04', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={13} />
                            <span>Pendiente de entrega</span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        {doc.estado_revision === 'Válido' && <span className="badge badge-success"><CheckCircle2 size={11} /> Válido</span>}
                        {doc.estado_revision === 'Observado' && <span className="badge badge-danger"><AlertTriangle size={11} /> Observado</span>}
                        {doc.estado_revision === 'Pendiente' && subido && <span className="badge badge-info"><Clock size={11} /> Por Revisar</span>}
                        {!subido && <span className="badge badge-neutral">Sin Subir</span>}

                        {doc.cotejado_fisico && (
                          <span style={{ fontSize: '0.7rem', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Stamp size={10} /> Cotejado Físico
                          </span>
                        )}
                      </div>
                    </div>

                    {doc.observaciones && (
                      <div style={{ background: '#fee2e2', borderLeft: '3px solid #dc2626', padding: '6px 10px', borderRadius: '4px', fontSize: '0.78rem', color: '#991b1b', marginTop: '8px' }}>
                        <strong>Observación:</strong> {doc.observaciones}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {subido ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleToggleCotejoFisico(doc); }}
                            className={`btn btn-sm ${doc.cotejado_fisico ? 'btn-success' : 'btn-outline'}`}
                            title="Marcar cotejo de original físico en ventanilla"
                          >
                            <Stamp size={13} />
                            <span>{doc.cotejado_fisico ? 'Cotejado [✓]' : 'Cotejar Físico'}</span>
                          </button>
                        ) : (
                          <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }} onClick={(e) => e.stopPropagation()}>
                            <Upload size={13} />
                            <span>{subiendoReqId === doc.id_requisito ? 'Subiendo...' : 'Subir / Escanear'}</span>
                            <input 
                              type="file" 
                              accept=".pdf,.jpg,.jpeg,.png"
                              style={{ display: 'none' }} 
                              onChange={(e) => handleSubirArchivo(doc.id_requisito, e)}
                            />
                          </label>
                        )}
                      </div>

                      {subido && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => { setDocSeleccionado(doc); setTabDerecha('visor'); }}
                            className="btn btn-outline btn-sm"
                            title="Mostrar documento en el visor"
                          >
                            <Eye size={13} />
                            <span>Mostrar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleValidar(doc.id_documento, 'Válido')}
                            className="btn btn-success btn-sm"
                            title="Aprobar documento"
                          >
                            <CheckCircle2 size={13} />
                            <span>Aprobar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setObservandoDocId(doc.id_documento)}
                            className="btn btn-outline btn-sm"
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            title="Observar documento con motivo"
                          >
                            <AlertTriangle size={13} />
                            <span>Observar</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {observandoDocId === doc.id_documento && (
                      <div style={{ marginTop: '10px', padding: '10px', background: '#fff1f2', borderRadius: '6px', border: '1px solid #fecdd3' }} onClick={(e) => e.stopPropagation()}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#9f1239', marginBottom: '4px' }}>
                          Motivo de la observación (notificación al postulante):
                        </label>
                        <textarea
                          rows={2}
                          value={motivoObservacion}
                          onChange={(e) => setMotivoObservacion(e.target.value)}
                          placeholder="Ej: El archivo escaneado es borroso o falta la legalización..."
                          style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #fda4af', fontSize: '0.8rem', marginBottom: '6px' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button onClick={() => setObservandoDocId(null)} className="btn btn-outline btn-sm">Cancelar</button>
                          <button onClick={() => handleValidar(doc.id_documento, 'Observado', motivoObservacion)} className="btn btn-sm" style={{ background: '#e11d48', color: 'white' }}>
                            Guardar Observación
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* PANEL DERECHO: VISOR SPLIT-VIEW & HISTORIAL DE AUDITORÍA */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setTabDerecha('visor')}
                  className={`btn btn-sm ${tabDerecha === 'visor' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <FileText size={14} />
                  <span>Visor Integrado de Archivo</span>
                </button>
                <button
                  onClick={() => setTabDerecha('auditoria')}
                  className={`btn btn-sm ${tabDerecha === 'auditoria' ? 'btn-primary' : 'btn-outline'}`}
                >
                  <History size={14} />
                  <span>Trazabilidad de Estados (RF-09)</span>
                </button>
              </div>

                  {docSeleccionado?.ruta_archivo && documentoUrl && (
                <a
                  href={documentoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm"
                  title="Abrir en ventana completa"
                >
                  <Maximize2 size={13} />
                  <span>Pantalla Completa</span>
                </a>
              )}
            </div>

            <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
              {tabDerecha === 'visor' ? (
                docSeleccionado && docSeleccionado.ruta_archivo ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '8px', fontWeight: 600 }}>
                      Mostrando: {docSeleccionado.nombre_requisito} ({docSeleccionado.nombre_archivo})
                    </div>
                    {/\.(jpg|jpeg|png)$/i.test(docSeleccionado.nombre_archivo || '') ? (
                      <div style={{ width: '100%', height: '100%', minHeight: '500px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                        {documentoUrl && (
                          <img
                            src={documentoUrl}
                            alt={docSeleccionado.nombre_requisito}
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                          />
                        )}
                      </div>
                    ) : (
                      <iframe
                        src={documentoUrl || undefined}
                        title="Visor de Documento"
                        style={{ width: '100%', height: '100%', minHeight: '500px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white' }}
                      />
                    )}
                  </div>
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', padding: '40px' }}>
                    <FileText size={48} strokeWidth={1.5} color="#94a3b8" />
                    <div style={{ marginTop: '12px', fontWeight: 600, color: '#334155' }}>Ningún archivo seleccionado</div>
                    <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                      Selecciona un requisito con documento subido en el panel izquierdo para previsualizarlo aquí.
                    </div>
                  </div>
                )
              ) : (
                /* Historial de versiones y revisiones */
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <History size={16} />
                    <span>Historial de cambios del documento</span>
                  </h3>

                  {docSeleccionado && docSeleccionado.historial && docSeleccionado.historial.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {docSeleccionado.historial.map((h) => (
                        <div key={h.id_historial} style={{ background: 'white', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span className="badge badge-info">{h.accion}</span>
                            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(h.fecha_cambio).toLocaleString()}</span>
                          </div>
                          {h.nombre_archivo && <div style={{ color: '#334155', marginTop: '4px' }}>{h.nombre_archivo}</div>}
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '6px' }}>
                            Responsable: <strong>{h.usuario_nombre || 'Sistema'}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', padding: '30px' }}>
                      No hay registros en el historial todavía.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
              💡 Haz clic en cualquier requisito o en "Mostrar" para ver el archivo directamente en el visor integrado.
            </div>
            <button onClick={onClose} className="btn btn-primary">
              Cerrar Expediente
            </button>
          </div>
        </div>
      </div>

      {mostrarCompresor && (
        <PdfCompressorModal onClose={() => setMostrarCompresor(false)} />
      )}
    </div>
  );
};
