import { useState, useMemo, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Info, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useThemeStore } from '../../store/themeStore';

// =====================================================================
// CargaCsvModal — Herramienta alterna para asignar artes en bloque.
//
// Flujo:
//   1) Usuario selecciona N ubicaciones via checkbox en la tab "Subir Artes".
//   2) Click en "Cargar CSV" → abre este modal (paso 1 unicamente).
//   3) Sube un CSV o XLSX y hace cotejo (match) contra la seleccion.
//   4) Click en "Siguiente" → el modal cierra y se abre el UploadArtModal
//      existente con SOLO los items que matchearon.
//
// La logica de subir arte + notas + guardar la maneja UploadArtModal
// (no duplicamos nada — reusamos el flujo actual).
// =====================================================================

export interface CargaCsvInventoryRow {
  id: string;
  codigo_unico: string;
  tipo_de_cara?: string;
  ubicacion?: string;
  ciudad?: string;
  articulo?: string;
  catorcena?: number;
  anio?: number;
}

interface CargaCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedInventory: CargaCsvInventoryRow[];
  onContinue: (matchedIds: string[]) => void;
}

interface CsvRow {
  rowIndex: number; // 1-based, para mostrar al usuario
  raw: Record<string, unknown>;
  clave: string;
  estado: string;
  cara: string | null; // null si el CSV no trae columna de cara
}

interface MatchResult {
  matchedInventoryIds: string[]; // ids de inventario que matchearon (unique)
  csvRowsNotMatched: CsvRow[];
  csvRowsMatched: number; // cuantas filas del CSV matchearon (puede ser < matchedInventoryIds.length si 1 fila matchea Flujo+Contraflujo)
  selectedNotInCsv: CargaCsvInventoryRow[]; // items seleccionados que no aparecieron en CSV (informativo)
}

// ---------------------------------------------------------------------
// Helpers de normalizacion
// ---------------------------------------------------------------------

// Normaliza string: trim, quita espacios internos, lowercase, sin acentos.
const normalize = (s: unknown): string => {
  if (s === null || s === undefined) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // sin acentos
    .replace(/\s+/g, '') // sin espacios
    .toLowerCase();
};

// Mantiene casing/acentos pero hace trim — para mostrar al usuario.
const trimDisplay = (s: unknown): string => {
  if (s === null || s === undefined) return '';
  return String(s).trim().replace(/\s+/g, ' ');
};

// Codigo unico tiene formato: "${clave}_${cara}_${estado}"
// Ej: "DF3511_Contraflujo_Ciudad de México"
// Devuelve {clave, cara, estado}. La cara puede ser cualquier cosa intermedia.
const splitCodigoUnico = (codigoUnico: string): { clave: string; cara: string; estado: string } => {
  const parts = (codigoUnico || '').split('_');
  if (parts.length < 3) {
    // Formato no estandar; devolvemos lo que se pueda
    return { clave: parts[0] || '', cara: '', estado: parts[parts.length - 1] || '' };
  }
  return {
    clave: parts[0],
    cara: parts.slice(1, -1).join('_'),
    estado: parts[parts.length - 1],
  };
};

// ---------------------------------------------------------------------
// Detector de esquema y extraccion de filas
// ---------------------------------------------------------------------

// Recibe la primer fila (cabecera) y devuelve el mapping de columnas conocido.
// Soporta 2 esquemas:
//   A) SEARS-style:    Clave Sitio / Estado / VERSION   (sin cara)
//   B) COCA-COLA-style: UNIDAD / CARA / CIUDAD / ARTE     (con cara)
interface ColumnMap {
  clave: string;
  estado: string;
  cara: string | null;
  codigoUnico: string | null;
  schema: 'codigo-unico' | 'sears' | 'coca-cola' | 'unknown';
}

