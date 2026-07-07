export interface GeocodeResult {
  lat: number;
  lng: number;
}

export type GeocodeProvider = 'nominatim' | 'google' | 'mapbox';

function fullAddress(address: string, city: string, state: string, zip: string): string {
  return `${address}, ${city}, ${state} ${zip}`;
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResult | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim's usage policy asks for an identifying UA/referer for browser apps.
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const results = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

async function geocodeWithGoogle(query: string, apiKey: string): Promise<GeocodeResult | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };
  if (!data.results.length) return null;
  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

async function geocodeWithMapbox(query: string, apiKey: string): Promise<GeocodeResult | null> {
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set('access_token', apiKey);
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as { features: Array<{ center: [number, number] }> };
  if (!data.features.length) return null;
  const [lng, lat] = data.features[0].center;
  return { lat, lng };
}

/**
 * Geocodes a single address using the provider configured via VITE_GEOCODE_PROVIDER.
 * Defaults to Nominatim (OpenStreetMap), which is free but rate-limited to ~1 req/sec —
 * callers doing bulk geocoding should space out requests (see geocodeQueue below).
 */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<GeocodeResult | null> {
  const provider = (import.meta.env.VITE_GEOCODE_PROVIDER || 'nominatim') as GeocodeProvider;
  const query = fullAddress(address, city, state, zip);

  try {
    switch (provider) {
      case 'google': {
        const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!key) throw new Error('VITE_GOOGLE_MAPS_API_KEY is not set');
        return await geocodeWithGoogle(query, key);
      }
      case 'mapbox': {
        const key = import.meta.env.VITE_MAPBOX_API_KEY;
        if (!key) throw new Error('VITE_MAPBOX_API_KEY is not set');
        return await geocodeWithMapbox(query, key);
      }
      case 'nominatim':
      default:
        return await geocodeWithNominatim(query);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Geocoding failed for "${query}":`, err);
    return null;
  }
}

/**
 * Geocodes a batch of addresses one at a time with a delay between requests,
 * so the default Nominatim provider's ~1 req/sec rate limit is respected.
 */
export async function geocodeQueue<T>(
  items: T[],
  toAddress: (item: T) => { address: string; city: string; state: string; zip: string },
  onResult: (item: T, result: GeocodeResult | null) => Promise<void> | void,
  delayMs = 1100
): Promise<void> {
  for (const item of items) {
    const { address, city, state, zip } = toAddress(item);
    const result = await geocodeAddress(address, city, state, zip);
    await onResult(item, result);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
