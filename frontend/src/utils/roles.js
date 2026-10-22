export const rutaInicial = (rol) =>
  ({ mesero: '/pedidos', cocina: '/cocina', caja: '/caja' }[rol] || '/dashboard');

export const ETIQUETA_ROL = {
  admin: 'Administrador',
  mesero: 'Mesero',
  cocina: 'Cocina',
  caja: 'Caja',
};