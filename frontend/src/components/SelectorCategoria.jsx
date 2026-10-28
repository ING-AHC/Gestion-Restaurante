import { useState } from 'react';
import { createCategoriaGasto } from '../services/categoriaGastoService';

const NUEVA = '__nueva__';

// Selector de categoría que permite crear una nueva sin salir de la pantalla.
// - categorias: lista actual
// - onCreada(nueva): el padre agrega la categoría a su lista
// - onChange(id): se llama con el id (texto) de la categoría escogida
function SelectorCategoria({
  value,
  onChange,
  categorias,
  onCreada,
  required = false,
  textoVacio = 'Selecciona...',
  className = '',
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const alCambiar = (e) => {
    if (e.target.value === NUEVA) {
      setCreando(true);
      setError('');
      return;
    }
    onChange(e.target.value);
  };

  const cancelar = () => {
    setCreando(false);
    setNombre('');
    setError('');
  };

  const crear = async () => {
    const limpio = nombre.trim();
    if (!limpio) return setError('Escribe el nombre');
    setGuardando(true);
    setError('');
    try {
      const nueva = await createCategoriaGasto({ nombre: limpio });
      onCreada(nueva);
      onChange(String(nueva.id));
      cancelar();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear la categoría');
    } finally {
      setGuardando(false);
    }
  };

  const estiloCampo =
    'px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm';

  return (
    <div className={className}>
      <select
        value={creando ? NUEVA : value}
        onChange={alCambiar}
        required={required && !creando}
        className={`w-full ${estiloCampo}`}
      >
        <option value="">{textoVacio}</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
        <option value={NUEVA}>+ Crear categoría nueva…</option>
      </select>

      {creando && (
        <div className="mt-2 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  crear();
                }
              }}
              placeholder="Nombre de la categoría"
              maxLength={60}
              autoFocus
              className={`flex-1 min-w-0 ${estiloCampo}`}
            />
            <button
              type="button"
              onClick={crear}
              disabled={guardando}
              className="bg-mostaza-500 hover:bg-mostaza-600 disabled:opacity-60 text-pizarra-950 font-semibold px-3 rounded-lg text-sm"
            >
              {guardando ? '…' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={cancelar}
              className="border border-pizarra-900/15 text-pizarra-700 font-semibold px-3 rounded-lg text-sm"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-terracota-600 text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default SelectorCategoria;