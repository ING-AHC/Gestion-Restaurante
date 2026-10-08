import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Receipt, CalendarDays } from 'lucide-react';
import { getVentas, createVenta } from '../services/ventaService';
import { getProductos } from '../services/productoService';

function Ventas() {
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [tipoVenta, setTipoVenta] = useState('venta');
  const [fechaVenta, setFechaVenta] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState([
    { producto_id: '', cantidad: '1', adicion_descripcion: '', adicion_valor: '' },
  ]);
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [ventasData, productosData] = await Promise.all([getVentas(), getProductos()]);
        setVentas(ventasData);
        setProductos(productosData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const getProducto = (productoId) => productos.find((p) => p.id === parseInt(productoId));

  const updateItem = (index, field, value) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { producto_id: '', cantidad: '1', adicion_descripcion: '', adicion_valor: '' },
    ]);
  };

  const removeItemRow = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalVenta = items.reduce((total, item) => {
    const producto = getProducto(item.producto_id);
    if (!producto) return total;
    const subtotalProducto = parseFloat(producto.precio) * (parseInt(item.cantidad) || 0);
    const adicion = parseFloat(item.adicion_valor) || 0;
    return total + subtotalProducto + adicion;
  }, 0);

  const recargarVentas = async () => {
    const data = await getVentas();
    setVentas(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const payload = {
        tipo: tipoVenta,
        fecha: fechaVenta,
        items: items.map((item) => ({
          producto_id: item.producto_id,
          cantidad: parseInt(item.cantidad),
          adicion_descripcion: item.adicion_descripcion || null,
          adicion_valor: parseFloat(item.adicion_valor) || 0,
        })),
      };

      await createVenta(payload);
      await recargarVentas();

      setTipoVenta('venta');
      setFechaVenta(new Date().toISOString().split('T')[0]);
      setItems([{ producto_id: '', cantidad: '1', adicion_descripcion: '', adicion_valor: '' }]);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar la venta');
    }
  };

  const ventasFiltradas = ventas.filter((venta) => {
    const fechaVentaItem = venta.fecha.split('T')[0];
    return fechaVentaItem === fechaFiltro;
  });

  const totalDia = ventasFiltradas
    .filter((v) => v.tipo === 'venta')
    .reduce((total, v) => total + parseFloat(v.total), 0);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-pizarra-900/5 flex items-center justify-center">
          <Receipt size={20} className="text-pizarra-700" />
        </div>
        <h2 className="font-display text-2xl font-bold text-pizarra-900">Ventas</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">Registrar venta</h3>

          <div className="grid grid-cols-2 gap-3">
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
                  Consumo
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Fecha</label>
              <input
                type="date"
                value={fechaVenta}
                onChange={(e) => setFechaVenta(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              />
            </div>
          </div>

          <div className="border-t border-pizarra-900/10 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-pizarra-800">Productos de la venta</label>
              <button
                type="button"
                onClick={addItemRow}
                className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
              >
                + Agregar producto
              </button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="bg-papel rounded-xl p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={item.producto_id}
                    onChange={(e) => updateItem(index, 'producto_id', e.target.value)}
                    required
                    className="flex-1 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-sm focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                  >
                    <option value="">Producto...</option>
                    <optgroup label="Especiales">
                      {productos.filter((p) => p.tipo === 'especial').map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Comida rápida">
                      {productos.filter((p) => p.tipo === 'rapida').map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Ejecutivos">
                      {productos.filter((p) => p.tipo === 'ejecutivo').map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Bebidas">
                      {productos.filter((p) => p.tipo === 'bebida').map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </optgroup>
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

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ajuste (ej: sin arroz, extra queso)"
                    value={item.adicion_descripcion}
                    onChange={(e) => updateItem(index, 'adicion_descripcion', e.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-xs focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                  />
                  <input
                    type="number"
                    step="1"
                    value={item.adicion_valor}
                    onChange={(e) => updateItem(index, 'adicion_valor', e.target.value)}
                    placeholder="+/- valor"
                    className="w-24 px-2 py-1.5 rounded-lg border border-pizarra-900/15 text-xs focus:outline-none focus:ring-2 focus:ring-mostaza-500"
                  />
                </div>
              </div>
            ))}
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
            {ventasFiltradas.length > 0 && (
              <span className="text-xs font-semibold text-pizarra-700">
                Total del día: <span className="text-mostaza-600">${totalDia.toLocaleString()}</span>
              </span>
            )}
          </div>

          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : ventasFiltradas.length === 0 ? (
            <div className="p-10 text-center">
              <Receipt size={32} className="text-pizarra-900/15 mx-auto mb-2" />
              <p className="text-pizarra-700 text-sm">No hay ventas registradas para este día.</p>
            </div>
          ) : (
            <div className="divide-y divide-pizarra-900/5">
              {ventasFiltradas.map((venta) => (
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
                      <div key={i}>
                        <p>
                          {it.producto_nombre} x{it.cantidad} · $
                          {(it.cantidad * parseFloat(it.precio_unitario)).toLocaleString()}
                        </p>
                        {it.adicion_descripcion && (
                          <p className={`pl-2 ${parseFloat(it.adicion_valor) < 0 ? 'text-terracota-600' : 'text-mostaza-600'}`}>
                            {parseFloat(it.adicion_valor) >= 0 ? '+' : ''} {it.adicion_descripcion} · ${parseFloat(it.adicion_valor).toLocaleString()}
                          </p>
                        )}
                      </div>
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