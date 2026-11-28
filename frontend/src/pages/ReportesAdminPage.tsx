import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Download, FileSpreadsheet, Printer, Search, Users } from 'lucide-react';
import { ReportesService } from '../services/api';
import { CursoResumen, ReportePostulante } from '../types';

export const ReportesAdminPage: React.FC = () => {
  const [programas, setProgramas] = useState<CursoResumen[]>([]);
  const [postulantes, setPostulantes] = useState<ReportePostulante[]>([]);
  const [categoria, setCategoria] = useState('');
  const [gestion, setGestion] = useState('');
  const [estado, setEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [descargandoProgramas, setDescargandoProgramas] = useState(false);
  const [error, setError] = useState('');

  const cargarResumen = useCallback((silencioso = false) => {
    if (!silencioso) setCargando(true);
    ReportesService.obtenerResumenAdmin()
      .then((data) => {
        setProgramas(data.programas);
        setPostulantes(data.postulantes);
      })
      .catch((err) => setError(err.response?.data?.detail || 'No se pudieron cargar los reportes.'))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargarResumen();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarResumen(true);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [cargarResumen]);

  const categorias = useMemo(() => [...new Set(postulantes.map((p) => p.categoria_nombre))].sort((a, b) => a.localeCompare(b)), [postulantes]);
  const gestiones = useMemo(() => [...new Set(postulantes.map((p) => p.gestion))].sort((a, b) => Number(b) - Number(a)), [postulantes]);
  const estados = useMemo(() => [...new Set(postulantes.map((p) => p.estado_nombre))].sort((a, b) => a.localeCompare(b)), [postulantes]);

  const postulantesFiltrados = postulantes.filter((p) => {
    const texto = `${p.ci} ${p.nombres} ${p.apellidos} ${p.email} ${p.programa_nombre} ${p.codigo_inscripcion}`.toLowerCase();
    return (!categoria || p.categoria_nombre === categoria) &&
      (!gestion || p.gestion === gestion) &&
      (!estado || p.estado_nombre === estado) &&
      (!busqueda || texto.includes(busqueda.toLowerCase()));
  });

  const programasFiltrados = programas.filter((p) =>
    (!categoria || p.categoria_nombre === categoria) && (!gestion || p.gestion === gestion)
  );

  const expedientesCompletos = postulantes.filter((p) => ['completa', 'habilitada'].includes(p.estado_nombre.toLowerCase())).length;
  const requierenAtencion = postulantes.filter((p) => p.requisitos_faltantes > 0 || p.requisitos_observados > 0).length;

  const descargar = async () => {
    try {
      setDescargando(true);
      setError('');
      await ReportesService.descargarReporteAdmin({ categoria, gestion, estado, busqueda });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo descargar el reporte.');
    } finally {
      setDescargando(false);
    }
  };

  const descargarProgramas = async () => {
    try {
      setDescargandoProgramas(true);
      setError('');
      await ReportesService.descargarReporteProgramas({ categoria, gestion });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo descargar el resumen por programas.');
    } finally {
      setDescargandoProgramas(false);
    }
  };

  const limpiarFiltros = () => {
    setCategoria('');
    setGestion('');
    setEstado('');
    setBusqueda('');
  };

  if (cargando) return <div className="reports-loading">Cargando reportes institucionales…</div>;

  return (
    <div className="admin-reports-page">
      <header className="reports-page-header">
        <div>
          <span className="reports-eyebrow">Administración · UPI - FINI</span>
          <h1>Reportes institucionales</h1>
          <p>Consulta y descarga el estado de las postulaciones y sus expedientes documentales.</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" type="button" onClick={() => window.print()}>
            <Printer size={17} />
            <span>Imprimir resumen</span>
          </button>
          <button className="btn btn-outline" type="button" onClick={descargarProgramas} disabled={descargandoProgramas || programasFiltrados.length === 0}>
            <FileSpreadsheet size={17} color="#16a34a" />
            <span>{descargandoProgramas ? 'Exportando…' : 'Exportar por programas'}</span>
          </button>
          <button className="btn btn-primary" type="button" onClick={descargar} disabled={descargando || postulantesFiltrados.length === 0}>
            <Download size={17} />
            <span>{descargando ? 'Preparando Excel…' : 'Descargar Excel'}</span>
          </button>
        </div>
      </header>

      {error && <div className="reports-error" role="alert">{error}</div>}

      <div className="grid-cols-4 reports-metrics">
        <div className="metric-card"><div className="metric-icon-box reports-icon-brand"><BarChart3 size={22} /></div><div><div className="metric-number">{programas.length}</div><div className="metric-label">Convocatorias</div></div></div>
        <div className="metric-card"><div className="metric-icon-box reports-icon-neutral"><Users size={22} /></div><div><div className="metric-number">{postulantes.length}</div><div className="metric-label">Postulantes inscritos</div></div></div>
        <div className="metric-card"><div className="metric-icon-box reports-icon-success"><CheckCircle2 size={22} /></div><div><div className="metric-number">{expedientesCompletos}</div><div className="metric-label">Expedientes completos</div></div></div>
        <div className="metric-card"><div className="metric-icon-box reports-icon-warning"><AlertTriangle size={22} /></div><div><div className="metric-number">{requierenAtencion}</div><div className="metric-label">Requieren atención</div></div></div>
      </div>

      <section className="reports-filters" aria-label="Filtros de reportes">
        <label className="reports-search"><span>Buscar postulante</span><div><Search size={16} /><input type="search" placeholder="Nombre, CI, correo o programa" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></div></label>
        <label><span>Categoría</span><select value={categoria} onChange={(e) => setCategoria(e.target.value)}><option value="">Todas</option>{categorias.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Gestión</span><select value={gestion} onChange={(e) => setGestion(e.target.value)}><option value="">Todas</option>{gestiones.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Estado</span><select value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{estados.map((item) => <option key={item}>{item}</option>)}</select></label>
        {(categoria || gestion || estado || busqueda) && <button type="button" className="program-clear-filters" onClick={limpiarFiltros}>Limpiar</button>}
      </section>

      <section className="reports-section">
        <div className="reports-section-heading"><div><h2>Postulantes</h2><p>{postulantesFiltrados.length} registros</p></div></div>
        {postulantesFiltrados.length === 0 ? <div className="card reports-empty">No hay postulantes que coincidan con los filtros.</div> : (
          <div className="table-wrapper reports-table-wrapper">
            <table className="data-table reports-table">
              <thead><tr><th>Postulante</th><th>Programa</th><th>Gestión</th><th>Estado</th><th>Documentos</th><th>Avance</th></tr></thead>
              <tbody>{postulantesFiltrados.map((p) => (
                <tr key={p.inscripcion_id}>
                  <td><strong>{p.apellidos}, {p.nombres}</strong><small>CI {p.ci} · {p.email}</small></td>
                  <td>{p.programa_nombre}<small>{p.categoria_nombre}</small></td>
                  <td>{p.gestion}</td>
                  <td><span className={`report-status report-status-${p.estado_nombre.toLowerCase().replace(/\s+/g, '-')}`}>{p.estado_nombre}</span></td>
                  <td><span className="report-doc-count">{p.requisitos_subidos}/{p.total_requisitos}</span><small>{p.requisitos_faltantes} faltantes · {p.requisitos_observados} observados</small></td>
                  <td><div className="report-progress"><span>{Math.round(p.porcentaje_avance)}%</span><div className="progress-container"><div className="progress-bar" style={{ width: `${p.porcentaje_avance}%`, background: p.porcentaje_avance === 100 ? '#16a34a' : '#c51d25' }} /></div></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="reports-section">
        <div className="reports-section-heading"><div><h2>Resumen por convocatoria</h2><p>Inscripciones y estado documental agrupados por programa.</p></div></div>
        {programasFiltrados.length === 0 ? <div className="card reports-empty">No hay convocatorias para los filtros seleccionados.</div> : (
          <div className="table-wrapper reports-table-wrapper">
            <table className="data-table reports-table">
              <thead><tr><th>Programa</th><th>Categoría</th><th>Gestión</th><th>Postulantes</th><th>Completos</th><th>Faltantes</th><th>Observados</th></tr></thead>
              <tbody>{programasFiltrados.map((p) => (
                <tr key={p.edicion_id}><td><strong>{p.programa_nombre}</strong><small>{p.version_edicion}</small></td><td>{p.categoria_nombre}</td><td>{p.gestion}</td><td>{p.total_estudiantes}</td><td className="report-number-success">{p.estudiantes_completos}</td><td className="report-number-warning">{p.estudiantes_faltantes}</td><td className="report-number-danger">{p.estudiantes_observados}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
