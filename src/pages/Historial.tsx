import React, { useCallback, useEffect, useState } from 'react';
import {
  History, Trash2, AlertTriangle, ImageOff, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import {
  ml, etiqueta, type Estadisticas, type ItemHistorial, type PaginaHistorial,
} from '../lib/mlApi';

const POR_PAGINA = 12;

export default function Historial() {
  const [datos, setDatos] = useState<PaginaHistorial | null>(null);
  const [stats, setStats] = useState<Estadisticas | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<string>('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [h, s] = await Promise.all([
        ml.historial(pagina, POR_PAGINA, filtro || undefined),
        ml.estadisticas(),
      ]);
      setDatos(h);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial');
    } finally {
      setCargando(false);
    }
  }, [pagina, filtro]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminar = async (item: ItemHistorial) => {
    if (!window.confirm(`¿Eliminar la predicción de "${item.nombre_archivo}"?`)) return;
    setBorrando(item.id);
    try {
      await ml.eliminar(item.id);
      // Si se borra el último elemento de la página, se retrocede una para no
      // quedar mirando una lista vacía.
      if (datos && datos.items.length === 1 && pagina > 1) setPagina(pagina - 1);
      else await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setBorrando(null);
    }
  };

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;
  const fecha = (s: string) =>
    new Date(s).toLocaleString('es-CO', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Historial de clasificaciones</h1>
        <p className="mt-1 text-sm text-gray-600">
          Predicciones realizadas y métricas de uso del clasificador.
        </p>
      </div>

      {/* ---------------- Métricas de uso ---------------- */}
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { t: 'Total', v: stats.total_predicciones.toLocaleString('es-CO') },
            { t: 'Últimas 24 h', v: stats.predicciones_24h.toLocaleString('es-CO') },
            { t: 'Confianza media', v: `${(stats.confianza_media * 100).toFixed(1)} %` },
            { t: 'Latencia media', v: `${stats.latencia_media_ms.toFixed(1)} ms` },
            { t: 'Inciertas', v: `${(stats.tasa_incertidumbre * 100).toFixed(1)} %` },
          ].map((m) => (
            <div key={m.t} className="rounded-lg bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">{m.t}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{m.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Reparto por categoría ---------------- */}
      {stats && stats.por_clase.length > 0 && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm font-medium text-gray-900">Predicciones por categoría</p>
          <div className="space-y-2">
            {stats.por_clase.map((c) => {
              const pct = (c.total / stats.total_predicciones) * 100;
              return (
                <div key={c.clase}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{etiqueta(c.clase)}</span>
                    <span className="tabular-nums text-gray-500">
                      {c.total} · confianza {(c.confianza_media * 100).toFixed(0)} %
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- Filtro ---------------- */}
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="filtro" className="text-sm text-gray-600">Filtrar:</label>
        <select
          id="filtro"
          value={filtro}
          onChange={(e) => { setFiltro(e.target.value); setPagina(1); }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">Todas las categorías</option>
          {stats?.por_clase.map((c) => (
            <option key={c.clase} value={c.clase}>{etiqueta(c.clase)}</option>
          ))}
        </select>
        {datos && (
          <span className="text-sm text-gray-500">
            {datos.total} {datos.total === 1 ? 'resultado' : 'resultados'}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ---------------- Listado ---------------- */}
      {cargando ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !datos || datos.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
          <History className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">
            {filtro ? 'No hay predicciones de esta categoría.' : 'Todavía no has clasificado ninguna imagen.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {datos.items.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-lg border border-gray-200">
              <div className="flex h-36 items-center justify-center bg-gray-50">
                {item.url_imagen ? (
                  <img
                    src={item.url_imagen}
                    alt={item.nombre_archivo}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  // El enlace firmado caduca; también puede faltar si S3 no
                  // estaba disponible al guardar.
                  <div className="text-center text-gray-300">
                    <ImageOff className="mx-auto h-7 w-7" />
                    <p className="mt-1 text-xs">Sin vista previa</p>
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">
                      {etiqueta(item.clase_predicha)}
                    </p>
                    <p className="truncate text-xs text-gray-500">{item.nombre_archivo}</p>
                  </div>
                  <button
                    onClick={() => eliminar(item)}
                    disabled={borrando === item.id}
                    className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    aria-label={`Eliminar ${item.nombre_archivo}`}
                  >
                    {borrando === item.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${
                    item.incierta ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {(item.confianza * 100).toFixed(0)} %
                  </span>
                  <span className="text-gray-400">{fecha(item.creado_en)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- Paginación ---------------- */}
      {datos && totalPaginas > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            disabled={pagina <= 1}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-sm tabular-nums text-gray-600">
            Página {pagina} de {totalPaginas}
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            disabled={pagina >= totalPaginas}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
