import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPlatos, createPlato, asignarInsumosAPlato, deletePlato } from '../services/platoService';import { getInsumos } from '../services/insumoService';

const TIPOS = [
  { value: 'especial', label: 'Especial' },
  { value: 'rapida', label: 'Comida rápida' },
  { value: 'ejecutivo', label: 'Ejecutivo' },
];

function Platos() {
  const [platos, setPlatos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('especial');
  const [precio, setPrecio] = useState('');

  const [platoParaReceta, setPlatoParaReceta] = useState(null);
  const [recetaItems, setRecetaItems] = useState([{ insumo_id: '', cantidad_usada: '' }]);
  const [recetaError, setRecetaError] = useState('');

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [platosData, insumosData] = await Promise.all([getPlatos(), getInsumos()]);
        setPlatos(platosData);
        setInsumos(insumosData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const nuevo = await createPlato({ nombre, tipo, precio: parseFloat(precio) });
      setPlatos((prev) => [...prev, nuevo]);
      setNombre('');
      setTipo('especial');
      setPrecio('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el plato');
    }
  };

  const abrirModalReceta = (plato) => {
    setPlatoParaReceta(plato);
    setRecetaItems([{ insumo_id: '', cantidad_usada: '' }]);
    setRecetaError('');
  };

  const updateRecetaItem = (index, field, value) => {
    setRecetaItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addRecetaRow = () => {
    setRecetaItems((prev) => [...prev, { insumo_id: '', cantidad_usada: '' }]);
  };

  const handleGuardarReceta = async (e) => {
    e.preventDefault();
    setRecetaError('');

    try {
      await asignarInsumosAPlato(
        platoParaReceta.id,
        recetaItems.map((item) => ({
          insumo_id: item.insumo_id,
          cantidad_usada: parseFloat(item.cantidad_usada),
        }))
      );
      setPlatoParaReceta(null);
    } catch (err) {
      setRecetaError(err.response?.data?.error || 'Error al guardar la receta');
    }
  };
const handleDelete = async (id) => {
  if (!confirm('¿Seguro que quieres eliminar este plato?')) return;

  try {
    await deletePlato(id);
    setPlatos((prev) => prev.filter((p) => p.id !== id));
  } catch (err) {
    alert(err.response?.data?.error || 'Error al eliminar el plato');
  }
};
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-6">Platos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario de crear plato */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">Nuevo plato</h3>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Nombre</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            >
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Precio</label>
            <input
              type="number"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            />
          </div>

          {error && (
            <p className="text-terracota-600 text-sm bg-terracota-500/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold py-2 rounded-lg transition-colors text-sm"
          >
            Agregar plato
          </button>
        </motion.form>

        {/* Lista de platos */}
        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : platos.length === 0 ? (
            <p className="p-6 text-pizarra-700 text-sm">No hay platos registrados.</p>
          ) : (
            <div className="divide-y divide-pizarra-900/5">
              {platos.map((plato) => (
                <div key={plato.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-pizarra-900 text-sm">{plato.nombre}</p>
                    <p className="text-xs text-pizarra-700 capitalize">
                      {plato.tipo} · ${parseFloat(plato.precio).toLocaleString()}
                    </p>
                  </div>

               <div className="flex items-center gap-3">
  {plato.tipo !== 'ejecutivo' && (
    <button
      onClick={() => abrirModalReceta(plato)}
      className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
    >
      Asignar receta
    </button>
  )}
  <button
    onClick={() => handleDelete(plato.id)}
    className="text-xs font-semibold text-terracota-500 hover:text-terracota-600"
  >
    Eliminar
  </button>
</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de receta */}
      <AnimatePresence>
        {platoParaReceta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-pizarra-950/50 flex items-center justify-center p-4 z-50"
            onClick={() => setPlatoParaReceta(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleGuardarReceta}
              className="bg-papel-card rounded-2xl shadow-lg p-6 w-full max-w-md space-y-4"
            >
              <h3 className="font-display font-semibold text-pizarra-900">
                Receta de {platoParaReceta.nombre}
              </h3>

              <div className="space-y-2">
                {recetaItems.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={item.insumo_id}
                      onChange={(e) => updateRecetaItem(index, 'insumo_id', e.target.value)}
                      required
                      className="flex-1 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                    >
                      <option value="">Insumo...</option>
                      {insumos.map((i) => (
                        <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Cantidad"
                      value={item.cantidad_usada}
                      onChange={(e) => updateRecetaItem(index, 'cantidad_usada', e.target.value)}
                      required
                      className="w-24 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addRecetaRow}
                className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
              >
                + Agregar insumo
              </button>

              {recetaError && (
                <p className="text-terracota-600 text-sm bg-terracota-500/10 rounded-lg px-3 py-2">
                  {recetaError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPlatoParaReceta(null)}
                  className="flex-1 border border-pizarra-900/15 text-pizarra-700 font-semibold py-2 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold py-2 rounded-lg text-sm"
                >
                  Guardar receta
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Platos;