const detectColumnMap = (headers: string[]): ColumnMap => {
  const lower = headers.map(h => normalize(h));
  const find = (...candidates: string[]): string | null => {
    for (const cand of candidates) {
      const idx = lower.indexOf(normalize(cand));
      if (idx !== -1) return headers[idx];
    }
    return null;
  };

  // Formato principal: columna "Código Único" / "codigo_unico" / "CodigoUnico"
  const codigoUnicoCol = find('codigo unico', 'codigo_unico', 'codigounico', 'código único', 'código unico', 'codigo único');
  if (codigoUnicoCol) {
    return { clave: '', estado: '', cara: null, codigoUnico: codigoUnicoCol, schema: 'codigo-unico' };
  }

  // SEARS (clave sitio + estado)
  const claveSitio = find('clave sitio', 'clavesitio', 'clave_sitio');
  const estadoCol = find('estado');
  if (claveSitio && estadoCol) {
    return { clave: claveSitio, estado: estadoCol, cara: null, codigoUnico: null, schema: 'sears' };
  }

  // COCA-COLA (unidad + cara + ciudad)
  const unidad = find('unidad');
  const cara = find('cara');
  const ciudad = find('ciudad');
  if (unidad && ciudad) {
    return { clave: unidad, estado: ciudad, cara: cara, codigoUnico: null, schema: 'coca-cola' };
  }

  // Fallback
  const claveAny = find('clave', 'sitio', 'id', 'codigo');
  const estadoAny = find('estado', 'ciudad');
  if (claveAny && estadoAny) {
    return { clave: claveAny, estado: estadoAny, cara: find('cara', 'flujo'), codigoUnico: null, schema: 'unknown' };
  }

  return { clave: '', estado: '', cara: null, codigoUnico: null, schema: 'unknown' };
};

// ---------------------------------------------------------------------
// Parser de archivo CSV o XLSX
// ---------------------------------------------------------------------

const parseFile = async (file: File): Promise<{ rows: Record<string, unknown>[]; headers: string[] }> => {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  // Tomamos la primer hoja con datos
  let sheetData: Record<string, unknown>[] = [];
  let headers: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
    if (json.length > 0) {
      sheetData = json;
      headers = Object.keys(json[0]);
      break;
    }
  }
  return { rows: sheetData, headers };
};

// ---------------------------------------------------------------------
// Match logic
// ---------------------------------------------------------------------

const computeMatch = (
  csvRows: CsvRow[],
  inventory: CargaCsvInventoryRow[],
): MatchResult => {
  const matchedIdsSet = new Set<string>();
  const csvRowsNotMatched: CsvRow[] = [];
  let csvRowsMatched = 0;
  // Map inventory por claveN_estadoN para busqueda rapida
  const inventoryByKey = new Map<string, CargaCsvInventoryRow[]>();
  for (const inv of inventory) {
    const { clave, estado } = splitCodigoUnico(inv.codigo_unico);
    const key = `${normalize(clave)}|${normalize(estado)}`;
    const arr = inventoryByKey.get(key) || [];
    arr.push(inv);
    inventoryByKey.set(key, arr);
  }

  for (const row of csvRows) {
    const key = `${normalize(row.clave)}|${normalize(row.estado)}`;
    const candidates = inventoryByKey.get(key) || [];
    // Si el CSV trae cara, filtramos candidates por cara tambien
    let matchedCandidates = candidates;
    if (row.cara) {
      const caraNorm = normalize(row.cara);
      matchedCandidates = candidates.filter(c => {
        const invCara = normalize(splitCodigoUnico(c.codigo_unico).cara);
        return invCara === caraNorm;
      });
    }
    if (matchedCandidates.length > 0) {
      csvRowsMatched++;
      matchedCandidates.forEach(c => matchedIdsSet.add(c.id));
    } else {
      csvRowsNotMatched.push(row);
    }
  }

  const selectedNotInCsv = inventory.filter(inv => !matchedIdsSet.has(inv.id));

  return {
    matchedInventoryIds: Array.from(matchedIdsSet),
    csvRowsNotMatched,
    csvRowsMatched,
    selectedNotInCsv,
  };
};

