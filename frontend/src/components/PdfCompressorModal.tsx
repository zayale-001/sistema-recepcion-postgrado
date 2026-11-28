import React, { useState } from 'react';
import { DocumentosService } from '../services/api';
import { FileDown, Minimize2, Upload, X, CheckCircle2 } from 'lucide-react';

interface PdfCompressorModalProps {
  onClose: () => void;
  onUseFile?: (file: File) => void;
  tituloRequisito?: string;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const PdfCompressorModal: React.FC<PdfCompressorModalProps> = ({
  onClose,
  onUseFile,
  tituloRequisito,
}) => {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nivel, setNivel] = useState<'ligera' | 'media' | 'alta'>('media');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{
    file: File;
    originalSize: number;
    compressedSize: number;
  } | null>(null);

  const handleComprimir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) return;
    try {
      setProcesando(true);
      setError('');
      const res = await DocumentosService.comprimirPdf(archivo, nivel);
      setResultado(res);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'No se pudo optimizar el archivo PDF.');
    } finally {
      setProcesando(false);
    }
  };

  const descargarResultado = () => {
    if (!resultado) return;
    const url = URL.createObjectURL(resultado.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = resultado.file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const reduccion =
    resultado && resultado.originalSize > 0
      ? Math.max(0, Math.round((1 - resultado.compressedSize / resultado.originalSize) * 100))
      : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Minimize2 size={20} color="#c51d25" />
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Ajustar / Achicar PDF</h2>
              {tituloRequisito && (
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>Requisito: {tituloRequisito}</div>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-outline btn-sm" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleComprimir}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
              Reduce el peso de documentos PDF escaneados (hasta 50 MB) para que cumplan con el límite de subida de 10 MB sin perder legibilidad.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                1. Selecciona el archivo PDF
              </label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                required
                onChange={(e) => {
                  setArchivo(e.target.files?.[0] || null);
                  setResultado(null);
                  setError('');
                }}
                style={{ fontSize: '0.84rem', width: '100%' }}
              />
              {archivo && (
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Tamaño original: <strong>{formatBytes(archivo.size)}</strong>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px' }}>
                2. Nivel de ajuste / compresión
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'ligera', titulo: 'Ligera', desc: 'Sin pérdida' },
                  { id: 'media', titulo: 'Recomendada', desc: 'Buen balance' },
                  { id: 'alta', titulo: 'Máxima', desc: 'Menor peso' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setNivel(opt.id as 'ligera' | 'media' | 'alta');
                      setResultado(null);
                    }}
                    className={`btn btn-sm ${nivel === opt.id ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flexDirection: 'column', gap: '2px', padding: '8px' }}
                  >
                    <span>{opt.titulo}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.85 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px', borderRadius: '8px', fontSize: '0.82rem' }}>
                {error}
              </div>
            )}

            {resultado && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', fontSize: '0.84rem', color: '#166534' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, marginBottom: '4px' }}>
                  <CheckCircle2 size={16} />
                  <span>PDF optimizado correctamente (-{reduccion}%)</span>
                </div>
                <div>
                  Original: <strong>{formatBytes(resultado.originalSize)}</strong> → Nuevo: <strong>{formatBytes(resultado.compressedSize)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cerrar
            </button>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!resultado ? (
                <button type="submit" disabled={!archivo || procesando} className="btn btn-primary">
                  <Minimize2 size={15} />
                  <span>{procesando ? 'Optimizando...' : 'Achicar PDF'}</span>
                </button>
              ) : (
                <>
                  <button type="button" onClick={descargarResultado} className="btn btn-outline">
                    <FileDown size={15} />
                    <span>Descargar</span>
                  </button>
                  {onUseFile && (
                    <button
                      type="button"
                      onClick={() => {
                        onUseFile(resultado.file);
                        onClose();
                      }}
                      className="btn btn-success"
                    >
                      <Upload size={15} />
                      <span>Usar y Subir</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
