import React, { useState } from 'react';
import { AuthService } from '../services/api';
import { Usuario } from '../types';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (usuario: Usuario) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [identificador, setIdentificador] = useState('');
  const [password, setPassword] = useState('');
  const [nuevaContraseña, setNuevaContraseña] = useState('');
  const [confirmarContraseña, setConfirmarContraseña] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [modoRecuperacion, setModoRecuperacion] = useState(false);
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setLoading(true);
    try {
      const data = await AuthService.login(identificador, password);
      onLoginSuccess(data.usuario);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión. Verifica tus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarRecuperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    setLoading(true);
    try {
      const data = await AuthService.solicitarRecuperacion(identificador);
      setMensaje(data.detail);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo solicitar la recuperación.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestablecer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    if (nuevaContraseña.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (nuevaContraseña !== confirmarContraseña) return setError('Las contraseñas no coinciden.');
    setLoading(true);
    try {
      const data = await AuthService.restablecerContrasena(resetToken, nuevaContraseña);
      setMensaje(data.detail);
      setResetToken('');
      window.history.replaceState({}, '', window.location.pathname);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'El enlace no es válido o expiró. Solicita uno nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const titulo = resetToken ? 'Crear nueva contraseña' : modoRecuperacion ? 'Recuperar contraseña' : 'Unidad de Postgrado';

  return (
    <div className="login-screen">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <img src="/upi_escudo.png" alt="Escudo de la Unidad de Postgrado Ichilo" className="login-emblem" />
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>{titulo}</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
            {resetToken ? 'Elige una contraseña segura para tu cuenta' : modoRecuperacion ? 'La solicitud quedará en Ajustes para que el SuperAdmin gestione tu acceso' : 'Recepción y Seguimiento Documental'}
          </p>
        </div>

        {error && <div className="login-feedback login-feedback-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
        {mensaje && <div className="login-feedback login-feedback-success" role="status"><Mail size={18} /><span>{mensaje}</span></div>}

        {resetToken ? (
          <form onSubmit={handleRestablecer}>
            <label className="login-label" htmlFor="new-password">Nueva contraseña</label>
            <div className="login-input-wrap"><Lock size={18} /><input id="new-password" type={mostrarPassword ? 'text' : 'password'} minLength={8} required value={nuevaContraseña} onChange={(e) => setNuevaContraseña(e.target.value)} placeholder="Mínimo 8 caracteres" /><button type="button" className="login-eye" onClick={() => setMostrarPassword((v) => !v)} aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <label className="login-label" htmlFor="confirm-password">Repetir contraseña</label>
            <div className="login-input-wrap"><Lock size={18} /><input id="confirm-password" type={mostrarPassword ? 'text' : 'password'} required value={confirmarContraseña} onChange={(e) => setConfirmarContraseña(e.target.value)} placeholder="Vuelve a escribir la contraseña" /></div>
            <button type="submit" disabled={loading} className="btn btn-primary login-submit">{loading ? 'Guardando...' : 'Restablecer contraseña'} <ArrowRight size={18} /></button>
          </form>
        ) : modoRecuperacion ? (
          <form onSubmit={handleSolicitarRecuperacion}>
            <label className="login-label" htmlFor="recover-id">Cédula o correo electrónico</label>
            <div className="login-input-wrap"><User size={18} /><input id="recover-id" type="text" required value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="CI o correo registrado" /></div>
            <button type="submit" disabled={loading} className="btn btn-primary login-submit">{loading ? 'Enviando...' : 'Enviar instrucciones'} <ArrowRight size={18} /></button>
            <button type="button" className="login-link login-back" onClick={() => { setModoRecuperacion(false); setError(null); setMensaje(null); }}><ArrowLeft size={15} /> Volver al inicio de sesión</button>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="login-label" htmlFor="login-id">Cédula de Identidad o Correo Electrónico</label>
            <div className="login-input-wrap"><User size={18} /><input id="login-id" type="text" required autoComplete="username" value={identificador} onChange={(e) => setIdentificador(e.target.value)} placeholder="Ej. 1234567 o admin@example.invalid" /></div>
            <label className="login-label" htmlFor="login-password">Contraseña</label>
            <div className="login-input-wrap"><Lock size={18} /><input id="login-password" type={mostrarPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ingresa tu contraseña" /><button type="button" className="login-eye" onClick={() => setMostrarPassword((v) => !v)} aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <div className="login-forgot-row"><button type="button" className="login-link" onClick={() => { setModoRecuperacion(true); setError(null); setMensaje(null); }}>¿Olvidaste tu contraseña?</button></div>
            <button type="submit" disabled={loading} className="btn btn-primary login-submit">{loading ? 'Accediendo...' : 'Iniciar Sesión'} <ArrowRight size={18} /></button>
          </form>
        )}
      </div>
    </div>
  );
};
