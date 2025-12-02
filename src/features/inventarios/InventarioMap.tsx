import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { inventariosService } from '../../services/inventarios.service';
import { Skeleton } from '../../components/ui/skeleton';
import { formatCurrency } from '../../lib/utils';

interface InventarioMapProps {
  tipo?: string;
  estatus?: string;
  plaza?: string;
}

const estatusColors: Record<string, string> = {
  Disponible: '#10b981',
  Reservado: '#f59e0b',
  Ocupado: '#3b82f6',
  Mantenimiento: '#6b7280',
};

export function InventarioMap({ tipo, estatus, plaza }: InventarioMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  const { data: inventarios, isLoading } = useQuery({
    queryKey: ['inventarios', 'map', tipo, estatus, plaza],
    queryFn: () =>
      inventariosService.getForMap({
        tipo: tipo || undefined,
        estatus: estatus || undefined,
        plaza: plaza || undefined,
      }),
  });

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapRef.current).setView([19.4326, -99.1332], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapInstanceRef.current);

    markersRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersRef.current || !inventarios) return;

    markersRef.current.clearLayers();

    const bounds: L.LatLngBounds[] = [];

    inventarios.forEach((inv) => {
      if (inv.latitud && inv.longitud) {
        const lat = Number(inv.latitud);
        const lng = Number(inv.longitud);

        const color = estatusColors[inv.estatus || ''] || '#6b7280';

        const icon = L.divIcon({
          className: 'custom-marker',
          html: `
            <div style="
              width: 24px;
              height: 24px;
              background-color: ${color};
              border: 2px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            "></div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(markersRef.current!);

        marker.bindPopup(`
          <div style="min-width: 200px;">
            <div style="font-weight: 600; margin-bottom: 8px;">${inv.codigo_unico || 'Sin codigo'}</div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              <strong>Tipo:</strong> ${inv.tipo_de_mueble || '-'}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              <strong>Estatus:</strong> ${inv.estatus || '-'}
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              <strong>Plaza:</strong> ${inv.plaza || '-'}
            </div>
            ${inv.ubicacion ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;"><strong>Ubicacion:</strong> ${inv.ubicacion}</div>` : ''}
            ${inv.municipio ? `<div style="font-size: 12px; color: #666; margin-bottom: 4px;"><strong>Municipio:</strong> ${inv.municipio}</div>` : ''}
            <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
              <strong>Dimensiones:</strong> ${inv.ancho}m x ${inv.alto}m
            </div>
            ${inv.tarifa_publica ? `<div style="font-size: 12px; color: #666;"><strong>Tarifa:</strong> ${formatCurrency(inv.tarifa_publica)}</div>` : ''}
          </div>
        `);

        bounds.push(L.latLng(lat, lng).toBounds(100));
      }
    });

    if (bounds.length > 0 && mapInstanceRef.current) {
      const group = L.featureGroup(
        inventarios
          .filter((inv) => inv.latitud && inv.longitud)
          .map((inv) => L.marker([Number(inv.latitud), Number(inv.longitud)]))
      );
      mapInstanceRef.current.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }, [inventarios]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Leyenda:</span>
        {Object.entries(estatusColors).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span>{key}</span>
          </div>
        ))}
      </div>

      <div
        ref={mapRef}
        className="h-[600px] w-full rounded-lg border"
        style={{ zIndex: 0 }}
      />

      <p className="text-sm text-muted-foreground">
        Mostrando {inventarios?.length || 0} inventarios con coordenadas
      </p>
    </div>
  );
}
