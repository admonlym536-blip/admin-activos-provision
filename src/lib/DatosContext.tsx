"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  cargarActivos,
  cargarZonas,
  contarAlertasPendientes,
  mensajeError,
} from "@/src/lib/datos";
import { Activo, Zona } from "@/src/lib/tipos";

type Datos = {
  activos: Activo[];
  zonas: Zona[];
  cargando: boolean;
  error: string | null;
  email: string | null;
  alertasPendientes: number;
  recargar: () => Promise<void>;
  refrescarAlertas: () => Promise<void>;
};

const Ctx = createContext<Datos | null>(null);

const CADA_2_MIN = 2 * 60 * 1000;

export function DatosProvider({
  email,
  children,
}: {
  email: string | null;
  children: ReactNode;
}) {
  const [activos, setActivos] = useState<Activo[]>([]);
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertasPendientes, setAlertasPendientes] = useState(0);

  const refrescarAlertas = useCallback(async () => {
    setAlertasPendientes(await contarAlertasPendientes());
  }, []);

  const recargar = useCallback(async () => {
    try {
      const [a, z] = await Promise.all([
        cargarActivos(),
        cargarZonas(),
        refrescarAlertas(),
      ]);
      setActivos(a);
      setZonas(z);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [refrescarAlertas]);

  useEffect(() => {
    recargar();
    // Revisar si llegaron alertas nuevas de los asesores
    const t = setInterval(refrescarAlertas, CADA_2_MIN);
    return () => clearInterval(t);
  }, [recargar, refrescarAlertas]);

  return (
    <Ctx.Provider
      value={{
        activos,
        zonas,
        cargando,
        error,
        email,
        alertasPendientes,
        recargar,
        refrescarAlertas,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useDatos() {
  const d = useContext(Ctx);
  if (!d) throw new Error("useDatos debe usarse dentro de DatosProvider");
  return d;
}
