import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getProductos,
  createProducto,
  asignarInsumosAProducto,
  deleteProducto,
  updateProducto,
} from '../services/productoService';
import { getInsumos } from '../services/insumoService';
import InputMoneda from '../components/InputMoneda';

const TIPOS = [
  { value: 'especial', label: 'Especial' },
  { value: 'rapida', label: 'Comida rápida' },
  { value: 'ejecutivo', label: 'Ejecutivo' },
  { value: 'bebida', label: 'Bebida' },
];

function Productos() {
  const [productos, setProductos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('especial');
  const [precio, setPrecio] = useState('');
  const [insumoLigado, setInsumoLigado] = useState('');

  const [productoParaReceta, setProductoParaReceta] = useState(null);
  const [recetaItems, setRecetaItems] = useState([{ insumo_id: '', cantidad_usada: '' }]);
  const [recetaError, setRecetaError] = useState('');

  const [productoParaEditar, setProductoParaEditar] = useState(null);
  const [editNombre, setEditNombre] = useState('');
  const [editPrecio, setEditPrecio] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [productosData, insumosData] = await Promise.all([getProductos(), getInsumos()]);
        setProductos(productosData);
        setInsumos(insumosData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const esBebida = tipo === 'bebida';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const nuevo = await createProducto({
        nombre,
        tipo,
        precio: parseFloat(precio),
        insumo_id: esBebida ? insumoLigado : null,
      });
      setProductos((prev) => [...prev, { ...nuevo, receta: [] }]);
      setNombre('');
      setTipo('especial');
      setPrecio('');
      setInsumoLigado('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el producto');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) return;

    try {
      await deleteProducto(id);
      setProductos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar el producto');
    }
  };

  const abrirModalReceta = (producto) => {
    setProductoParaReceta(producto);
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
      await asignarInsumosAProducto(
        productoParaReceta.id,
        recetaItems.map((item) => ({
          insumo_id: item.insumo_id,
          cantidad_usada: parseFloat(item.cantidad_usada),
        }))
      );
      setProductoParaReceta(null);

      const productosActualizados = await getProductos();
      setProductos(productosActualizados);
    } catch (err) {
      setRecetaError(err.response?.data?.error || 'Error al guardar la receta');
    }
  };
const abrirModalEditar = (producto) => {
  setProductoParaEditar(producto);
  setEditNombre(producto.nombre);
  setEditPrecio(Math.round(parseFloat(producto.precio)).toString());
  setEditError('');
};

  const handleGuardarEdicion = async (e) => {
    e.preventDefault();
    setEditError('');

    try {
      const actualizado = await updateProducto(productoParaEditar.id, {
        nombre: editNombre,
        precio: parseFloat(editPrecio),
      });

      setProductos((prev) =>
        prev.map((p) => (p.id === actualizado.id ? { ...p, ...actualizado } : p))
      );

      setProductoParaEditar(null);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Error al actualizar el producto');
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-6">Productos</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6 space-y-4 h-fit"
        >
          <h3 className="font-display font-semibold text-pizarra-900">Nuevo producto</h3>

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

          <AnimatePresence>
            {esBebida && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
                  Insumo del inventario
                </label>
                <select
                  value={insumoLigado}
                  onChange={(e) => setInsumoLigado(e.target.value)}
                  required={esBebida}
                  className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
                >
                  <option value="">Selecciona...</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>{i.nombre}</option>
                  ))}
                </select>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">Precio</label>
            <InputMoneda
              value={precio}
              onChange={setPrecio}
              className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
              required
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
            Agregar producto
          </button>
        </motion.form>

        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : productos.length === 0 ? (
            <p className="p-6 text-pizarra-700 text-sm">No hay productos registrados.</p>
          ) : (
            <div className="divide-y divide-pizarra-900/5">
              {productos.map((producto) => (
                <div key={producto.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-pizarra-900 text-sm">{producto.nombre}</p>
                      <p className="text-xs text-pizarra-700 capitalize">
                        {producto.tipo} · ${parseFloat(producto.precio).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => abrirModalEditar(producto)}
                        className="text-xs font-semibold text-pizarra-700 hover:text-pizarra-900"
                      >
                        Editar
                      </button>
                      {(producto.tipo === 'especial' || producto.tipo === 'rapida' || producto.tipo === 'ejecutivo') && (
                        <button
                          onClick={() => abrirModalReceta(producto)}
                          className="text-xs font-semibold text-mostaza-600 hover:text-mostaza-700"
                        >
                          {producto.receta?.length > 0 ? 'Editar receta' : 'Asignar receta'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(producto.id)}
                        className="text-xs font-semibold text-terracota-500 hover:text-terracota-600"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  {producto.receta?.length > 0 && (
                    <div className="mt-1.5 text-xs text-pizarra-700/70 pl-0.5">
                      {producto.receta.map((r, i) => (
                        <span key={r.insumo_id}>
                          {r.insumo_nombre} ({r.cantidad_usada})
                          {i < producto.receta.length - 1 && ' · '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {productoParaReceta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-pizarra-950/50 flex items-center justify-center p-4 z-50"
            onClick={() => setProductoParaReceta(null)}
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
                Receta de {productoParaReceta.nombre}
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
                  onClick={() => setProductoParaReceta(null)}
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

      <AnimatePresence>
        {productoParaEditar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-pizarra-950/50 flex items-center justify-center p-4 z-50"
            onClick={() => setProductoParaEditar(null)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleGuardarEdicion}
              className="bg-papel-card rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-4"
            >
              <h3 className="font-display font-semibold text-pizarra-900">
                Editar producto
              </h3>

              <div>
                <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
                  Nombre
                </label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-pizarra-800 mb-1.5">
                  Precio
                </label>
                <InputMoneda
                  value={editPrecio}
                  onChange={setEditPrecio}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500 text-sm"
                />
              </div>

              {editError && (
                <p className="text-terracota-600 text-sm bg-terracota-500/10 rounded-lg px-3 py-2">
                  {editError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setProductoParaEditar(null)}
                  className="flex-1 border border-pizarra-900/15 text-pizarra-700 font-semibold py-2 rounded-lg text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-mostaza-500 hover:bg-mostaza-600 text-pizarra-950 font-semibold py-2 rounded-lg text-sm"
                >
                  Guardar cambios
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Productos;