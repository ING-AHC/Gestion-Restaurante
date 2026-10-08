const pool = require('../config/db');

const idsUnicos = (lista) => [...new Set(lista.filter(Boolean).map(Number))];

const createCompra = async (req, res) => {
  const { proveedor_id, estado_pago, items, fecha } = req.body;
  const userId = req.userId;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Debes incluir al menos un item en la compra' });
  }

  for (const item of items) {
    const valor = Number(item.valor_unitario);
    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({ error: 'Valor no válido en uno de los items' });
    }
    if (item.insumo_id) {
      const cantidad = Number(item.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        return res.status(400).json({ error: 'Cantidad no válida en uno de los items' });
      }
    }
  }

  const insumoIds = idsUnicos(items.map((i) => i.insumo_id));
  const categoriaIds = idsUnicos(items.map((i) => i.categoria_id));

  if ([...insumoIds, ...categoriaIds].some((n) => !Number.isInteger(n))) {
    return res.status(400).json({ error: 'Identificadores no válidos' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (proveedor_id) {
      const proveedorCheck = await client.query(
        'SELECT id FROM proveedores WHERE id = $1 AND user_id = $2',
        [proveedor_id, userId]
      );
      if (proveedorCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Proveedor no encontrado' });
      }
    }

    if (insumoIds.length > 0) {
      const insumosCheck = await client.query(
        'SELECT id FROM insumos WHERE id = ANY($1::int[]) AND user_id = $2',
        [insumoIds, userId]
      );
      if (insumosCheck.rows.length !== insumoIds.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Insumo no encontrado' });
      }
    }

    if (categoriaIds.length > 0) {
      const categoriasCheck = await client.query(
        'SELECT id FROM categorias_gasto WHERE id = ANY($1::int[]) AND user_id = $2',
        [categoriaIds, userId]
      );
      if (categoriasCheck.rows.length !== categoriaIds.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
    }

    const montoTotal = items.reduce((total, item) => total + Number(item.valor_unitario), 0);

    const compraResult = await client.query(
      `INSERT INTO compras (proveedor_id, monto_total, estado_pago, fecha, user_id)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5)
       RETURNING *`,
      [proveedor_id || null, montoTotal, estado_pago || 'pendiente', fecha, userId]
    );

    const compraId = compraResult.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO compra_detalle (compra_id, insumo_id, cantidad, valor_unitario, descripcion, categoria_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          compraId,
          item.insumo_id || null,
          item.cantidad || null,
          item.valor_unitario,
          item.descripcion || null,
          item.categoria_id || null,
        ]
      );

      if (item.insumo_id) {
        await client.query(
          `UPDATE insumos SET cantidad_actual = cantidad_actual + $1
           WHERE id = $2 AND user_id = $3`,
          [item.cantidad, item.insumo_id, userId]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json(compraResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la compra' });
  } finally {
    client.release();
  }
};

const getCompras = async (req, res) => {
  const userId = req.userId;

  try {
    const compras = await pool.query(
      `SELECT
         c.id,
         c.proveedor_id,
         c.monto_total,
         c.estado_pago,
         c.fecha,
         p.nombre AS proveedor_nombre,
         json_agg(
           json_build_object(
             'insumo_nombre', COALESCE(i.nombre, cd.descripcion),
             'cantidad', cd.cantidad,
             'valor', cd.valor_unitario,
             'categoria_nombre', COALESCE(cgi.nombre, cgd.nombre)
           )
         ) AS items
       FROM compras c
       LEFT JOIN proveedores p ON c.proveedor_id = p.id
       LEFT JOIN compra_detalle cd ON cd.compra_id = c.id
       LEFT JOIN insumos i ON cd.insumo_id = i.id
       LEFT JOIN categorias_gasto cgi ON i.categoria_id = cgi.id
       LEFT JOIN categorias_gasto cgd ON cd.categoria_id = cgd.id
       WHERE c.user_id = $1
       GROUP BY c.id, p.nombre
       ORDER BY c.fecha DESC`,
      [userId]
    );

    res.json(compras.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

const marcarComoPagada = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const updated = await pool.query(
      `UPDATE compras SET estado_pago = 'pagado'
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

module.exports = { createCompra, getCompras, marcarComoPagada };