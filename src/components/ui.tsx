"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  CheckCircle2,
  Loader2,
  LucideIcon,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { colorSemaforo } from "@/src/lib/tipos";

// ==========================================================
// BOTONES
// ==========================================================
type Variante = "primario" | "secundario" | "peligro" | "exito" | "fantasma";

const VARIANTES: Record<Variante, string> = {
  primario: "bg-marca text-white shadow-sm hover:bg-marca-oscuro",
  secundario:
    "bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50",
  peligro: "bg-rojo text-white shadow-sm hover:brightness-95",
  exito: "bg-verde text-white shadow-sm hover:brightness-95",
  fantasma: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

export function Boton({
  variante = "primario",
  className = "",
  cargando,
  icono: Icono,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  cargando?: boolean;
  icono?: LucideIcon;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
    >
      {cargando ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icono && <Icono className="h-4 w-4" strokeWidth={2} />
      )}
      {children}
    </button>
  );
}

// ==========================================================
// TARJETAS / ETIQUETAS
// ==========================================================
export function Tarjeta({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function TituloTarjeta({
  children,
  accion,
}: {
  children: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-slate-900">{children}</h2>
      {accion}
    </div>
  );
}

export function Kpi({
  titulo,
  valor,
  detalle,
  color = "#0c3b75",
  icono: Icono,
  onClick,
}: {
  titulo: string;
  valor: ReactNode;
  detalle?: string;
  color?: string;
  icono: LucideIcon;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 text-left transition enabled:hover:border-slate-300 enabled:hover:shadow-sm"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{titulo}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${color}14`, color }}
        >
          <Icono className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <span className="text-3xl font-semibold tracking-tight text-slate-900">
        {valor}
      </span>
      {detalle && (
        <span className="text-xs text-slate-500">{detalle}</span>
      )}
    </button>
  );
}

export function Semaforo({
  semaforo,
  cumplimiento,
}: {
  semaforo: string;
  cumplimiento: number | null;
}) {
  if (!semaforo) return <span className="text-slate-400">—</span>;
  const c = colorSemaforo(semaforo);
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
      {cumplimiento != null ? `${Math.round(cumplimiento)}%` : semaforo}
    </span>
  );
}

type ColorEtiqueta = "gris" | "verde" | "rojo" | "amarillo" | "azul";

const ETIQUETAS: Record<ColorEtiqueta, string> = {
  gris: "bg-slate-50 text-slate-600 ring-slate-500/20",
  verde: "bg-green-50 text-green-700 ring-green-600/20",
  rojo: "bg-red-50 text-red-700 ring-red-600/20",
  amarillo: "bg-amber-50 text-amber-800 ring-amber-600/20",
  azul: "bg-blue-50 text-blue-700 ring-blue-600/20",
};

export function Etiqueta({
  children,
  color = "gris",
}: {
  children: ReactNode;
  color?: ColorEtiqueta;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ETIQUETAS[color]}`}
    >
      {children}
    </span>
  );
}

export function Alerta({
  children,
  tipo = "aviso",
  icono: Icono,
  accion,
}: {
  children: ReactNode;
  tipo?: "aviso" | "error";
  icono: LucideIcon;
  accion?: ReactNode;
}) {
  const estilo =
    tipo === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm ${estilo}`}
    >
      <Icono className="h-4 w-4 shrink-0" />
      <div className="flex-1">{children}</div>
      {accion}
    </div>
  );
}

// ==========================================================
// MODAL
// ==========================================================
export function Modal({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
  pie,
  ancho = "max-w-lg",
}: {
  abierto: boolean;
  titulo: string;
  descripcion?: string;
  onCerrar: () => void;
  children: ReactNode;
  pie?: ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    if (!abierto) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}
    >
      <div
        className={`flex max-h-[90vh] w-full ${ancho} flex-col rounded-xl bg-white shadow-2xl ring-1 ring-slate-200`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{titulo}</h3>
            {descripcion && (
              <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>
            )}
          </div>
          <button
            onClick={onCerrar}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        {pie && (
          <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-6 py-3">
            {pie}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================
// CAMPOS DE FORMULARIO
// ==========================================================
export function Campo({
  etiqueta,
  children,
  ayuda,
}: {
  etiqueta: string;
  children: ReactNode;
  ayuda?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {etiqueta}
      </span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-slate-500">{ayuda}</span>}
    </label>
  );
}

export const claseInput =
  "h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-marca focus:ring-2 focus:ring-marca/15 disabled:bg-slate-50 disabled:text-slate-500";

export function Buscador({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        className={`${claseInput} pl-9`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ==========================================================
// AVISOS (toasts)
// ==========================================================
type Aviso = { id: number; texto: string; tipo: "ok" | "error" };

const AvisoCtx = createContext<(texto: string, tipo?: "ok" | "error") => void>(
  () => {}
);

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const avisar = useCallback((texto: string, tipo: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a, { id, texto, tipo }]);
    setTimeout(
      () => setAvisos((a) => a.filter((x) => x.id !== id)),
      tipo === "error" ? 7000 : 3500
    );
  }, []);

  return (
    <AvisoCtx.Provider value={avisar}>
      {children}
      <div className="fixed bottom-4 right-4 z-[3000] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {avisos.map((a) => (
          <div
            key={a.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg"
          >
            {a.tipo === "error" ? (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rojo" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-verde" />
            )}
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </AvisoCtx.Provider>
  );
}

export const useAvisos = () => useContext(AvisoCtx);

// ==========================================================
// ESTADOS VACÍO / CARGANDO
// ==========================================================
export function Cargando() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-marca" />
    </div>
  );
}

export function Vacio({ icono: Icono, texto }: { icono: LucideIcon; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icono className="h-6 w-6 text-slate-400" />
      </span>
      <span className="text-sm">{texto}</span>
    </div>
  );
}
