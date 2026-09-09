import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getCategoriasGasto, createCategoriaGasto, deleteCategoriaGasto } from '../services/categoriaGastoService';
function CategoriasGasto() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getCategoriasGasto();
        setCategorias(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const nueva = await createCategoriaGasto({ nombre });
      setCategorias((prev) =>
        [...prev, nueva].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setNombre('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la categoría');
    }
  };
const handleDelete = async (id) => {
  if (!confirm('¿Seguro que quieres eliminar esta categoría?')) return;

  try {
    await deleteCategoriaGasto(id);
    setCategorias((prev) => prev.filter((c) => c.id !== id));
  } catch (err) {
    alert(err.response?.data?.error || 'Error al eliminar la categoría');
  }
};
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-6">
        Categorías de gasto
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">
            Nueva categoría
          </h3>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Aseo, Producción, Administrativo..."
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
            Agregar categoría
          </button>
        </motion.form>

        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : categorias.length === 0 ? (
            <p className="p-6 text-pizarra-700 text-sm">
              Todavía no hay categorías registradas.
            </p>
          ) : (
            <table className="w-full text-sm">
           <tbody>
  {categorias.map((c) => (
    <tr key={c.id} className="border-b border-pizarra-900/5 last:border-0">
      <td className="px-5 py-3 text-pizarra-900 font-medium">{c.nombre}</td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={() => handleDelete(c.id)}
          className="text-terracota-500 hover:text-terracota-600 text-xs font-semibold"
        >
          Eliminar
        </button>
      </td>
    </tr>
  ))}
</tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategoriasGasto;