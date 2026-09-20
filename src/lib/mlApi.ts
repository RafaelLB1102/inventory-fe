// Cliente del servicio de clasificación de imágenes.
//
// Vive detrás del mismo dominio que la API de inventario pero bajo el prefijo
// /ml, enrutado por CloudFront hacia otro servicio. Comparte el token JWT: lo
// emite inventory-be y este servicio solo valida la firma.

const ML_URL = import.meta.env.VITE_ML_API_URL;

export interface Prediccion {
  id: string;
  clase: string;
  confianza: number;
  incierta: boolean;
  probabilidades: Record<string, number>;
  latencia_ms: number;
  creado_en: string;
}

export interface ItemHistorial {
  id: string;
  nombre_archivo: string;
  clase_predicha: string;
  confianza: number;
  incierta: boolean;
  latencia_ms: number;
  creado_en: string;
  url_imagen: string | null;
}

export interface PaginaHistorial {
  total: number;
  pagina: number;
  por_pagina: number;
  items: ItemHistorial[];
}

export interface ConteoClase {
  clase: string;
  total: number;
  confianza_media: number;
}

export interface Estadisticas {
  total_predicciones: number;
  predicciones_24h: number;
  predicciones_7d: number;
  confianza_media: number;
  latencia_media_ms: number;
  tasa_incertidumbre: number;
  por_clase: ConteoClase[];
}

export interface MetricasClase {
  precision: number;
  recall: number;
  f1: number;
  soporte: number;
}

export interface InfoModelo {
  arquitectura: string;
  clases: string[];
  exactitud_prueba: number;
  f1_macro: number;
  umbral_confianza: number;
  metricas_por_clase: Record<string, MetricasClase>;
}

function cabeceraAuth(): HeadersInit {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('No hay sesión activa');
  return { Authorization: `Bearer ${token}` };
}

// El backend devuelve el motivo del fallo en "detail". Propagarlo tal cual
// permite mostrar al usuario qué pasó ("la imagen pesa 8 MB y el máximo es 5")
// en lugar de un mensaje genérico que no le dice cómo corregirlo.
async function manejar<T>(respuesta: Response): Promise<T> {
  if (!respuesta.ok) {
    let mensaje = `Error ${respuesta.status}`;
    try {
      const cuerpo = await respuesta.json();
      if (cuerpo?.detail) {
        mensaje = typeof cuerpo.detail === 'string'
          ? cuerpo.detail
          : JSON.stringify(cuerpo.detail);
      }
    } catch {
      if (respuesta.status === 401) mensaje = 'Sesión expirada. Vuelve a iniciar sesión.';
      if (respuesta.status === 503) mensaje = 'El clasificador no está disponible.';
    }
    throw new Error(mensaje);
  }
  if (respuesta.status === 204) return undefined as T;
  return respuesta.json();
}

export const ml = {
  async clasificar(archivo: File): Promise<Prediccion> {
    const cuerpo = new FormData();
    cuerpo.append('imagen', archivo);
    // No se fija Content-Type a propósito: el navegador debe añadir el
    // boundary del multipart, y ponerlo a mano rompe la petición.
    const r = await fetch(`${ML_URL}/predict`, {
      method: 'POST',
      headers: cabeceraAuth(),
      body: cuerpo,
    });
    return manejar<Prediccion>(r);
  },

  async historial(pagina = 1, porPagina = 12, clase?: string): Promise<PaginaHistorial> {
    const params = new URLSearchParams({
      pagina: String(pagina),
      por_pagina: String(porPagina),
    });
    if (clase) params.set('clase', clase);
    const r = await fetch(`${ML_URL}/history?${params}`, { headers: cabeceraAuth() });
    return manejar<PaginaHistorial>(r);
  },

  async eliminar(id: string): Promise<void> {
    const r = await fetch(`${ML_URL}/history/${id}`, {
      method: 'DELETE',
      headers: cabeceraAuth(),
    });
    return manejar<void>(r);
  },

  async estadisticas(): Promise<Estadisticas> {
    const r = await fetch(`${ML_URL}/stats`, { headers: cabeceraAuth() });
    return manejar<Estadisticas>(r);
  },

  async infoModelo(): Promise<InfoModelo> {
    const r = await fetch(`${ML_URL}/model`, { headers: cabeceraAuth() });
    return manejar<InfoModelo>(r);
  },
};

// Etiquetas legibles para las categorías que devuelve el modelo
export const NOMBRES_CLASE: Record<string, string> = {
  impresora: 'Impresora',
  laptop: 'Laptop',
  monitor: 'Monitor',
  mouse: 'Mouse',
  silla: 'Silla',
  teclado: 'Teclado',
};

export const etiqueta = (clase: string) => NOMBRES_CLASE[clase] ?? clase;
