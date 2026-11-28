import React, { useState, useEffect } from 'react';
import { Usuario, CursoResumen, EstudianteSeguimiento } from './types';
import { AuthService } from './services/api';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardCoordinador } from './pages/DashboardCoordinador';
import { SeguimientoCurso } from './pages/SeguimientoCurso';
import { DetalleExpedienteModal } from './pages/DetalleExpedienteModal';
import { EstudiantePortal } from './pages/EstudiantePortal';
import { AjustesPage } from './pages/AjustesPage';
import { ReportesAdminPage } from './pages/ReportesAdminPage';
import { CambiarContrasenaInicial } from './pages/CambiarContrasenaInicial';

export const App: React.FC = () => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [activeView, setActiveView] = useState<string>('cursos');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cursoSeleccionado, setCursoSeleccionado] = useState<CursoResumen | null>(null);
  const [estudianteRevisar, setEstudianteRevisar] = useState<EstudianteSeguimiento | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const user = AuthService.getCurrentUser();
    if (user) {
      setUsuario(user);
    }
  }, []);

  const handleLogout = () => {
    AuthService.logout();
    setUsuario(null);
    setCursoSeleccionado(null);
    setEstudianteRevisar(null);
    setActiveView('cursos');
  };

  if (!usuario) {
    return <LoginPage onLoginSuccess={(u) => setUsuario(u)} />;
  }

  if (usuario.debe_cambiar_contrasena) {
    return (
      <CambiarContrasenaInicial
        usuario={usuario}
        onLogout={handleLogout}
        onComplete={() => {
          const usuarioActualizado = { ...usuario, debe_cambiar_contrasena: false };
          localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));
          setUsuario(usuarioActualizado);
        }}
      />
    );
  }

  // Si es estudiante / postulante, portal enfocado a sus requisitos
  if (usuario.rol === 'POSTULANTE' || usuario.rol === 'ESTUDIANTE') {
    return (
      <div className="main-content" style={{ minHeight: '100vh', background: '#f8fafc' }}>
        <Navbar usuario={usuario} onLogout={handleLogout} />
        <div className="page-body">
          <EstudiantePortal usuario={usuario} />
        </div>
      </div>
    );
  }

  const esAdmin = usuario.rol === 'ADMINISTRADOR' || usuario.rol === 'SUPERADMIN';

  // Panel de Coordinación y Administración
  return (
    <div className="app-container">
      <Sidebar 
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          if (view === 'ajustes' || view === 'reportes') {
            setCursoSeleccionado(null);
          }
        }}
        selectedCategory={selectedCategory}
        setSelectedCategory={(cat) => {
          setSelectedCategory(cat);
          setActiveView('cursos');
          setCursoSeleccionado(null);
        }}
        usuario={usuario}
      />

      <div className="main-content">
        <Navbar usuario={usuario} onLogout={handleLogout} />

        <main className="page-body">
          {activeView === 'reportes' && esAdmin ? (
            <ReportesAdminPage />
          ) : activeView === 'ajustes' && esAdmin ? (
            <AjustesPage />
          ) : cursoSeleccionado ? (
            <SeguimientoCurso 
              curso={cursoSeleccionado}
              onVolver={() => setCursoSeleccionado(null)}
              onVerExpediente={(est) => setEstudianteRevisar(est)}
              refreshKey={refreshKey}
            />
          ) : (
            <DashboardCoordinador 
              onSelectCurso={(c) => setCursoSeleccionado(c)}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              refreshKey={refreshKey}
            />
          )}
        </main>
      </div>

      {/* Modal de Revisión de Expediente */}
      {estudianteRevisar && (
        <DetalleExpedienteModal
          estudiante={estudianteRevisar}
          onClose={() => setEstudianteRevisar(null)}
          onActualizado={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default App;
