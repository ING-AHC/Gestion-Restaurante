import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, CalendarDays, Package, FileText } from 'lucide-react';
import { getCompras, createCompra, marcarComoPagada } from '../services/compraService';
import { getProveedores } from '../services/proveedorService';
import { getInsumos } from '../services/insumoService';
import InputMoneda from '../components/InputMoneda';

function Compras() {
  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [proveedorId, setProveedorId] = useState('');
  const [estadoPago, setEstadoPago] = useState('pagado');
  const [fechaCompra, setFechaCompra] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([
    { esInsumo: true, insumo_id: '', descripcion: '', cantidad: '', valor_unitario: '' },
  ]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [comprasData, proveedoresData, insumosData] = await Promise.all([
          getCompras(),
          getProveedores(),
          getInsumos(),
        ]);
        setCompras(comprasData);
        setProveedores(proveedoresData);
        setInsumos(insumosData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const toggleTipoItem = (index, esInsumo) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, esInsumo, insumo_id: '', descripcion: '', cantidad: '' }
          : item
      )
    );
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { esInsumo: true, insumo_id: '', descripcion: '', cantidad: '', valor_unitario: '' },
    ]);
  };

  const removeItemRow = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const montoTotal = items.reduce(
    (total, item) => total + (parseFloat(item.valor_unitario) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await createCompra({
        proveedor_id: proveedorId,
        estado_pago: estadoPago,
        fecha: fechaCompra,
        items: items.map((item) => ({
          insumo_id: item.esInsumo ? item.insumo_id : null,
          descripcion: item.esInsumo ? null : item.descripcion,
          cantidad: item.esInsumo ? parseFloat(item.cantidad) : null,
          valor_unitario: parseFloat(item.valor_unitario),
        })),
      });

      const comprasActualizadas = await getCompras();
      setCompras(comprasActualizadas);

      setProveedorId('');
setEstadoPago('pagado');
setFechaCompra(new Date().toISOString().split('T')[0]);
      setItems([{ esInsumo: true, insumo_id: '', descripcion: '', cantidad: '', valor_unitario: '' }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la compra');
    }
  };

  const handlePagar = async (id) => {
    try {
      const actualizada = await marcarComoPagada(id);
      setCompras((prev) => prev.map((c) => (c.id === id ? { ...c, estado_pago: actualizada.estado_pago } : c)));
    } catch (err) {
      console.error(err);
    }
  };

  const comprasFiltradas = compras.filter((compra) => {
    const fechaCompraItem = compra.fecha.split('T')[0];
    return fechaCompraItem === fechaFiltro;
  });

  const totalDia = comprasFiltradas.reduce((total, c) => total + parseFloat(c.monto_total), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-pizarra-900/5 flex items-center justify-center">
          <ShoppingCart size={20} className="text-pizarra-700" />
        </div>
        <h2 className="font-display text-2xl font-bold text-pizarra-900">Compras</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">Nueva compra</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
                Proveedor
              </label>
              <select
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              >
                <option value="">Selecciona...</option>
                {proveedores.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
                Fecha
              </label>
              <input
                type="date"
                value={fechaCompra}
                onChange={(e) => setFechaCompra(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
              Estado de pago
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEstadoPago('pendiente')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  estadoPago === 'pendiente'
                    ? 'bg-terracota-500 text-white'
                    : 'bg-pizarra-900/5 text-pizarra-700'
                }`}
              >
                Pendiente
              </button>
              <button
                type="button"
                onClick={() => setEstadoPago('pagado')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  estadoPago === 'pagado'
                    ? 'bg-pizarra-900 text-papel'
                    : 'bg-pizarra-900/5 text-pizarra-700'
                }`}
              >
                Pagado
              </button>
            </div>
          </div>

          <div className="border-t border-pizarra-900/10 pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-pizarra-800">
                Items de la compra
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
              >
                + Agregar item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="bg-papel rounded-xl p-3 space-y-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTipoItem(index, true)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        item.esInsumo ? 'bg-pizarra-900 text-papel' : 'bg-pizarra-900/5 text-pizarra-700'
                      }`}
                    >
                      <Package size={13} />
                      Insumo
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTipoItem(index, false)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        !item.esInsumo ? 'bg-pizarra-900 text-papel' : 'bg-pizarra-900/5 text-pizarra-700'
                      }`}
                    >
                      <FileText size={13} />
                      Gasto general
                    </button>
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

                  {item.esInsumo ? (
                    <div className="flex gap-2">
                      <select
                        value={item.insumo_id}
                        onChange={(e) => updateItem(index, 'insumo_id', e.target.value)}
                        required
                        className="flex-1 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                      >
                        <option value="">Insumo...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>{i.nombre}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Cant."
                        value={item.cantidad}
                        onChange={(e) => updateItem(index, 'cantidad', e.target.value)}
                        required
                        className="w-20 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Descripción (ej: pago de agua)"
                      value={item.descripcion}
                      onChange={(e) => updateItem(index, 'descripcion', e.target.value)}
                      required
                      className="w-full px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                    />
                  )}

                  <InputMoneda
                    value={item.valor_unitario}
                    onChange={(val) => updateItem(index, 'valor_unitario', val)}
                    placeholder="Valor pagado"
                    required
                    className="w-full px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-pizarra-900/10 pt-4">
            <span className="text-sm font-semibold text-pizarra-700">Total</span>
            <span className="font-display text-lg font-bold text-pizarra-900">
              ${montoTotal.toLocaleString()}
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
            Registrar compra
          </button>
        </motion.form>

        <div className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden h-fit">
          <div className="p-4 border-b border-pizarra-900/10 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-pizarra-700/60" />
              <input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              />
              <button
                type="button"
                onClick={() => setFechaFiltro(new Date().toISOString().split('T')[0])}
                className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
              >
                Hoy
              </button>
            </div>
            {comprasFiltradas.length > 0 && (
              <span className="text-xs font-semibold text-pizarra-700">
                Total del día: <span className="text-pizarra-900">${totalDia.toLocaleString()}</span>
              </span>
            )}
          </div>

          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : comprasFiltradas.length === 0 ? (
            <div className="p-10 text-center">
              <ShoppingCart size={32} className="text-pizarra-900/15 mx-auto mb-2" />
              <p className="text-pizarra-700 text-sm">No hay compras registradas para este día.</p>
            </div>
          ) : (
            <div className="divide-y divide-pizarra-900/5">
              {comprasFiltradas.map((compra) => (
                <div key={compra.id} className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="font-medium text-pizarra-900 text-sm">
                        {compra.proveedor_nombre}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-pizarra-900 text-sm">
                        ${parseFloat(compra.monto_total).toLocaleString()}
                      </span>
                      {compra.estado_pago === 'pagado' ? (
                        <span className="text-xs font-semibold bg-pizarra-900/10 text-pizarra-700 px-2.5 py-1 rounded-full">
                          Pagado
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePagar(compra.id)}
                          className="text-xs font-semibold bg-terracota-500/10 text-terracota-600 hover:bg-terracota-500/20 px-2.5 py-1 rounded-full transition-colors"
                        >
                          Pendiente
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-pizarra-700 space-y-0.5 pl-1">
                    {compra.items.map((item, i) => (
                      <p key={i}>
                        {item.insumo_nombre}
                        {item.cantidad ? ` · ${item.cantidad}` : ''} · $
                        {parseFloat(item.valor).toLocaleString()}
                        {item.categoria_nombre && (
                          <span className="text-pizarra-700/50"> · {item.categoria_nombre}</span>
                        )}
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

export default Compras;