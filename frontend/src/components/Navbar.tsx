import React from 'react';
import { LogOut } from 'lucide-react';
import { Usuario } from '../types';

interface NavbarProps {
  usuario: Usuario | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ usuario, onLogout }) => {
  const nombreMostrar = usuario?.persona 
    ? `${usuario.persona.nombres} ${usuario.persona.apellidos}`
    : usuario?.nombre_usuario || 'Usuario';

  const ciMostrar = usuario?.persona?.nro_documento || 'S/N';

  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="nav-logo-icon">
          <img src="/upi_escudo.png" alt="Escudo UPI" />
        </div>
        <div>
          <div className="nav-title">UNIDAD DE POSTGRADO (UPI) - FINI</div>
          <div className="nav-subtitle">Sistema de Gestión de Inscripciones y Seguimiento Documental</div>
        </div>
      </div>

      {usuario && (
        <div className="user-profile-menu">
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{nombreMostrar}</div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
              <span className={`badge ${
                usuario.rol === 'ADMINISTRADOR' ? 'badge-danger' : 
                usuario.rol === 'COORDINADOR' ? 'badge-info' : 'badge-neutral'
              }`}>
                {usuario.rol}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>CI: {ciMostrar}</span>
            </div>
          </div>
          <button 
            onClick={onLogout} 
            className="btn btn-outline btn-sm"
            title="Cerrar Sesión"
          >
            <LogOut size={16} />
            <span>Salir</span>
          </button>
        </div>
      )}
    </header>
  );
};
