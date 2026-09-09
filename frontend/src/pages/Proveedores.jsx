import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getProveedores, createProveedor, deleteProveedor } from '../services/proveedorService';
function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProveedores();
        setProveedores(data);
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
      const nuevo = await createProveedor({ nombre, telefono });
      setProveedores((prev) =>
        [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre))
      );
      setNombre('');
      setTelefono('');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el proveedor');
    }
  };
  const handleDelete = async (id) => {
  if (!confirm('¿Seguro que quieres eliminar este proveedor?')) return;

  try {
    await deleteProveedor(id);
    setProveedores((prev) => prev.filter((p) => p.id !== id));
  } catch (err) {
    alert(err.response?.data?.error || 'Error al eliminar el proveedor');
  }
};

  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-pizarra-900 mb-6">
        Proveedores
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
            Nuevo proveedor
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
              Teléfono
            </label>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
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
            Agregar proveedor
          </button>
        </motion.form>

        <div className="lg:col-span-2 bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 overflow-hidden">
          {loading ? (
            <p className="p-6 text-pizarra-700 text-sm">Cargando...</p>
          ) : proveedores.length === 0 ? (
            <p className="p-6 text-pizarra-700 text-sm">
              Todavía no hay proveedores registrados.
            </p>
          ) : (
            <table className="w-full text-sm">
            <thead>
  <tr className="border-b border-pizarra-900/10 text-left">
    <th className="px-5 py-3 font-semibold text-pizarra-700">Nombre</th>
    <th className="px-5 py-3 font-semibold text-pizarra-700">Teléfono</th>
    <th className="px-5 py-3"></th>
  </tr>
</thead>
         <tbody>
  {proveedores.map((p) => (
    <tr key={p.id} className="border-b border-pizarra-900/5 last:border-0">
      <td className="px-5 py-3 text-pizarra-900 font-medium">{p.nombre}</td>
      <td className="px-5 py-3 text-pizarra-700">{p.telefono || '-'}</td>
      <td className="px-5 py-3 text-right">
        <button
          onClick={() => handleDelete(p.id)}
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

export default Proveedores;