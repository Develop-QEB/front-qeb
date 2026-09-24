import { Fragment, memo } from 'react';
import { Polygon, Circle, Marker } from '@react-google-maps/api';
import { CapaMapa, colorCapa } from './capasMapa';

// Pinta las capas ACTIVAS dentro de un <GoogleMap>: poligonos, radios y un
// pin por punto, todo del color del modo (azul incluir / rojo excluir).
// Compartido por la Vista Compartir interna y el visor publico. Memoizado:
// prender/apagar una capa o togglear inventario no recrea las demas.
const PIN_PATH = 'M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7-7.75 7-13C19,5.13 15.87,2 12,2z';

interface Props {
  capas: CapaMapa[];
  activas: Set<number>;
  onPinClick?: (capa: CapaMapa, pinIndex: number) => void;
}

export const CapasMapaOverlay = memo(function CapasMapaOverlay({ capas, activas, onPinClick }: Props) {
  return (
    <>
      {capas.filter(c => activas.has(c.id)).map(capa => {
        const color = colorCapa(capa);
        return (
          <Fragment key={capa.id}>
            {capa.geometria.poligonos.map((po, i) => (
              <Polygon
                key={`${capa.id}-po-${i}`}
                paths={po.paths}
                options={{
                  strokeColor: color,
                  strokeOpacity: 0.9,
                  strokeWeight: 2,
                  fillColor: color,
                  fillOpacity: 0.15,
                  clickable: false,
                }}
              />
            ))}
            {capa.geometria.pines.map((p, i) => (
              <Fragment key={`${capa.id}-pin-${i}`}>
                <Circle
                  center={{ lat: p.lat, lng: p.lng }}
                  radius={p.range}
                  options={{
                    strokeColor: color,
                    strokeOpacity: 0.7,
                    strokeWeight: 1.5,
                    fillColor: color,
                    fillOpacity: 0.12,
                    clickable: false,
                  }}
                />
                <Marker
                  position={{ lat: p.lat, lng: p.lng }}
                  title={`${p.name} · ${p.range} m`}
                  onClick={onPinClick ? () => onPinClick(capa, i) : undefined}
                  zIndex={500}
                  icon={{
                    path: PIN_PATH,
                    fillColor: color,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 1.5,
                    scale: 1.1,
                    anchor: new google.maps.Point(12, 24),
                  }}
                />
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </>
  );
});
