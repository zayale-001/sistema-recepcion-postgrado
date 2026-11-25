import React, { useState, useEffect } from 'react';
import { CursoResumen } from '../types';
import { SeguimientoService } from '../services/api';
import { 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileSpreadsheet, 
  ArrowRight,
  School,
  Search
} from 'lucide-react';

interface DashboardCoordinadorProps {
  onSelectCurso: (curso: CursoResumen) => void;
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export const DashboardCoordinador: React.FC<DashboardCoordinadorProps> = ({ 
  onSelectCurso, 
  selectedCategory,
  onSelectCategory
}) => {
  const [cursos, setCursos] = useState<CursoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [gestionFiltro, setGestionFiltro] = useState('');
  const [plazoFiltro, setPlazoFiltro] = useState('');

  useEffect(() => {
    cargarCursos();
  }, []);

  const cargarCursos = async () => {
    try {
      setLoading(true);
      const data = await SeguimientoService.getMisCursos();
      setCursos(data);
    } catch (err) {
      console.error('Error al cargar cursos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado por categoría y búsqueda
  const categoriasDisponibles = [...new Set(cursos.map(c => c.categoria_nombre))].sort((a, b) => a.localeCompare(b));
  const gestionesDisponibles = [...new Set(cursos.map(c => c.gestion))].sort((a, b) => Number(b) - Number(a));
  const categoriaSeleccionadaFiltro = selectedCategory
    ? categoriasDisponibles.map(categoria => ({
        nombre: categoria,
        slug: categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-')
      })).find(categoria => categoria.slug.includes(selectedCategory))?.slug || ''
    : '';

  const cursosFiltrados = cursos.filter(c => {
    const matchSearch = c.programa_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.version_edicion.toLowerCase().includes(searchTerm.toLowerCase());
    
    const catSlug = c.categoria_nombre.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ /g, "-");
    const matchCategory = !selectedCategory || catSlug.includes(selectedCategory);
    const matchGestion = !gestionFiltro || c.gestion === gestionFiltro;
    const matchPlazo = !plazoFiltro || c.estado_plazo === plazoFiltro;
    return matchSearch && matchCategory && matchGestion && matchPlazo;
  });

  const limpiarFiltros = () => {
    setSearchTerm('');
    onSelectCategory(null);
    setGestionFiltro('');
    setPlazoFiltro('');
  };

  // Totales consolidados
  const totalInscritos = cursos.reduce((acc, c) => acc + c.total_estudiantes, 0);
  const totalCompletos = cursos.reduce((acc, c) => acc + c.estudiantes_completos, 0);
  const totalObservados = cursos.reduce((acc, c) => acc + c.estudiantes_observados, 0);
  const totalFaltantes = cursos.reduce((acc, c) => acc + c.estudiantes_faltantes, 0);

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando programas y seguimiento documental...</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            Panel de Seguimiento Documental
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', marginTop: '4px' }}>
            Supervisión del cumplimiento de requisitos por curso y postulante
          </p>
        </div>

      </div>

      {/* Tarjetas de métricas consolidadas */}
      <div className="grid-cols-4">
        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#fff5f5', color: '#c51d25' }}>
            <School size={24} />
          </div>
          <div>
            <div className="metric-number">{cursos.length}</div>
            <div className="metric-label">Convocatorias asignadas</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="metric-number">{totalCompletos}</div>
            <div className="metric-label">Expedientes Completos</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#fef9c3', color: '#ca8a04' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="metric-number">{totalFaltantes}</div>
            <div className="metric-label">Faltan Documentos</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="metric-number">{totalObservados}</div>
            <div className="metric-label">Con Observaciones</div>
          </div>
        </div>
      </div>

      {/* Lista de programas */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>
        {selectedCategory ? `Programas en categoría: ${selectedCategory.toUpperCase()}` : 'Todos los Programas Asignados'}
      </h2>

      <div className="program-filter-bar" aria-label="Filtros de programas">
        <div className="program-filter-search">
          <Search size={16} />
          <input type="search" placeholder="Buscar programa..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </div>
        <label>
          <span>Categoría</span>
          <select value={categoriaSeleccionadaFiltro} onChange={(event) => onSelectCategory(event.target.value || null)}>
            <option value="">Todas</option>
            {categoriasDisponibles.map(categoria => {
              const slug = categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-');
              return <option key={slug} value={slug}>{categoria}</option>;
            })}
          </select>
        </label>
        <label>
          <span>Gestión</span>
          <select value={gestionFiltro} onChange={(event) => setGestionFiltro(event.target.value)}>
            <option value="">Todas</option>
            {gestionesDisponibles.map(gestion => <option key={gestion} value={gestion}>{gestion}</option>)}
          </select>
        </label>
        <label>
          <span>Vigencia</span>
          <select value={plazoFiltro} onChange={(event) => setPlazoFiltro(event.target.value)}>
            <option value="">Todas</option>
            <option value="VIGENTE">Vigente</option>
            <option value="POR_VENCER">Cierra pronto</option>
            <option value="VENCIDO">Plazo vencido</option>
          </select>
        </label>
        <span className="program-filter-count">{cursosFiltrados.length} de {cursos.length} convocatorias</span>
        {(selectedCategory || gestionFiltro || plazoFiltro || searchTerm) && <button type="button" className="program-clear-filters" onClick={limpiarFiltros}>Limpiar filtros</button>}
      </div>

      {cursosFiltrados.length === 0 ? (
        <div className="card program-empty-state" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          No se encontraron programas con los criterios seleccionados.
          {(selectedCategory || gestionFiltro || plazoFiltro || searchTerm) && <button type="button" className="program-clear-filters" onClick={limpiarFiltros}>Limpiar filtros</button>}
        </div>
      ) : (
        <div className="program-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {cursosFiltrados.map((curso) => {
            const porcentajeCompletos = curso.total_estudiantes > 0 
              ? Math.round((curso.estudiantes_completos / curso.total_estudiantes) * 100)
              : 0;

            return (
              <div key={curso.edicion_id} className="card program-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className="badge badge-info">{curso.categoria_nombre}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                      Gestión {curso.gestion}
                    </span>
                  </div>

                  <div className={`program-deadline-tag deadline-${curso.estado_plazo.toLowerCase()}`}>
                    {curso.estado_plazo === 'VENCIDO' ? 'Plazo vencido' : curso.estado_plazo === 'POR_VENCER' ? `Cierra en ${curso.dias_restantes ?? 0} días` : 'Vigente'}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                    {curso.programa_nombre}
                  </h3>

                  <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '16px' }}>
                    {curso.version_edicion} • Encargado: <strong>{curso.coordinador_encargado || 'Sin Asignar'}</strong>
                  </div>

                  {/* Barra de progreso de entrega */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginBottom: '4px' }}>
                      <span>Avance de recepción documental</span>
                      <strong style={{ color: '#0f172a' }}>{porcentajeCompletos}%</strong>
                    </div>
                    <div className="progress-container">
                      <div 
                        className="progress-bar" 
                        style={{ 
                          width: `${porcentajeCompletos}%`,
                          background: porcentajeCompletos === 100 ? '#16a34a' : '#c51d25'
                        }} 
                      />
                    </div>
                  </div>

                  {/* Resumen por estados */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Completos</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#16a34a' }}>{curso.estudiantes_completos}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Faltantes</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ca8a04' }}>{curso.estudiantes_faltantes}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Observados</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>{curso.estudiantes_observados}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} />
                    <span>{curso.total_estudiantes} postulantes</span>
                  </div>

                  <button 
                    onClick={() => onSelectCurso(curso)}
                    className="btn btn-primary btn-sm"
                  >
                    <span>Ver Seguimiento</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
