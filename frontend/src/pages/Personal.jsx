import { useEffect, useState } from 'react';
import { UserPlus, KeyRound, Power } from 'lucide-react';
import { getPersonal, createPersonal, updatePersonal } from '../services/personalService';
import { ETIQUETA_ROL } from '../utils/roles';

const inputClase =
  'w-full px-4 py-2.5 rounded-lg border border-pizarra-900/15 bg-white focus:outline-none focus:ring-2 focus:ring-mostaza-500 focus:border-transparent';

const vacio = { name: '', email: '', password: '', rol: 'mesero' };

function Personal() {
  const [personal, setPersonal] = useState([]);
  const [form, setForm] = useState(vacio);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      setPersonal(await getPersonal());
    } catch {
      setError('No se pudo cargar el personal');
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  const crear = async (e) => {
    e.preventDefault();
    setError('');
    setOk('');
    setGuardando(true);
    try {
      await createPersonal(form);
      setForm(vacio);
      setOk('Usuario creado');
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el usuario');
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (p) => {
    setError('');
    setOk('');
    try {
      await updatePersonal(p.id, { activo: !p.activo });
      cargar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo actualizar');
    }
  };

  const cambiarClave = async (p) => {
    const nueva = window.prompt(`Nueva contraseña para ${p.name} (8 a 72 caracteres):`);
    if (!nueva) return;
    setError('');
    setOk('');
    try {
      await updatePersonal(p.id, { password: nueva });
      setOk(`Contraseña de ${p.name} actualizada`);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña');
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display text-2xl text-pizarra-950">Personal</h1>

      <form
        onSubmit={crear}
        className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4"
      >
        <p className="font-semibold text-pizarra-900 flex items-center gap-2">
          <UserPlus size={18} /> Nuevo usuario
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            className={inputClase}
            placeholder="Nombre (ej: Juan)"
            value={form.name}
            onChange={cambiar('name')}
            required
            maxLength={100}
          />
          <select className={inputClase} value={form.rol} onChange={cambiar('rol')}>
            <option value="mesero">Mesero</option>
            <option value="cocina">Cocina</option>
            <option value="caja">Caja</option>
          </select>
          <input
            className={inputClase}
            type="email"
            placeholder="Usuario (ej: mesero1@lacocina.com)"
            value={form.email}
            onChange={cambiar('email')}
            required
          />
          <input
            className={inputClase}
            type="text"
            placeholder="Contraseña (mínimo 8 caracteres)"
            value={form.password}
            onChange={cambiar('password')}
            required
            minLength={8}
            maxLength={72}
          />
        </div>
        <p className="text-xs text-pizarra-900/60">
          El usuario tiene forma de correo, pero no tiene que existir de verdad. Debe ser único.
        </p>
        {error && <p className="text-terracota-600 text-sm">{error}</p>}
        {ok && <p className="text-green-700 text-sm">{ok}</p>}
        <button
          type="submit"
          disabled={guardando}
          className="bg-mostaza-500 hover:bg-mostaza-600 disabled:opacity-60 text-pizarra-950 font-semibold px-5 py-2.5 rounded-lg"
        >
          {guardando ? 'Creando…' : 'Crear usuario'}
        </button>
      </form>

      <div className="space-y-2">
        {personal.length === 0 && (
          <p className="text-pizarra-900/60">Todavía no has creado usuarios de personal.</p>
        )}
        {personal.map((p) => (
          <div
            key={p.id}
            className={`bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-4 flex flex-wrap items-center justify-between gap-3 ${
              p.activo ? '' : 'opacity-60'
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium truncate">
                {p.name}{' '}
                <span className="text-xs bg-pizarra-900/10 rounded-full px-2 py-0.5 ml-1">
                  {ETIQUETA_ROL[p.rol]}
                </span>
              </p>
              <p className="text-sm text-pizarra-900/60 truncate">{p.email}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => cambiarClave(p)}
                className="flex items-center gap-1.5 text-sm border border-pizarra-900/20 rounded-lg px-3 py-2"
              >
                <KeyRound size={15} /> Clave
              </button>
              <button
                onClick={() => alternarActivo(p)}
                className={`flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 border ${
                  p.activo
                    ? 'border-terracota-500 text-terracota-600'
                    : 'border-green-600 text-green-700'
                }`}
              >
                <Power size={15} /> {p.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Personal;