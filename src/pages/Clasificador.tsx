import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, AlertTriangle, CheckCircle2, Loader2, X, Info } from 'lucide-react';
import { ml, etiqueta, type InfoModelo, type Prediccion } from '../lib/mlApi';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

export default function Clasificador() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Prediccion | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelo, setModelo] = useState<InfoModelo | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ml.infoModelo().then(setModelo).catch(() => setModelo(null));
  }, []);

  // La vista previa usa un object URL, que hay que liberar para no dejar
  // memoria retenida cada vez que se cambia de imagen.
  useEffect(() => {
    if (!archivo) {
      setVistaPrevia(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  // Se valida en el cliente antes de subir: evita gastar ancho de banda en un
  // archivo que el servidor va a rechazar igualmente.
  const seleccionar = useCallback((f: File | undefined) => {
    setError(null);
    setResultado(null);
    if (!f) return;
    if (!TIPOS.includes(f.type)) {
      setError('Formato no admitido. Usa JPEG, PNG o WebP.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`La imagen pesa ${(f.size / 1048576).toFixed(1)} MB y el máximo es ${MAX_MB} MB.`);
      return;
    }
    setArchivo(f);
  }, []);

  const clasificar = async () => {
    if (!archivo) return;
    setCargando(true);
    setError(null);
    try {
      setResultado(await ml.clasificar(archivo));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo clasificar la imagen');
    } finally {
      setCargando(false);
    }
  };

  const limpiar = () => {
    setArchivo(null);
    setResultado(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const ordenadas = resultado
    ? Object.entries(resultado.probabilidades).sort(([, a], [, b]) => b - a)
    : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Clasificador de productos</h1>
        <p className="mt-1 text-sm text-gray-600">
          Sube la fotografía de un producto y el modelo identificará su categoría.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------- Carga ---------------- */}
        <div>
          <div
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              seleccionar(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              arrastrando ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
            }`}
            style={{ minHeight: '18rem' }}
          >
            {vistaPrevia ? (
              <>
                <img
                  src={vistaPrevia}
                  alt="Imagen seleccionada"
                  className="max-h-64 rounded object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); limpiar(); }}
                  className="absolute top-2 right-2 rounded-full bg-white p-1 shadow hover:bg-gray-100"
                  aria-label="Quitar imagen"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </>
            ) : (
              <div className="text-center">
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-900">
                  Arrastra una imagen o haz clic para elegirla
                </p>
                <p className="mt-1 text-xs text-gray-500">JPEG, PNG o WebP · máximo {MAX_MB} MB</p>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={TIPOS.join(',')}
              className="hidden"
              onChange={(e) => seleccionar(e.target.files?.[0])}
            />
          </div>

          {archivo && (
            <p className="mt-2 truncate text-xs text-gray-500">
              {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
            </p>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={clasificar}
            disabled={!archivo || cargando}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {cargando ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Clasificando…</>
            ) : (
              'Clasificar imagen'
            )}
          </button>
        </div>

        {/* ---------------- Resultado ---------------- */}
        <div>
          {resultado ? (
            <div className="rounded-lg border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Categoría predicha</p>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {etiqueta(resultado.clase)}
                  </p>
                </div>
                {resultado.incierta ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                    <AlertTriangle className="h-3 w-3" /> Incierta
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                    <CheckCircle2 className="h-3 w-3" /> Confiable
                  </span>
                )}
              </div>

              {resultado.incierta && (
                <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  La confianza está por debajo del umbral
                  {modelo ? ` de ${(modelo.umbral_confianza * 100).toFixed(0)} %` : ''}.
                  El modelo no distingue bien esta imagen, así que conviene revisarla manualmente.
                </p>
              )}

              <div className="mt-5">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Probabilidad por categoría
                </p>
                <div className="space-y-2">
                  {ordenadas.map(([clase, p], i) => (
                    <div key={clase}>
                      <div className="flex justify-between text-sm">
                        <span className={i === 0 ? 'font-semibold text-gray-900' : 'text-gray-600'}>
                          {etiqueta(clase)}
                        </span>
                        <span className="tabular-nums text-gray-500">{(p * 100).toFixed(1)} %</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-100">
                        <div
                          className={`h-2 rounded-full ${i === 0 ? 'bg-indigo-600' : 'bg-gray-300'}`}
                          style={{ width: `${Math.max(p * 100, 0.5)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4 text-sm">
                <div>
                  <dt className="text-gray-500">Confianza</dt>
                  <dd className="font-semibold tabular-nums text-gray-900">
                    {(resultado.confianza * 100).toFixed(1)} %
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Tiempo de inferencia</dt>
                  <dd className="font-semibold tabular-nums text-gray-900">
                    {resultado.latencia_ms.toFixed(1)} ms
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="flex h-full min-h-[18rem] items-center justify-center rounded-lg border border-dashed border-gray-200 p-6">
              <p className="text-center text-sm text-gray-400">
                El resultado de la clasificación aparecerá aquí
              </p>
            </div>
          )}

          {/* ---------------- Ficha del modelo ---------------- */}
          {modelo && (
            <div className="mt-6 rounded-lg bg-gray-50 p-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-gray-500" />
                <p className="text-sm font-medium text-gray-900">Sobre el modelo</p>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Arquitectura</dt>
                  <dd className="font-medium text-gray-900">MobileNetV3</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Exactitud</dt>
                  <dd className="font-medium tabular-nums text-gray-900">
                    {(modelo.exactitud_prueba * 100).toFixed(1)} %
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">F1 macro</dt>
                  <dd className="font-medium tabular-nums text-gray-900">
                    {modelo.f1_macro.toFixed(3)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-gray-500">
                Medido sobre un conjunto de prueba que no se usó durante el entrenamiento.
                Reconoce: {modelo.clases.map(etiqueta).join(', ')}.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
