import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  getResumenFinanciero,
  getDeudasProveedores,
  getGastosPorCategoria,
} from '../services/reporteService';

const COLORES_GRAFICA = ['#e0a838', '#3a5f52', '#c1573f', '#2d4c42', '#c8912a'];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function Dashboard() {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1); // getMonth() da 0-11, sumamos 1
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [verTodo, setVerTodo] = useState(false);

  const [resumen, setResumen] = useState(null);
  const [deudas, setDeudas] = useState([]);
  const [gastosCategoria, setGastosCategoria] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      try {
        const mesFiltro = verTodo ? null : mes;
        const anioFiltro = verTodo ? null : anio;

        const [resumenData, deudasData, gastosData] = await Promise.all([
          getResumenFinanciero(mesFiltro, anioFiltro),
          getDeudasProveedores(),
          getGastosPorCategoria(mesFiltro, anioFiltro),
        ]);
        setResumen(resumenData);
        setDeudas(deudasData);
        setGastosCategoria(gastosData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [mes, anio, verTodo]);

  const datosGrafica = gastosCategoria.map((g) => ({
    name: g.categoria_nombre,
    value: parseFloat(g.total_gastado),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h2 className="font-display text-2xl font-bold text-pizarra-900">
          Resumen del negocio
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setVerTodo(!verTodo)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              verTodo
                ? 'bg-pizarra-900 text-papel'
                : 'bg-pizarra-900/5 text-pizarra-700'
            }`}
          >
            Histórico total
          </button>

          {!verTodo && (
            <>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value))}
                className="text-sm px-3 py-1.5 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500"
              >
                {MESES.map((nombre, index) => (
                  <option key={index} value={index + 1}>{nombre}</option>
                ))}
              </select>

              <select
                value={anio}
                onChange={(e) => setAnio(parseInt(e.target.value))}
                className="text-sm px-3 py-1.5 rounded-lg border border-pizarra-900/15 focus:outline-none focus:ring-2 focus:ring-mostaza-500"
              >
                {[hoy.getFullYear() - 1, hoy.getFullYear()].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {loading || !resumen ? (
        <p className="text-pizarra-700 text-sm">Cargando resumen...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-5"
            >
              <p className="text-sm text-pizarra-700 font-medium">Ventas</p>
              <p className="font-display text-3xl font-bold text-pizarra-900 mt-1">
                ${resumen.total_ventas.toLocaleString()}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-5"
            >
              <p className="text-sm text-pizarra-700 font-medium">Gastos</p>
              <p className="font-display text-3xl font-bold text-pizarra-900 mt-1">
                ${resumen.total_compras.toLocaleString()}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-pizarra-900 rounded-2xl shadow-sm p-5"
            >
              <p className="text-sm text-papel/70 font-medium">Ganancia real</p>
              <p
                className={`font-display text-3xl font-bold mt-1 ${
                  resumen.ganancia_real >= 0 ? 'text-mostaza-500' : 'text-terracota-500'
                }`}
              >
                ${resumen.ganancia_real.toLocaleString()}
              </p>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6"
            >
              <h3 className="font-display font-semibold text-pizarra-900 mb-4">
                Gastos por categoría
              </h3>

              {datosGrafica.length === 0 ? (
                <p className="text-pizarra-700 text-sm">Sin gastos en este período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={datosGrafica}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {datosGrafica.map((_, index) => (
                        <Cell key={index} fill={COLORES_GRAFICA[index % COLORES_GRAFICA.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}

              <div className="flex flex-wrap gap-3 mt-2">
                {datosGrafica.map((d, index) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-pizarra-700">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORES_GRAFICA[index % COLORES_GRAFICA.length] }}
                    />
                    {d.name}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-papel-card rounded-2xl shadow-sm border border-pizarra-900/10 p-6"
            >
              <h3 className="font-display font-semibold text-pizarra-900 mb-4">
                Deudas a proveedores
              </h3>
              <p className="text-xs text-pizarra-700 mb-3">
                (siempre muestra el total pendiente actual)
              </p>

              {deudas.length === 0 ? (
                <p className="text-pizarra-700 text-sm">No hay deudas pendientes 🎉</p>
              ) : (
                <div className="space-y-3">
                  {deudas.map((d) => (
                    <div key={d.proveedor_nombre} className="flex items-center justify-between">
                      <span className="text-sm text-pizarra-900 font-medium">
                        {d.proveedor_nombre}
                      </span>
                      <span className="text-sm font-semibold text-terracota-600">
                        ${parseFloat(d.total_deuda).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;