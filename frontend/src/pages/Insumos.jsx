import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getInsumos, createInsumo, deleteInsumo } from '../services/insumoService';
function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [unidadMedida, setUnidadMedida] = useState('');
  const [cantidadActual, setCantidadActual] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInsumos = async () => {
      try {
        const data = await getInsumos();
        setInsumos(data);
      } catch (err) {
        console.error('Error al cargar insumos', err);
      } finally {
        setLoading(false);
      }
    };
    loadInsumos();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const nuevo = await createInsumo({
        nombre,
        unidad_medida: unidadMedida,
        cantidad_actual: cantidadActual || 0,
      });

      setInsumos((prev) =>
        [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );

      setNombre('');
      setUnidadMedida('');
      setCantidadActual('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el insumo');
    }
  };
  const handleDelete = async (id) => {
  if (!confirm('¿Seguro que quieres eliminar este insumo?')) return;

  try {
    await deleteInsumo(id);
    setInsumos((prev) => prev.filter((i) => i.id !== id));
  } catch (err) {
    alert(err.response?.data?.error || 'Error al eliminar el insumo');
  }
};

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-6">
        Insumos
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulario */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">
            Nuevo insumo
          </h3>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Unidad de medida
            </label>
            <input
              type="text"
              value={unidadMedida}
              onChange={(e) => setUnidadMedida(e.target.value)}
              placeholder="libras, kilos, unidad..."
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Cantidad inicial
            </label>
            <input
              type="number"
              step="0.01"
              value={cantidadActual}
              onChange={(e) => setCantidadActual(e.target.value)}
              placeholder="0"
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
            Agregar insumo
          </button>
        </motion.form>

        {/* Lista */}
        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : insumos.length === 0 ? (
            <p className="p-6 text-pizarra-700 text-sm">
              Todavía no hay insumos registrados.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pizarra-900/10 text-left">
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Nombre</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Unidad</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700 text-right">
                    Cantidad actual
                
                  </th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
            <tbody>
  {insumos.map((insumo) => (
    <tr key={insumo.id} className="border-b border-pizarra-900/5 last:border-0">
      <td className="px-5 py-3 text-pizarra-900 font-medium">
        {insumo.nombre}
      </td>
      <td className="px-5 py-3 text-pizarra-700">{insumo.unidad_medida}</td>
      <td className="px-5 py-3 text-right text-pizarra-900 font-semibold">
        {parseFloat(insumo.cantidad_actual).toLocaleString()}
      </td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={() => handleDelete(insumo.id)}
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

export default Insumos;