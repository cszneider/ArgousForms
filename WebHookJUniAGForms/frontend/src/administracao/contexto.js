import { createContext, useContext } from 'react';
export const PainelContext = createContext(null);
export const usePainel = () => useContext(PainelContext);
