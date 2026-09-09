import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getVentas, createVenta } from '../services/ventaService';
import { getPlatos } from '../services/platoService';
import { getRendimientos } from '../services/rendimientoService';

function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [platos, setPlatos] = useState([]);
  const [rendimientos, setRendimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tipoVenta, setTipoVenta] = useState('venta');
  const [items, setItems] = useState([
    { plato_id: '', cantidad: '1', insumos_ejecutivo: [{ insumo_id: '', porciones: '' }] },
  ]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [ventasData, platosData, rendimientosData] = await Promise.all([
          getVentas(),
          getPlatos(),
          getRendimientos(),
        ]);
        setVentas(ventasData);
        setPlatos(platosData);
        setRendimientos(rendimientosData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const getPlato = (platoId) => platos.find((p) => p.id === parseInt(platoId));

  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const updateInsumoEjecutivo = (itemIndex, insumoIndex, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== itemIndex) return item;
        const nuevosInsumos = item.insumos_ejecutivo.map((ins, j) =>
          j === insumoIndex ? { ...ins, [field]: value } : ins
        );
        return { ...item, insumos_ejecutivo: nuevosInsumos };
      })
    );
  };

  const addInsumoEjecutivo = (itemIndex) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIndex
          ? { ...item, insumos_ejecutivo: [...item.insumos_ejecutivo, { insumo_id: '', porciones: '' }] }
          : item
      )
    );
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { plato_id: '', cantidad: '1', insumos_ejecutivo: [{ insumo_id: '', porciones: '' }] },
    ]);
  };

  const removeItemRow = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalVenta = items.reduce((total, item) => {
    const plato = getPlato(item.plato_id);
    if (!plato) return total;
    return total + parseFloat(plato.precio) * (parseInt(item.cantidad) || 0);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const payload = {
        tipo: tipoVenta,
        items: items.map((item) => {
          const plato = getPlato(item.plato_id);
          const base = {
            plato_id: item.plato_id,
            cantidad: parseInt(item.cantidad),
          };

          if (plato?.tipo === 'ejecutivo') {
            base.insumos_ejecutivo = item.insumos_ejecutivo.map((ins) => ({
              insumo_id: ins.insumo_id,
              porciones: parseFloat(ins.porciones),
            }));
          }

          return base;
        }),
      };

      const nueva = await createVenta(payload);
      await recargarVentas();

      setTipoVenta('venta');
      setItems([{ plato_id: '', cantidad: '1', insumos_ejecutivo: [{ insumo_id: '', porciones: '' }] }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la venta');
    }
  };

  const recargarVentas = async () => {
    const data = await getVentas();
    setVentas(data);
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-6">Ventas</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">Registrar venta</h3>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Tipo</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoVenta('venta')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tipoVenta === 'venta' ? 'bg-pizarra-900 text-papel' : 'bg-pizarra-900/5 text-pizarra-700'
                }`}
              >
                Venta
              </button>
              <button
                type="button"
                onClick={() => setTipoVenta('consumo_interno')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tipoVenta === 'consumo_interno' ? 'bg-pizarra-900 text-papel' : 'bg-pizarra-900/5 text-pizarra-700'
                }`}
              >
                Consumo interno
              </button>
            </div>
          </div>

          <div className="border-t border-pizarra-900/10 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-pizarra-800">Platos de la venta</label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
              >
                + Agregar plato
              </button>
            </div>

            {items.map((item, index) => {
              const plato = getPlato(item.plato_id);
              const esEjecutivo = plato?.tipo === 'ejecutivo';

              return (
                <div key={index} className="bg-papel rounded-xl p-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <select
                      value={item.plato_id}
                      onChange={(e) => updateItem(index, 'plato_id', e.target.value)}
                      required
                      className="flex-1 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                    >
                      <option value="">Plato...</option>
                      {platos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.cantidad}
                      onChange={(e) => updateItem(index, 'cantidad', e.target.value)}
                      required
                      className="w-16 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="text-terracota-500 hover:text-terracota-600 text-sm px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {esEjecutivo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden pl-1"
                      >
                        <p className="text-xs font-semibold text-pizarra-700 mb-1.5">
                          Insumos usados en este ejecutivo
                        </p>
                        {item.insumos_ejecutivo.map((ins, insIndex) => (
                          <div key={insIndex} className="flex gap-2 mb-1.5">
                            <select
                              value={ins.insumo_id}
                              onChange={(e) => updateInsumoEjecutivo(index, insIndex, 'insumo_id', e.target.value)}
                              required={esEjecutivo}
                              className="flex-1 px-2 py-1 rounded-lg border border-pizarra-900/15 text-xs focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                            >
                              <option value="">Insumo...</option>
                              {rendimientos.map((r) => (
                                <option key={r.insumo_id} value={r.insumo_id}>{r.insumo_nombre}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Porciones"
                              value={ins.porciones}
                              onChange={(e) => updateInsumoEjecutivo(index, insIndex, 'porciones', e.target.value)}
                              required={esEjecutivo}
                              className="w-24 px-2 py-1 rounded-lg border border-pizarra-900/15 text-xs focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addInsumoEjecutivo(index)}
                          className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
                        >
                          + Agregar insumo
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-pizarra-900/10 pt-4">
            <span className="text-sm font-semibold text-pizarra-700">Total</span>
            <span className="font-display text-lg font-bold text-pizarra-900">
              ${totalVenta.toLocaleString()}
            </span>
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
            Registrar venta
          </button>
        </motion.form>

        <div className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden h-fit">
          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : ventas.length === 0 ? (
            <p className="p-6 text-pizarra-700 text-sm">No hay ventas registradas.</p>
          ) : (
            <div className="divide-y divide-pizarra-900/5">
              {ventas.map((venta) => (
                <div key={venta.id} className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        venta.tipo === 'venta'
                          ? 'bg-pizarra-900/10 text-pizarra-700'
                          : 'bg-mostaza-500/15 text-mostaza-600'
                      }`}
                    >
                      {venta.tipo === 'venta' ? 'Venta' : 'Consumo interno'}
                    </span>
                    <span className="font-display font-bold text-pizarra-900 text-sm">
                      ${parseFloat(venta.total).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-pizarra-700 space-y-0.5">
                    {venta.items.map((it, i) => (
                      <p key={i}>
                        {it.plato_nombre} x{it.cantidad} · $
                        {(it.cantidad * parseFloat(it.precio_unitario)).toLocaleString()}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Ventas;