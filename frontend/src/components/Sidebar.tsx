import React, { useEffect, useState } from 'react';
import { 
  School, 
  Award, 
  Stethoscope, 
  FileText, 
  BookOpen, 
  LayoutDashboard,
  Settings,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { Usuario } from '../types';
import { SeguimientoService } from '../services/api';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  selectedCategory: string | null;
  setSelectedCategory: (cat: string | null) => void;
  usuario: Usuario | null;
}

const esSuperAdminLabel = (u: Usuario | null) =>
  u?.rol === 'ADMINISTRADOR' || u?.rol === 'SUPERADMIN' ? 'Todos los Programas' : 'Mis Programas';

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeView, 
  setActiveView, 
  selectedCategory, 
  setSelectedCategory,
  usuario
}) => {
  const categoriasAcademicas = [
    { id: 'all', label: esSuperAdminLabel(usuario), icon: LayoutDashboard },
    { id: 'doctorado', label: 'Doctorado', icon: School },
    { id: 'maestrias', label: 'Maestrías', icon: Award },
    { id: 'especialidad', label: 'Especialidad', icon: Stethoscope },
    { id: 'diplomados', label: 'Diplomados', icon: FileText },
    { id: 'cursos', label: 'Cursos y Seminarios', icon: BookOpen },
  ];

  const esSuperAdmin = usuario?.rol === 'ADMINISTRADOR' || usuario?.rol === 'SUPERADMIN';

  // El personal (coordinador/revisor) solo ve las categorías donde tiene programas asignados.
  const [categoriasPropias, setCategoriasPropias] = useState<string[] | null>(null);
  const normalizar = (t: string) =>
    t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-');

  useEffect(() => {
    SeguimientoService.getMisCursos()
      .then((cursos) => {
        if (!esSuperAdmin) setCategoriasPropias(cursos.map((c) => normalizar(c.categoria_nombre)));
      })
      .catch(() => {
        if (!esSuperAdmin) setCategoriasPropias([]);
      });
  }, [esSuperAdmin, usuario?.id_usuario]);

  const categoriasVisibles = categoriasAcademicas.filter(
    (cat) =>
      cat.id === 'all' ||
      esSuperAdmin ||
      (categoriasPropias !== null && categoriasPropias.some((c) => c.includes(cat.id)))
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        Oferta Académica
      </div>
      <ul className="sidebar-menu">
        {categoriasVisibles.map((cat) => {
          const Icon = cat.icon;
          const isSelected = activeView === 'cursos' && (selectedCategory === cat.id || (cat.id === 'all' && !selectedCategory));
          return (
            <li 
              key={cat.id}
              className={`sidebar-item ${isSelected ? 'active' : ''}`}
              onClick={() => {
                setActiveView('cursos');
                setSelectedCategory(cat.id === 'all' ? null : cat.id);
              }}
            >
              <Icon size={18} />
              <span>{cat.label}</span>
            </li>
          );
        })}
      </ul>

      {/* APARTADO DE AJUSTES EXCLUSIVO PARA ADMINISTRADOR */}
      {esSuperAdmin && (
        <div style={{ padding: '0 8px', marginTop: '10px' }}>
          <div style={{ padding: '10px 16px 4px 16px', fontSize: '0.74rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} />
            <span>Administración</span>
          </div>
          <ul className="sidebar-menu" style={{ padding: '4px 0' }}>
            <li
              className={`sidebar-item ${activeView === 'ajustes' ? 'active' : ''}`}
              onClick={() => setActiveView('ajustes')}
              style={{ color: activeView === 'ajustes' ? '#dc2626' : '#1e293b' }}
            >
              <Settings size={18} />
              <span>Ajustes del Sistema</span>
            </li>
            <li
              className={`sidebar-item ${activeView === 'reportes' ? 'active' : ''}`}
              onClick={() => setActiveView('reportes')}
              style={{ color: activeView === 'reportes' ? '#c51d25' : '#1e293b' }}
            >
              <BarChart3 size={18} />
              <span>Reportes</span>
            </li>
          </ul>
        </div>
      )}



      <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
        <div style={{ fontWeight: 600, color: '#c51d25', marginBottom: '4px' }}>UPI - FINI</div>
        <div>Gestión y Control de Inscripciones</div>
      </div>
    </aside>
  );
};