// ---------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------

export function CargaCsvModal({ isOpen, onClose, selectedInventory, onContinue }: CargaCsvModalProps) {
  const isDark = useThemeStore(s => s.theme) === 'dark';
  const [file, setFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [schema, setSchema] = useState<ColumnMap['schema']>('unknown');

  // Cuando se cierra el modal externamente, limpiamos estado
  const handleClose = useCallback(() => {
    setFile(null);
    setCsvRows([]);
    setParseError(null);
    setSchema('unknown');
    onClose();
  }, [onClose]);

  const handleFileSelect = useCallback(async (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setIsParsing(true);
    setParseError(null);
    setCsvRows([]);
    try {
      const { rows, headers } = await parseFile(selected);
      if (rows.length === 0) {
        setParseError('El archivo esta vacio o no se pudo leer.');
        setIsParsing(false);
        return;
      }
      const colMap = detectColumnMap(headers);
      setSchema(colMap.schema);
      if (colMap.schema === 'unknown' || (colMap.schema !== 'codigo-unico' && (!colMap.clave || !colMap.estado))) {
        setParseError(
          'No se detectaron las columnas esperadas. ' +
          'Se requiere una columna "Código Único" (formato recomendado), ' +
          '"Clave Sitio" + "Estado" (formato SEARS) o "Unidad" + "Ciudad" (formato Coca-Cola).'
        );
        setIsParsing(false);
        return;
      }
      let parsed: CsvRow[];
      if (colMap.schema === 'codigo-unico' && colMap.codigoUnico) {
        parsed = rows.map((r, idx) => {
          const cu = trimDisplay(r[colMap.codigoUnico!]);
          const { clave, cara, estado } = splitCodigoUnico(cu);
          return {
            rowIndex: idx + 2,
            raw: r,
            clave,
            estado,
            cara: cara || null,
          };
        }).filter(r => r.clave);
      } else {
        parsed = rows.map((r, idx) => ({
          rowIndex: idx + 2,
          raw: r,
          clave: trimDisplay(r[colMap.clave]),
          estado: trimDisplay(r[colMap.estado]),
          cara: colMap.cara ? trimDisplay(r[colMap.cara]) : null,
        })).filter(r => r.clave && r.estado);
      }
      setCsvRows(parsed);
      setIsParsing(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al leer el archivo';
      setParseError(`No se pudo leer el archivo: ${msg}`);
      setIsParsing(false);
    }
  }, []);

  const matchResult = useMemo<MatchResult | null>(() => {
    if (csvRows.length === 0) return null;
    return computeMatch(csvRows, selectedInventory);
  }, [csvRows, selectedInventory]);

  const canContinue = !!matchResult && matchResult.matchedInventoryIds.length > 0;

  const handleContinue = () => {
    if (!matchResult || matchResult.matchedInventoryIds.length === 0) return;
    onContinue(matchResult.matchedInventoryIds);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose} />
      <div className={`relative w-full max-w-6xl mx-4 max-h-[92vh] flex flex-col rounded-xl border shadow-2xl ${isDark ? 'bg-zinc-900 border-purple-500/30' : 'bg-white border-purple-200'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
              <FileSpreadsheet className={`h-5 w-5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`} />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cargar CSV — Paso 1 de 3</h3>
              <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>Cotejo de archivo contra ubicaciones seleccionadas</p>
            </div>
          </div>
          <button onClick={handleClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-gray-100 text-gray-500'}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content — grid 2 columnas */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
          {/* Columna izquierda: ubicaciones seleccionadas */}
          <div className={`flex flex-col rounded-lg border overflow-hidden ${isDark ? 'border-zinc-700 bg-zinc-800/40' : 'border-gray-200 bg-gray-50'}`}>
            <div className={`px-3 py-2 border-b ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-white'} flex items-center justify-between`}>
              <span className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Ubicaciones seleccionadas</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700'}`}>
                {selectedInventory.length} total
              </span>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className={`sticky top-0 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                  <tr className={`text-left ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                    <th className="p-2 font-medium">Código Único</th>
                    <th className="p-2 font-medium">Ubicación</th>
                    <th className="p-2 font-medium">Artículo</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInventory.map((inv) => {
                    const isMatched = matchResult?.matchedInventoryIds.includes(inv.id);
                    return (
                      <tr key={inv.id} className={`border-t ${isDark ? 'border-zinc-800' : 'border-gray-100'} ${isMatched ? (isDark ? 'bg-green-500/10' : 'bg-green-50') : ''}`}>
                        <td className={`p-2 font-mono text-[10px] whitespace-nowrap ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                          {isMatched && <CheckCircle2 className="inline h-3 w-3 text-green-400 mr-1" />}
                          {inv.codigo_unico}
                        </td>
                        <td className={`p-2 truncate max-w-[180px] ${isDark ? 'text-zinc-400' : 'text-gray-600'}`} title={inv.ubicacion || ''}>{inv.ubicacion || '-'}</td>
                        <td className={`p-2 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>{inv.articulo || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Columna derecha: subir CSV + resultados del cotejo */}
          <div className={`flex flex-col rounded-lg border overflow-hidden ${isDark ? 'border-zinc-700 bg-zinc-800/40' : 'border-gray-200 bg-gray-50'}`}>
            <div className={`px-3 py-2 border-b ${isDark ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-white'}`}>
              <span className={`text-sm font-semibold ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>Archivo de cotejo</span>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-3">
              {/* Dropzone */}
              <label className={`block border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${isDark ? 'border-purple-500/40 hover:border-purple-500/60 hover:bg-purple-500/5' : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50'}`}>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />
                <div className="flex flex-col items-center text-center">
                  <Upload className={`h-6 w-6 mb-2 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                  <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-gray-800'}`}>
                    {file ? file.name : 'Click para subir CSV o XLSX'}
                  </p>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>
                    Columna requerida: <strong>Código Único</strong> (ej: PV1008_Flujo2_Puerto Vallarta)
                  </p>
                  {file && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFile(null); setCsvRows([]); setParseError(null); }}
                      className={`mt-2 text-[11px] underline ${isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      Quitar archivo
                    </button>
                  )}
                </div>
              </label>

              {/* Botón descargar CSV de ejemplo */}
              <button
                type="button"
                onClick={() => {
                  const exampleCodes = selectedInventory.slice(0, 3).map(inv => inv.codigo_unico);
                  while (exampleCodes.length < 3) exampleCodes.push('PV1008_Flujo2_Puerto Vallarta');
                  const csvContent = ['Codigo Unico', ...exampleCodes].join('\n');
                  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'ejemplo_cotejo.csv';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(link.href);
                }}
                className={`flex items-center gap-1.5 text-[11px] ${isDark ? 'text-purple-400 hover:text-purple-300' : 'text-purple-600 hover:text-purple-700'} transition-colors`}
              >
                <Download className="h-3 w-3" />
                Descargar CSV de ejemplo
              </button>

              {isParsing && (
                <div className={`text-sm flex items-center gap-2 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                  <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                  Procesando archivo...
                </div>
              )}

              {parseError && (
                <div className={`p-3 rounded-lg border flex items-start gap-2 ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p className="text-xs">{parseError}</p>
                </div>
              )}

              {/* Resumen de match */}
              {matchResult && (
                <div className="space-y-2">
                  {/* Schema detectado */}
                  <div className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs ${isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-400' : 'bg-white border-gray-200 text-gray-600'}`}>
                    <Info className="h-3.5 w-3.5" />
                    <span>
                      Esquema detectado: <strong className={isDark ? 'text-zinc-200' : 'text-gray-800'}>{schema === 'codigo-unico' ? 'Código Único' : schema === 'sears' ? 'SEARS' : schema === 'coca-cola' ? 'Coca-Cola' : 'Personalizado'}</strong>
                      {' • '}{csvRows.length} fila(s) leídas del CSV
                    </span>
                  </div>

                  {/* Coincidencias */}
                  <div className={`p-3 rounded-lg border ${
                    matchResult.matchedInventoryIds.length > 0
                      ? (isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200')
                      : (isDark ? 'bg-orange-500/10 border-orange-500/30' : 'bg-orange-50 border-orange-200')
                  }`}>
                    <div className="flex items-start gap-2">
                      {matchResult.matchedInventoryIds.length > 0 ? (
                        <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${isDark ? 'text-green-400' : 'text-green-600'}`} />
                      ) : (
                        <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isDark ? 'text-orange-400' : 'text-orange-600'}`} />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${
                          matchResult.matchedInventoryIds.length > 0
                            ? (isDark ? 'text-green-300' : 'text-green-700')
                            : (isDark ? 'text-orange-300' : 'text-orange-700')
                        }`}>
                          {matchResult.matchedInventoryIds.length === 0
                            ? '0 coincidencias — no se puede continuar'
                            : `${matchResult.matchedInventoryIds.length} coincidencia(s) entre CSV y selección`
                          }
                        </p>
                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                          {matchResult.csvRowsMatched} fila(s) del CSV matchearon contra inventarios seleccionados.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CSV rows que NO matchearon */}
                  {matchResult.csvRowsNotMatched.length > 0 && (
                    <details className={`p-2.5 rounded-lg border ${isDark ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'}`}>
                      <summary className={`text-xs cursor-pointer ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                        <strong>{matchResult.csvRowsNotMatched.length}</strong> fila(s) del CSV no se encontraron en lo seleccionado
                      </summary>
                      <div className="mt-2 max-h-32 overflow-auto">
                        <ul className={`text-[11px] space-y-0.5 ${isDark ? 'text-yellow-200' : 'text-yellow-900'}`}>
                          {matchResult.csvRowsNotMatched.slice(0, 50).map(r => (
                            <li key={r.rowIndex}>
                              Fila {r.rowIndex}: <span className="font-mono">{r.clave}</span> / {r.estado}{r.cara ? ` / ${r.cara}` : ''}
                            </li>
                          ))}
                          {matchResult.csvRowsNotMatched.length > 50 && (
                            <li className="opacity-70">... y {matchResult.csvRowsNotMatched.length - 50} más</li>
                          )}
                        </ul>
                      </div>
                    </details>
                  )}

                  {/* Seleccionados sin match (informativo) */}
                  {matchResult.selectedNotInCsv.length > 0 && (
                    <details className={`p-2.5 rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-100 border-gray-200'}`}>
                      <summary className={`text-xs cursor-pointer ${isDark ? 'text-zinc-300' : 'text-gray-700'}`}>
                        <strong>{matchResult.selectedNotInCsv.length}</strong> seleccionado(s) que no están en el CSV (informativo)
                      </summary>
                      <div className="mt-2 max-h-32 overflow-auto">
                        <ul className={`text-[11px] space-y-0.5 font-mono ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
                          {matchResult.selectedNotInCsv.slice(0, 50).map(inv => (
                            <li key={inv.id}>{inv.codigo_unico}</li>
                          ))}
                          {matchResult.selectedNotInCsv.length > 50 && (
                            <li className="opacity-70">... y {matchResult.selectedNotInCsv.length - 50} más</li>
                          )}
                        </ul>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border flex-shrink-0">
          <button onClick={handleClose} className={`px-4 py-2 text-sm rounded-lg transition-colors ${isDark ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}>
            Cancelar
          </button>
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              canContinue
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white shadow-lg shadow-purple-500/25'
                : isDark ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Siguiente: Subir Artes
          </button>
        </div>
      </div>
    </div>
  );
}
