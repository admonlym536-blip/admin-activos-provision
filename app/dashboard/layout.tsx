"use client";

import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BellRing,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Package,
  Upload,
  Users,
} from "lucide-react";
import { supabase } from "@/src/lib/supabase";
import { DatosProvider, useDatos } from "@/src/lib/DatosContext";
import { AvisosProvider, Cargando } from "@/src/components/ui";

const MENU = [
  { href: "/dashboard", icono: LayoutDashboard, texto: "Resumen" },
  { href: "/dashboard/activos", icono: Package, texto: "Activos" },
  { href: "/dashboard/alertas", icono: BellRing, texto: "Alertas" },
  { href: "/dashboard/asesores", icono: Users, texto: "Asesores" },
  { href: "/dashboard/mapa", icono: MapIcon, texto: "Mapa" },
  { href: "/dashboard/carga", icono: Upload, texto: "Carga masiva" },
];

/** Menú (dentro de DatosProvider para mostrar el contador de alertas). */
function Navegacion({ ruta }: { ruta: string }) {
  const { alertasPendientes } = useDatos();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pt-2">
      <div className="hidden px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:block">
        Menú
      </div>
      {MENU.map(({ href, icono: Icono, texto }) => {
        const activo =
          href === "/dashboard" ? ruta === href : ruta.startsWith(href);
        const contador = href === "/dashboard/alertas" ? alertasPendientes : 0;
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activo
                ? "bg-marca/[0.07] text-marca"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Icono
              className={`h-[18px] w-[18px] ${activo ? "text-marca" : "text-slate-400"}`}
              strokeWidth={2}
            />
            {texto}
            {contador > 0 && (
              <span className="ml-auto rounded-full bg-rojo px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums">
                {contador}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(true);

  /* ================= PROTEGER RUTA ================= */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setVerificando(false);
    });
  }, [router]);

  const logout = async () => {
    if (!confirm("¿Cerrar sesión?")) return;
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (verificando) return <Cargando />;

  const inicial = (email ?? "A").charAt(0).toUpperCase();

  return (
    <AvisosProvider>
      <DatosProvider email={email}>
        <div className="flex min-h-screen flex-col md:flex-row">
          {/* ---------------- MENÚ ---------------- */}
          <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
            <div className="flex items-center gap-3 px-5 py-5">
              <Image
                src="/Logo_Provision.jpg"
                alt="Provisión L&M"
                width={36}
                height={36}
                className="rounded-lg ring-1 ring-slate-200"
              />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-slate-900">
                  Provisión L&M
                </div>
                <div className="text-xs text-slate-500">Gestión de activos</div>
              </div>
            </div>

            <Navegacion ruta={ruta} />

            <div className="hidden items-center gap-3 border-t border-slate-200 p-4 md:flex">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-marca text-sm font-semibold text-white">
                {inicial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">
                  Administrador
                </div>
                <div className="truncate text-xs text-slate-500">{email}</div>
              </div>
              <button
                onClick={logout}
                title="Cerrar sesión"
                className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </aside>

          {/* ---------------- CONTENIDO ---------------- */}
          <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
            <div className="mb-4 flex justify-end md:hidden">
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </button>
            </div>
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </DatosProvider>
    </AvisosProvider>
  );
}
