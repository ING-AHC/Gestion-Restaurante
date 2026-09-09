import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getRendimientos, createRendimiento } from '../services/rendimientoService';
import { getInsumos } from '../services/insumoService';

function Rendimientos() {
  const [rendimientos, setRendimientos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [insumoId, setInsumoId] = useState('');
  const [porciones, setPorciones] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [rendimientosData, insumosData] = await Promise.all([
          getRendimientos(),
          getInsumos(),
        ]);
        setRendimientos(rendimientosData);
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
      const nuevo = await createRendimiento({
        insumo_id: insumoId,
        porciones_por_unidad: parseFloat(porciones),
      });

      const insumo = insumos.find((i) => i.id === parseInt(insumoId));
      setRendimientos((prev) => [
        ...prev,
        { ...nuevo, insumo_nombre: insumo?.nombre, unidad_medida: insumo?.unidad_medida },
      ]);

      setInsumoId('');
      setPorciones('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el rendimiento');
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-1">
        Rendimientos
      </h2>
      <p className="text-pizarra-700 text-sm mb-6">
        Cuántas porciones de ejecutivo rinde cada insumo base
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">Nuevo rendimiento</h3>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Insumo</label>
            <select
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
            >
              <option value="">Selecciona...</option>
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>{i.nombre} ({i.unidad_medida})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Porciones por unidad
            </label>
            <input
              type="number"
              step="0.01"
              value={porciones}
              onChange={(e) => setPorciones(e.target.value)}
              placeholder="Ej: 10"
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
            Agregar rendimiento
          </button>
        </motion.form>

        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : rendimientos.length === 0 ? (
            <p className="p-6 text-pizarra-700 text-sm">No hay rendimientos configurados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pizarra-900/10 text-left">
                  <th className="px-5 py-3 font-semibold text-pizarra-700">Insumo</th>
                  <th className="px-5 py-3 font-semibold text-pizarra-700 text-right">
                    Porciones por unidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {rendimientos.map((r) => (
                  <tr key={r.id} className="border-b border-pizarra-900/5 last:border-0">
                    <td className="px-5 py-3 text-pizarra-900 font-medium">{r.insumo_nombre}</td>
                    <td className="px-5 py-3 text-right text-pizarra-900">
                      {r.porciones_por_unidad} porciones / {r.unidad_medida}
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

export default Rendimientos;