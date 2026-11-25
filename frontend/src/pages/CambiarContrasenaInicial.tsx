import React, { useState } from 'react';
import { AlertCircle, ArrowRight, KeyRound, Lock } from 'lucide-react';
import { AuthService } from '../services/api';
import { Usuario } from '../types';

interface Props {
  usuario: Usuario;
  onComplete: () => void;
  onLogout: () => void;
}

export const CambiarContrasenaInicial: React.FC<Props> = ({ usuario, onComplete, onLogout }) => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (nueva.length < 8) return setError('La nueva contraseña debe tener al menos 8 caracteres.');
    if (nueva !== confirmar) return setError('Las contraseñas no coinciden.');
    setGuardando(true);
    try {
      await AuthService.cambiarContrasena(actual, nueva);
      onComplete();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo actualizar la contraseña.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="main-content" style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <main className="page-body" style={{ maxWidth: 620, margin: 'auto', paddingTop: '10vh' }}>
        <section className="card" style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="metric-icon-box reports-icon-brand"><KeyRound size={22} /></span>
            <div><h1 style={{ fontSize: '1.25rem' }}>Cambia tu contraseña</h1><p style={{ color: '#64748b', marginTop: 4 }}>La clave temporal de {usuario.nombre_usuario} debe cambiarse antes de continuar.</p></div>
          </div>
          {error && <div className="login-feedback login-feedback-error"><AlertCircle size={18} />{error}</div>}
          <form onSubmit={guardar} style={{ display: 'grid', gap: 12 }}>
            <label className="login-label">Clave temporal actual<div className="login-input-wrap" style={{ marginTop: 6, marginBottom: 0 }}><Lock size={18} /><input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} /></div></label>
            <label className="login-label">Nueva contraseña<div className="login-input-wrap" style={{ marginTop: 6, marginBottom: 0 }}><Lock size={18} /><input type="password" minLength={8} autoComplete="new-password" required value={nueva} onChange={(e) => setNueva(e.target.value)} /></div></label>
            <label className="login-label">Confirmar nueva contraseña<div className="login-input-wrap" style={{ marginTop: 6, marginBottom: 0 }}><Lock size={18} /><input type="password" minLength={8} autoComplete="new-password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} /></div></label>
            <button type="submit" className="btn btn-primary login-submit" disabled={guardando}>{guardando ? 'Actualizando...' : 'Guardar y continuar'} <ArrowRight size={18} /></button>
          </form>
          <button type="button" className="login-link" style={{ justifySelf: 'start' }} onClick={onLogout}>Cerrar sesión</button>
        </section>
      </main>
    </div>
  );
};
