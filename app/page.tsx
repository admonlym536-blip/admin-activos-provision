"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, Loader2, Lock, Mail, Map as MapIcon, Package, Users } from "lucide-react";
import { supabase } from "@/src/lib/supabase";

const BENEFICIOS = [
  { icono: Package, texto: "Registra, edita y da de baja activos" },
  { icono: Users, texto: "Asigna activos a cada asesor y día" },
  { icono: MapIcon, texto: "Ubica todos los activos en el mapa" },
];

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje("");
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCargando(false);

    if (error) {
      setMensaje("Correo o contraseña incorrectos");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------------- PANEL DE MARCA ---------------- */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-marca p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <Image
            src="/Logo_Provision.jpg"
            alt="Provisión L&M"
            width={44}
            height={44}
            className="rounded-lg bg-white"
          />
          <span className="text-lg font-semibold">Provisión L&M</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Gestión de activos comerciales
          </h1>
          <p className="mt-4 text-white/70">
            Controla tus neveras, exhibidores y equipos en campo desde un solo
            lugar.
          </p>
          <ul className="mt-10 space-y-4">
            {BENEFICIOS.map(({ icono: Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-white/90">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icono className="h-4 w-4" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Provisión L&M S.A.S.
        </p>
      </div>

      {/* ---------------- FORMULARIO ---------------- */}
      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/Logo_Provision.jpg"
              alt="Provisión L&M"
              width={40}
              height={40}
              className="rounded-lg ring-1 ring-slate-200"
            />
            <span className="font-semibold text-slate-900">Provisión L&M</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Iniciar sesión
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Ingresa con tu usuario administrador
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Correo electrónico
              </span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-marca focus:ring-2 focus:ring-marca/15"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Contraseña
              </span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-marca focus:ring-2 focus:ring-marca/15"
                />
              </div>
            </label>

            {mensaje && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {mensaje}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-marca text-sm font-medium text-white shadow-sm transition hover:bg-marca-oscuro disabled:opacity-60"
            >
              {cargando && <Loader2 className="h-4 w-4 animate-spin" />}
              {cargando ? "Verificando…" : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
