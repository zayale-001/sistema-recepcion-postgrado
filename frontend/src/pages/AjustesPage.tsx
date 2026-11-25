import React, { useState, useEffect } from 'react';
import { Categoria, Area, Usuario, CursoResumen, ConvocatoriaAbierta } from '../types';
import { CatalogosService, SeguimientoService, AuthService } from '../services/api';
import { 
  Plus, 
  Settings, 
  School, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  X,
  FileText,
  Users,
  Search,
  KeyRound,
  Copy
} from 'lucide-react';

interface PostulanteCuenta {
  id_usuario: string;
  nombre_usuario: string;
  activo: boolean;
  nombres: string;
  apellidos: string;
  ci: string;
  correo: string;
}

interface SolicitudRecuperacionAdmin {
  id: string;
  id_usuario: string;
  usuario: string;
  nombres: string;
  apellidos: string;
  ci: string;
  correo: string;
  solicitada_en: string;
}

export const AjustesPage: React.FC = () => {
  const [tabActiva, setTabActiva] = useState<'programas' | 'convocatorias' | 'coordinadores' | 'postulantes'>('programas');
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [coordinadores, setCoordinadores] = useState<Usuario[]>([]);
  const [cursos, setCursos] = useState<CursoResumen[]>([]);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaAbierta[]>([]);
  const [guardandoConvocatoria, setGuardandoConvocatoria] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado del modal de nuevo programa
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number>(1);
  const [areaSeleccionada, setAreaSeleccionada] = useState<number | undefined>(undefined);
  const [nuevaVersion, setNuevaVersion] = useState('1ra. Versión');
  const [nuevaEdicion, setNuevaEdicion] = useState('1ra. Edición');
  const [nuevaGestion, setNuevaGestion] = useState('2025');
  const [coordinadorSeleccionado, setCoordinadorSeleccionado] = useState<string>('');
  const [tipoRequisitos, setTipoRequisitos] = useState<'defecto' | 'personalizados'>('defecto');
  const [requisitosPersonalizados, setRequisitosPersonalizados] = useState<string[]>([
    'Fotocopia Legalizada de Título',
    'Diploma Académico',
    'Cédula de Identidad Vigente'
  ]);
  const [nuevoReqInput, setNuevoReqInput] = useState('');

  // Estado del formulario de nuevo coordinador
  const [coordCi, setCoordCi] = useState('');
  const [coordNombres, setCoordNombres] = useState('');
  const [coordApellidos, setCoordApellidos] = useState('');
  const [coordEmail, setCoordEmail] = useState('');
  const [coordPassword, setCoordPassword] = useState('');
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [busquedaPostulante, setBusquedaPostulante] = useState('');
  const [postulantes, setPostulantes] = useState<PostulanteCuenta[]>([]);
  const [buscandoPostulantes, setBuscandoPostulantes] = useState(false);
  const [claveTemporal, setClaveTemporal] = useState<{ usuario: string; clave_temporal: string } | null>(null);
  const [generandoClave, setGenerandoClave] = useState<string | null>(null);
  const [solicitudesRecuperacion, setSolicitudesRecuperacion] = useState<SolicitudRecuperacionAdmin[]>([]);
  const [resolviendoSolicitud, setResolviendoSolicitud] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [cats, coords, curs, convs] = await Promise.all([
        CatalogosService.getCategorias(),
        CatalogosService.getCoordinadores(),
        SeguimientoService.getMisCursos(),
        CatalogosService.getConvocatorias()
      ]);
      setCategorias(cats);
      setCoordinadores(coords);
      setCursos(curs);
      setConvocatorias(convs);

      if (cats.length > 0) {
        setCategoriaSeleccionada(cats[0].id);
        const areasData = await CatalogosService.getAreas(cats[0].id);
        setAreas(areasData);
      }
    } catch (err) {
      console.error('Error al cargar datos de ajustes:', err);
    } finally {
      setLoading(false);
    }
  };

  const editarConvocatoriaLocal = (id: string, campo: 'estado' | 'cupo' | 'fecha_fin', valor: string) => {
    setConvocatorias(actuales => actuales.map(c => c.id_convocatoria === id ? {
      ...c,
      [campo]: campo === 'cupo' ? Number(valor) : campo === 'fecha_fin' ? (valor ? `${valor}T23:59:59` : undefined) : valor
    } : c));
  };

  const guardarConvocatoria = async (convocatoria: ConvocatoriaAbierta) => {
    try {
      setGuardandoConvocatoria(convocatoria.id_convocatoria);
      const guardada = await CatalogosService.actualizarConvocatoria(convocatoria.id_convocatoria, {
        estado: convocatoria.estado,
        cupo: convocatoria.cupo,
        fecha_fin: convocatoria.fecha_fin || null
      });
      setConvocatorias(actuales => actuales.map(c => c.id_convocatoria === guardada.id_convocatoria ? guardada : c));
      setMensajeExito('Convocatoria actualizada correctamente.');
      setMensajeError(null);
    } catch (err: any) {
      setMensajeError(err.response?.data?.detail || 'No se pudo actualizar la convocatoria.');
      setMensajeExito(null);
    } finally {
      setGuardandoConvocatoria(null);
    }
  };

  const fechaParaInput = (fecha?: string) => {
    if (!fecha) return '';
    const valor = new Date(fecha);
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  };

  const handleCambiarCategoria = async (catId: number) => {
    setCategoriaSeleccionada(catId);
    setAreaSeleccionada(undefined);
    try {
      const areasData = await CatalogosService.getAreas(catId);
      setAreas(areasData);
    } catch (err) {
      setAreas([]);
    }
  };

  const buscarCuentasPostulantes = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBuscandoPostulantes(true);
    setMensajeError(null);
    setClaveTemporal(null);
    try {
      const [resultados, solicitudes] = await Promise.all([
        AuthService.buscarPostulantesAdmin(busquedaPostulante),
        AuthService.listarSolicitudesRecuperacionAdmin(),
      ]);
      setPostulantes(resultados);
      setSolicitudesRecuperacion(solicitudes);
    } catch (err: any) {
      setMensajeError(err.response?.data?.detail || 'No se pudieron buscar las cuentas de postulantes.');
    } finally {
      setBuscandoPostulantes(false);
    }
  };

  const atenderSolicitudRecuperacion = async (solicitudId: string) => {
    setResolviendoSolicitud(solicitudId);
    setMensajeError(null);
    setClaveTemporal(null);
    try {
      const resultado = await AuthService.resolverSolicitudRecuperacionAdmin(solicitudId);
      setClaveTemporal(resultado);
      setSolicitudesRecuperacion((actuales) => actuales.filter((solicitud) => solicitud.id !== solicitudId));
    } catch (err: any) {
      setMensajeError(err.response?.data?.detail || 'No se pudo atender la solicitud de recuperación.');
    } finally {
      setResolviendoSolicitud(null);
    }
  };

  const generarClavePostulante = async (idUsuario: string) => {
    setGenerandoClave(idUsuario);
    setMensajeError(null);
    setClaveTemporal(null);
    try {
      const resultado = await AuthService.generarClaveTemporalPostulante(idUsuario);
      setClaveTemporal(resultado);
    } catch (err: any) {
      setMensajeError(err.response?.data?.detail || 'No se pudo generar una clave temporal.');
    } finally {
      setGenerandoClave(null);
    }
  };

  const handleAgregarRequisitoPersonalizado = () => {
    if (nuevoReqInput.trim()) {
      setRequisitosPersonalizados([...requisitosPersonalizados, nuevoReqInput.trim()]);
      setNuevoReqInput('');
    }
  };

  const handleQuitarRequisito = (index: number) => {
    setRequisitosPersonalizados(requisitosPersonalizados.filter((_, i) => i !== index));
  };

  const handleCrearPrograma = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    try {
      const payload = {
        nombre: nuevoNombre,
        codigo: nuevoCodigo || undefined,
        categoria_id: categoriaSeleccionada,
        area_id: areaSeleccionada || undefined,
        version: nuevaVersion,
        edicion: nuevaEdicion,
        gestion: nuevaGestion,
        coordinador_id: coordinadorSeleccionado || undefined,
        requisitos_nombres: tipoRequisitos === 'personalizados' ? requisitosPersonalizados : undefined
      };

      await CatalogosService.crearPrograma(payload);
      setMensajeExito(`¡Programa "${nuevoNombre}" creado exitosamente!`);
      setModalAbierto(false);
      // Limpiar
      setNuevoNombre('');
      setNuevoCodigo('');
      await cargarDatos();
    } catch (err: any) {
      setMensajeError(err.response?.data?.detail || 'Error al crear el programa.');
    }
  };

  const handleCrearCoordinador = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    try {
      await AuthService.crearUsuario({
        ci: coordCi,
        nombres: coordNombres,
        apellidos: coordApellidos,
        email: coordEmail,
        password: coordPassword,
        rol: 'COORDINADOR'
      });
      setMensajeExito(`¡Coordinador ${coordNombres} ${coordApellidos} registrado con éxito!`);
      setCoordCi('');
      setCoordNombres('');
      setCoordApellidos('');
      setCoordEmail('');
      setCoordPassword('');
      await cargarDatos();
    } catch (err: any) {
      setMensajeError(err.response?.data?.detail || 'Error al registrar el coordinador.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-danger">Exclusivo SuperAdmin</span>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Dirección de Postgrado</span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
            Ajustes y Configuración del Sistema
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
            Crea nuevos programas académicos, administra coordinadores y personaliza requisitos documentales.
          </p>
        </div>

        {tabActiva === 'programas' && (
          <button onClick={() => setModalAbierto(true)} className="btn btn-primary">
            <Plus size={18} />
            <span>Agregar Nuevo Programa</span>
          </button>
        )}
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
          <CheckCircle2 size={18} />
          <span>{mensajeExito}</span>
        </div>
      )}
      {mensajeError && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
          <AlertCircle size={18} />
          <span>{mensajeError}</span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          onClick={() => setTabActiva('convocatorias')}
          className={`btn ${tabActiva === 'convocatorias' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <Settings size={16} />
          <span>Convocatorias ({convocatorias.length})</span>
        </button>
        <button
          onClick={() => setTabActiva('programas')}
          className={`btn ${tabActiva === 'programas' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <School size={16} />
          <span>Oferta Académica y Programas ({cursos.length})</span>
        </button>
        <button
          onClick={() => setTabActiva('coordinadores')}
          className={`btn ${tabActiva === 'coordinadores' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <Users size={16} />
          <span>Gestión de Coordinadores ({coordinadores.length})</span>
        </button>
        <button
          onClick={() => { setTabActiva('postulantes'); void buscarCuentasPostulantes(); }}
          className={`btn ${tabActiva === 'postulantes' ? 'btn-primary' : 'btn-outline'}`}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <Users size={16} />
          <span>Cuentas de Postulantes</span>
        </button>
      </div>

      {/* TAB 1: PROGRAMAS */}
      {tabActiva === 'programas' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>N°</th>
                <th>Programa Académico</th>
                <th>Nivel / Categoría</th>
                <th>Versión y Edición</th>
                <th>Gestión</th>
                <th>Coordinador Encargado</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Inscritos</th>
              </tr>
            </thead>
            <tbody>
              {cursos.map((c, idx) => (
                <tr key={c.edicion_id}>
                  <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{c.programa_nombre}</td>
                  <td>
                    <span className="badge badge-info">{c.categoria_nombre}</span>
                  </td>
                  <td>{c.version_edicion}</td>
                  <td>{c.gestion}</td>
                  <td>
                    <strong>{c.coordinador_encargado || 'Sin Asignar'}</strong>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{c.total_estudiantes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tabActiva === 'convocatorias' && (
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Programa y edición</th><th>Postulantes</th><th>Estado</th><th>Cupo</th><th>Fecha de cierre</th><th>Acción</th></tr></thead>
            <tbody>
              {convocatorias.map(c => (
                <tr key={c.id_convocatoria}>
                  <td style={{ minWidth: '280px' }}>{c.titulo_completo}</td>
                  <td>{cursos.find(curso => curso.edicion_id === c.id_convocatoria)?.total_estudiantes ?? 0} / {c.cupo}</td>
                  <td>
                    <select value={c.estado} onChange={e => editarConvocatoriaLocal(c.id_convocatoria, 'estado', e.target.value)}>
                      <option value="Borrador">Borrador</option><option value="Abierta">Abierta</option><option value="Cerrada">Cerrada</option>
                    </select>
                  </td>
                  <td><input type="number" min="1" value={c.cupo} onChange={e => editarConvocatoriaLocal(c.id_convocatoria, 'cupo', e.target.value)} style={{ width: '90px' }} /></td>
                  <td><input type="date" value={fechaParaInput(c.fecha_fin)} onChange={e => editarConvocatoriaLocal(c.id_convocatoria, 'fecha_fin', e.target.value)} /></td>
                  <td><button className="btn btn-primary btn-sm" disabled={guardandoConvocatoria === c.id_convocatoria} onClick={() => guardarConvocatoria(c)}>{guardandoConvocatoria === c.id_convocatoria ? 'Guardando…' : 'Guardar'}</button></td>
                </tr>
              ))}
              {convocatorias.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>No hay convocatorias registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: COORDINADORES */}
      {tabActiva === 'coordinadores' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }}>
          {/* Formulario de registro de coordinador */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18} color="#c51d25" />
              <span>Registrar Nuevo Coordinador</span>
            </h3>

            <form onSubmit={handleCrearCoordinador}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Cédula de Identidad *</label>
                <input
                  type="text"
                  required
                  value={coordCi}
                  onChange={(e) => setCoordCi(e.target.value)}
                  placeholder="Ej. 4567890"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Nombres *</label>
                  <input
                    type="text"
                    required
                    value={coordNombres}
                    onChange={(e) => setCoordNombres(e.target.value)}
                    placeholder="Ej. Fernando"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={coordApellidos}
                    onChange={(e) => setCoordApellidos(e.target.value)}
                    placeholder="Ej. Morales"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Correo Electrónico *</label>
                <input
                  type="email"
                  required
                  value={coordEmail}
                  onChange={(e) => setCoordEmail(e.target.value)}
                  placeholder="f.morales@postgrado.edu"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Contraseña de Acceso *</label>
                <input
                  type="password"
                  required
                  value={coordPassword}
                  onChange={(e) => setCoordPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <UserPlus size={16} />
                <span>Registrar Coordinador</span>
              </button>
            </form>
          </div>

          {/* Lista de coordinadores existentes */}
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '14px' }}>
              Coordinadores Registrados
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {coordinadores.map((coord) => {
                const nombreCoord = coord.persona ? `${coord.persona.nombres} ${coord.persona.apellidos}` : coord.nombre_usuario;
                const correoCoord = coord.persona ? coord.persona.correo : coord.nombre_usuario;
                const ciCoord = coord.persona ? coord.persona.nro_documento : 'S/N';
                return (
                  <div key={coord.id_usuario} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{nombreCoord}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>CI: {ciCoord} • {correoCoord}</div>
                    </div>
                    <span className="badge badge-info">Coordinador</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tabActiva === 'postulantes' && (
        <section className="card admin-applicant-accounts">
          <div className="admin-applicant-heading">
            <div>
              <h2>Acceso de postulantes</h2>
              <p>Busca por nombre, CI o correo y atiende las solicitudes de recuperación. Las contraseñas existentes no se pueden consultar.</p>
            </div>
          </div>
          <section className="admin-recovery-queue">
            <div className="admin-recovery-heading"><div><h3>Solicitudes pendientes</h3><p>Las solicitudes se registran aquí aunque no esté configurado el envío de correo.</p></div><span>{solicitudesRecuperacion.length}</span></div>
            {solicitudesRecuperacion.length === 0 ? <p className="admin-recovery-empty">No hay solicitudes pendientes.</p> : (
              <div className="table-wrapper admin-account-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Postulante</th><th>Usuario / CI</th><th>Correo</th><th>Solicitada</th><th>Acción</th></tr></thead>
                  <tbody>{solicitudesRecuperacion.map((solicitud) => (
                    <tr key={solicitud.id}>
                      <td><strong>{solicitud.apellidos}, {solicitud.nombres}</strong></td>
                      <td>{solicitud.usuario}<small>CI: {solicitud.ci || '—'}</small></td>
                      <td>{solicitud.correo || '—'}</td>
                      <td>{new Date(solicitud.solicitada_en).toLocaleString()}</td>
                      <td><button type="button" className="btn btn-primary btn-sm" disabled={resolviendoSolicitud === solicitud.id} onClick={() => atenderSolicitudRecuperacion(solicitud.id)}><KeyRound size={14} /> {resolviendoSolicitud === solicitud.id ? 'Generando...' : 'Generar clave temporal'}</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
          <form className="admin-account-search" onSubmit={buscarCuentasPostulantes}>
            <Search size={18} />
            <input value={busquedaPostulante} onChange={(e) => setBusquedaPostulante(e.target.value)} placeholder="Buscar postulante por nombre, CI o correo" />
            <button type="submit" className="btn btn-primary" disabled={buscandoPostulantes}>{buscandoPostulantes ? 'Buscando...' : 'Buscar'}</button>
          </form>
          <div className="admin-account-note">Por seguridad, el sistema guarda contrasenas como hash. La clave temporal se muestra una sola vez; compartela por un canal privado.</div>

          {claveTemporal && (
            <div className="admin-temporary-password" role="status">
              <div><strong>Clave temporal generada para {claveTemporal.usuario}</strong><code>{claveTemporal.clave_temporal}</code><small>Copiala ahora; no volvera a mostrarse.</small></div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(claveTemporal.clave_temporal)}><Copy size={15} /> Copiar</button>
            </div>
          )}

          <div className="table-wrapper admin-account-table-wrap">
            <table className="data-table">
              <thead><tr><th>Postulante</th><th>Usuario</th><th>CI</th><th>Correo</th><th>Contrasena</th><th>Cuenta</th></tr></thead>
              <tbody>
                {postulantes.map((postulante) => (
                  <tr key={postulante.id_usuario}>
                    <td><strong>{postulante.apellidos}, {postulante.nombres}</strong></td>
                    <td>{postulante.nombre_usuario}</td>
                    <td>{postulante.ci || '?'}</td>
                    <td>{postulante.correo || '?'}</td>
                    <td><button type="button" className="btn btn-outline btn-sm" disabled={generandoClave === postulante.id_usuario} onClick={() => generarClavePostulante(postulante.id_usuario)}><KeyRound size={14} /> {generandoClave === postulante.id_usuario ? 'Generando...' : 'Generar clave temporal'}</button></td>
                    <td><span className={`badge ${postulante.activo ? 'badge-success' : 'badge-danger'}`}>{postulante.activo ? 'Activa' : 'Inactiva'}</span></td>
                  </tr>
                ))}
                {!buscandoPostulantes && postulantes.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#64748b' }}>No se encontraron postulantes. Busca por datos o deja vacio para listar las cuentas.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* MODAL PARA AGREGAR NUEVO PROGRAMA */}
      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                  Crear Nuevo Programa / Curso
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  Añade un nuevo programa a la oferta académica y configura sus requisitos
                </p>
              </div>
              <button onClick={() => setModalAbierto(false)} className="btn btn-outline btn-sm" style={{ padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCrearPrograma}>
              <div className="modal-body">
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Nombre del Programa o Curso *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    placeholder="Ej. Maestría en Inteligencia Artificial y Big Data"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Nivel / Categoría Académica *
                    </label>
                    <select
                      value={categoriaSeleccionada}
                      onChange={(e) => handleCambiarCategoria(Number(e.target.value))}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      {categorias.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Código / Sigla (Opcional)
                    </label>
                    <input
                      type="text"
                      value={nuevoCodigo}
                      onChange={(e) => setNuevoCodigo(e.target.value)}
                      placeholder="Ej. MAE-IA-1"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                {/* Si la categoría tiene áreas (ej. Maestrías) */}
                {areas.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Área de Conocimiento
                    </label>
                    <select
                      value={areaSeleccionada || ''}
                      onChange={(e) => setAreaSeleccionada(e.target.value ? Number(e.target.value) : undefined)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="">-- Seleccionar Área --</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Versión</label>
                    <input
                      type="text"
                      value={nuevaVersion}
                      onChange={(e) => setNuevaVersion(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Edición</label>
                    <input
                      type="text"
                      value={nuevaEdicion}
                      onChange={(e) => setNuevaEdicion(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>Gestión</label>
                    <input
                      type="text"
                      value={nuevaGestion}
                      onChange={(e) => setNuevaGestion(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Asignar Coordinador Encargado
                  </label>
                  <select
                    value={coordinadorSeleccionado}
                    onChange={(e) => setCoordinadorSeleccionado(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="">-- Asignar más adelante --</option>
                    {coordinadores.map((coord) => {
                      const nombreCoord = coord.persona ? `${coord.persona.nombres} ${coord.persona.apellidos}` : coord.nombre_usuario;
                      const correoCoord = coord.persona ? coord.persona.correo : coord.nombre_usuario;
                      return (
                        <option key={coord.id_usuario} value={coord.id_usuario}>
                          {nombreCoord} ({correoCoord})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Requisitos Documentales */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: '#c51d25' }}>
                    Requisitos Documentales Exigidos
                  </label>
                  
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipoReq"
                        checked={tipoRequisitos === 'defecto'}
                        onChange={() => setTipoRequisitos('defecto')}
                      />
                      <span>Usar requisitos estándar por defecto para este nivel</span>
                    </label>

                    <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="tipoReq"
                        checked={tipoRequisitos === 'personalizados'}
                        onChange={() => setTipoRequisitos('personalizados')}
                      />
                      <span>Personalizar requisitos</span>
                    </label>
                  </div>

                  {tipoRequisitos === 'personalizados' && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <input
                          type="text"
                          value={nuevoReqInput}
                          onChange={(e) => setNuevoReqInput(e.target.value)}
                          placeholder="Nombre del documento (ej. Matrícula Profesional)..."
                          style={{ flex: 1, padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem' }}
                        />
                        <button
                          type="button"
                          onClick={handleAgregarRequisitoPersonalizado}
                          className="btn btn-outline btn-sm"
                        >
                          <Plus size={14} />
                          <span>Agregar</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {requisitosPersonalizados.map((req, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                            <span>{idx + 1}. {req}</span>
                            <button
                              type="button"
                              onClick={() => handleQuitarRequisito(idx)}
                              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setModalAbierto(false)} className="btn btn-outline">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <CheckCircle2 size={16} />
                  <span>Guardar y Crear Programa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
