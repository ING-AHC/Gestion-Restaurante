import { createContext, useContext } from 'react';

export const DialogosContext = createContext(null);

// Ventanas propias de la aplicación, en lugar de las del navegador:
//   const { confirmar, avisar } = useDialogos();
//   if (!(await confirmar({ titulo: '…', mensaje: '…', peligro: true }))) return;
//   await avisar({ titulo: '…', mensaje: '…' });
export const useDialogos = () => {
  const contexto = useContext(DialogosContext);
  if (!contexto) throw new Error('useDialogos debe usarse dentro de DialogosProvider');
  return contexto;
};