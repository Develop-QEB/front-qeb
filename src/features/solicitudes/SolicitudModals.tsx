import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Eye, Edit2, PlayCircle, MessageSquare, Download, FileText,
  Calendar, User, Building2, Package, DollarSign, MapPin, Hash,
  Clock, Send, AlertTriangle, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, Layers, Tag, TrendingUp, BarChart3, Users
} from 'lucide-react';
import { solicitudesService, SolicitudFullDetails, Comentario, SolicitudCara, UserOption } from '../../services/solicitudes.service';
import { useSocketEquipos } from '../../hooks/useSocket';
import { notificacionesService, ResumenAutorizacion } from '../../services/notificaciones.service';
import { Solicitud, Catorcena } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';
import { UserAvatar } from '../../components/ui/user-avatar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Logo Grupo IMU
const LOGO_IMU_URL = '/logo-grupo-imu.png';

// Helper to load image as base64
const loadImageAsBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Could not get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = url;
  });
};

// Status badge colors
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  'Pendiente': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30', gradient: 'from-amber-600 to-orange-600' },
  'Aprobada': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', gradient: 'from-emerald-600 to-green-600' },
  'Rechazada': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', gradient: 'from-red-600 to-rose-600' },
  'Atendida': { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30', gradient: 'from-cyan-600 to-blue-600' },
  'Desactivada': { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/30', gradient: 'from-zinc-600 to-gray-600' },
  'Ajustar': { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', gradient: 'from-orange-600 to-amber-600' },
};

const DEFAULT_STATUS_COLOR = { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/30', gradient: 'from-violet-600 to-purple-600' };

// Helper to convert date to catorcena format
function dateToCatorcena(dateStr: string, catorcenas: Catorcena[]): { catorcena: string; year: number } | null {
  if (!dateStr || !catorcenas.length) return null;
  const date = new Date(dateStr);
  const catorcena = catorcenas.find(c => {
    const inicio = new Date(c.fecha_inicio);
    const fin = new Date(c.fecha_fin);
    return date >= inicio && date <= fin;
  });
  if (catorcena) {
    return { catorcena: `Catorcena ${catorcena.numero_catorcena}`, year: catorcena.a_o };
  }
  return null;
}

// Helper to get catorcena display string
function getCatorcenaDisplay(dateStr: string, catorcenas: Catorcena[]): string {
  const result = dateToCatorcena(dateStr, catorcenas);
  if (result) {
    return `${result.catorcena} - ${result.year}`;
  }
  return formatDate(dateStr);
}

// Helper to get catorcena range for display
function getCatorcenaRange(fechaInicio: string, fechaFin: string, catorcenas: Catorcena[]): string {
  const inicio = dateToCatorcena(fechaInicio, catorcenas);
  const fin = dateToCatorcena(fechaFin, catorcenas);

  if (inicio && fin) {
    if (inicio.catorcena === fin.catorcena && inicio.year === fin.year) {
      return `${inicio.catorcena} - ${inicio.year}`;
    }
    return `${inicio.catorcena} (${inicio.year}) a ${fin.catorcena} (${fin.year})`;
  }
  return `${formatDate(fechaInicio)} al ${formatDate(fechaFin)}`;
}

// Group caras by catorcena (parent) and articulo (nested)
interface ArticuloGroup {
  articulo: string;
  caras: SolicitudCara[];
  totalCaras: number;
  totalBonificacion: number;
  totalInversion: number;
}

interface CatorcenaGroup {
  catorcena: string;
  articulos: ArticuloGroup[];
  totalCaras: number;
  totalBonificacion: number;
  totalInversion: number;
}

function groupCarasByCatorcenaAndArticulo(caras: SolicitudCara[], catorcenas: Catorcena[]): CatorcenaGroup[] {
  const catorcenaMap: Map<string, Map<string, SolicitudCara[]>> = new Map();

  caras.forEach(cara => {
    const catorcenaResult = dateToCatorcena(cara.inicio_periodo, catorcenas);
    const catorcenaStr = catorcenaResult ? `${catorcenaResult.catorcena} - ${catorcenaResult.year}` : formatDate(cara.inicio_periodo);
    const articulo = cara.articulo || 'Sin artículo';

    if (!catorcenaMap.has(catorcenaStr)) {
      catorcenaMap.set(catorcenaStr, new Map());
    }
    const articuloMap = catorcenaMap.get(catorcenaStr)!;

    if (!articuloMap.has(articulo)) {
      articuloMap.set(articulo, []);
    }
    articuloMap.get(articulo)!.push(cara);
  });

  const result: CatorcenaGroup[] = [];

  catorcenaMap.forEach((articuloMap, catorcena) => {
    const articulos: ArticuloGroup[] = [];
    let totalCaras = 0;
    let totalBonificacion = 0;
    let totalInversion = 0;

    articuloMap.forEach((carasList, articulo) => {
      const artCaras = carasList.reduce((sum, c) => sum + (Number(c.caras) || 0), 0);
      const artBonif = carasList.reduce((sum, c) => sum + (Number(c.bonificacion) || 0), 0);
      const artInversion = carasList.reduce((sum, c) => sum + ((c.tarifa_publica || 0) * (Number(c.caras) || 0)), 0);

      articulos.push({
        articulo,
        caras: carasList,
        totalCaras: artCaras,
        totalBonificacion: artBonif,
        totalInversion: artInversion,
      });

      totalCaras += artCaras;
      totalBonificacion += artBonif;
      totalInversion += artInversion;
    });

    result.push({
      catorcena,
      articulos: articulos.sort((a, b) => a.articulo.localeCompare(b.articulo)),
      totalCaras,
      totalBonificacion,
      totalInversion,
    });
  });

  return result.sort((a, b) => a.catorcena.localeCompare(b.catorcena));
}

// ============ VIEW SOLICITUD MODAL ============
interface ViewSolicitudModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitudId: number | null;
}

export function ViewSolicitudModal({ isOpen, onClose, solicitudId }: ViewSolicitudModalProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Bloquear scroll del body cuando el modal está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const { data, isLoading } = useQuery({
    queryKey: ['solicitud-details', solicitudId],
    queryFn: () => solicitudesService.getFullDetails(solicitudId!),
    enabled: isOpen && !!solicitudId,
  });

  const { data: catorcenasData } = useQuery({
    queryKey: ['catorcenas-all'],
    queryFn: () => solicitudesService.getCatorcenas(),
    enabled: isOpen,
  });

  const catorcenas = catorcenasData?.data || [];

  const groupedCaras = useMemo(() => {
    if (!data?.caras) return [];
    return groupCarasByCatorcenaAndArticulo(data.caras, catorcenas);
  }, [data?.caras, catorcenas]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const generatePDF = async () => {
    if (!data) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 15;
    const contentWidth = pageWidth - marginX * 2;
    const centerX = pageWidth / 2;

    // Colores corporativos IMU
    const imuBlue: [number, number, number] = [0, 113, 206];
    const imuGreen: [number, number, number] = [118, 183, 42];
    const imuDarkBlue: [number, number, number] = [27, 42, 74];
    const white: [number, number, number] = [255, 255, 255];
    const lightBg: [number, number, number] = [250, 251, 252];
    const textDark: [number, number, number] = [30, 41, 59];
    const textMuted: [number, number, number] = [120, 130, 145];

    // === FONDO ===
    doc.setFillColor(...white);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // === HEADER ===
    doc.setFillColor(...imuDarkBlue);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setFillColor(...imuGreen);
    doc.rect(0, 32, pageWidth, 2, 'F');

    // Logo Grupo IMU - cargar imagen
    try {
      const logoBase64 = await loadImageAsBase64(LOGO_IMU_URL);
      // El logo original es ~6033x6151, lo escalamos para el header
      const logoHeight = 22;
      const logoWidth = logoHeight * (6033 / 6151); // Mantener proporción
      doc.addImage(logoBase64, 'PNG', marginX, 5, logoWidth, logoHeight);
    } catch (err) {
      // Fallback: texto si no carga la imagen
      console.warn('No se pudo cargar el logo, usando texto:', err);
      doc.setTextColor(...imuGreen);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Grupo', marginX, 11);
      doc.setTextColor(...white);
      doc.setFontSize(18);
      doc.text('IMU', marginX, 21);
      doc.setFontSize(5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(160, 165, 175);
      doc.text('Imagenes y muebles urbanos', marginX, 27);
    }

    // Título "SOLICITUD" centrado
    doc.setTextColor(...white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SOLICITUD', centerX, 18, { align: 'center' });

    // Número de solicitud debajo del título
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 185, 195);
    doc.text(`No. ${data.solicitud.id}`, centerX, 26, { align: 'center' });

    let yPos = 42;

    // === DATOS DE LA CAMPAÑA ===
    doc.setFillColor(...lightBg);
    doc.roundedRect(marginX, yPos, contentWidth, 32, 3, 3, 'F');

    doc.setTextColor(...imuDarkBlue);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS DE LA CAMPAÑA', marginX + 5, yPos + 8);

    // Línea decorativa
    doc.setFillColor(...imuBlue);
    doc.rect(marginX + 5, yPos + 10, 35, 0.5, 'F');

    const col1 = marginX + 5;
    const col2 = marginX + contentWidth / 2;

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');

    // Fila 1
    doc.setTextColor(...textMuted);
    doc.text('Nombre Campaña:', col1, yPos + 17);
    doc.setTextColor(...textDark);
    doc.setFont('helvetica', 'bold');
    doc.text(String(data.cotizacion?.nombre_campania || '-').substring(0, 40), col1 + 28, yPos + 17);

    // Fila 2: Período
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text('Período:', col1, yPos + 24);

    const fechaInicio = data.cotizacion?.fecha_inicio ? formatDate(data.cotizacion.fecha_inicio) : '-';
    const fechaFin = data.cotizacion?.fecha_fin ? formatDate(data.cotizacion.fecha_fin) : '-';
    const catInicio = data.cotizacion?.fecha_inicio ? getCatorcenaDisplay(data.cotizacion.fecha_inicio, catorcenas) : '';
    const catFin = data.cotizacion?.fecha_fin ? getCatorcenaDisplay(data.cotizacion.fecha_fin, catorcenas) : '';

    doc.setTextColor(...imuBlue);
    doc.setFont('helvetica', 'bold');
    doc.text(`${fechaInicio}`, col1 + 15, yPos + 24);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(`(${catInicio})`, col1 + 35, yPos + 24);

    doc.setTextColor(...textDark);
    doc.text('al', col1 + 60, yPos + 24);

    doc.setTextColor(...imuBlue);
    doc.setFont('helvetica', 'bold');
    doc.text(`${fechaFin}`, col1 + 67, yPos + 24);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textMuted);
    doc.text(`(${catFin})`, col1 + 87, yPos + 24);

    yPos += 38;

    // === INFORMACIÓN DEL CLIENTE ===
    doc.setFillColor(...lightBg);
    doc.roundedRect(marginX, yPos, contentWidth, 40, 3, 3, 'F');

    doc.setTextColor(...imuDarkBlue);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DEL CLIENTE', marginX + 5, yPos + 8);

    doc.setFillColor(...imuGreen);
    doc.rect(marginX + 5, yPos + 10, 40, 0.5, 'F');

    const clienteInfo = [
      ['Cliente', data.solicitud.razon_social || '-', 'Asesor', data.solicitud.asesor || '-'],
      ['Producto', data.solicitud.producto_nombre || '-', 'Categoría', data.solicitud.categoria_nombre || '-'],
      ['Agencia', data.solicitud.agencia || '-', 'Marca', data.solicitud.marca_nombre || '-'],
    ];

    doc.setFontSize(7);
    let infoY = yPos + 17;
    clienteInfo.forEach(row => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textMuted);
      doc.text(row[0] + ':', col1, infoY);
      doc.setTextColor(...textDark);
      doc.text(String(row[1]).substring(0, 30), col1 + 18, infoY);

      doc.setTextColor(...textMuted);
      doc.text(row[2] + ':', col2, infoY);
      doc.setTextColor(...textDark);
      doc.text(String(row[3]).substring(0, 30), col2 + 18, infoY);

      infoY += 7;
    });

    yPos += 46;

    // === RESUMEN (centrado y estético) ===
    if (data.cotizacion) {
      doc.setFillColor(...imuDarkBlue);
      doc.roundedRect(marginX, yPos, contentWidth, 20, 3, 3, 'F');

      const summaryItems = [
        { label: 'Total de Caras', value: data.cotizacion.numero_caras?.toString() || '0' },
        { label: 'Bonificadas', value: data.cotizacion.bonificacion?.toString() || '0' },
        { label: 'Caras Facturadas', value: ((data.cotizacion.numero_caras || 0) + (data.cotizacion.bonificacion || 0)).toString() },
        { label: 'Inversión', value: formatCurrency(data.cotizacion.precio || 0) },
      ];

      const totalItemsWidth = summaryItems.length * 40;
      const startX = (pageWidth - totalItemsWidth) / 2;

      summaryItems.forEach((item, idx) => {
        const itemX = startX + idx * 45;
        // Valor grande centrado
        doc.setTextColor(...white);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, itemX + 20, yPos + 10, { align: 'center' });
        // Label pequeño debajo
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 185, 200);
        doc.text(item.label, itemX + 20, yPos + 16, { align: 'center' });
      });

      yPos += 26;
    }

    // === DETALLE DE CARAS ===
    if (groupedCaras.length > 0) {
      doc.setTextColor(...imuDarkBlue);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALLE DE CARAS', marginX, yPos);

      doc.setFillColor(...imuBlue);
      doc.rect(marginX, yPos + 2, 28, 0.5, 'F');

      yPos += 8;

      groupedCaras.forEach((catorcenaGroup) => {
        if (yPos > pageHeight - 40) {
          doc.addPage();
          doc.setFillColor(...white);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          // Mini header
          doc.setFillColor(...imuDarkBlue);
          doc.rect(0, 0, pageWidth, 10, 'F');
          doc.setFillColor(...imuGreen);
          doc.rect(0, 10, pageWidth, 1, 'F');
          doc.setTextColor(...white);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(`Solicitud ${data.solicitud.id}`, marginX, 7);
          yPos = 18;
        }

        // Header de catorcena
        doc.setFillColor(...imuBlue);
        doc.roundedRect(marginX, yPos, contentWidth, 8, 1, 1, 'F');
        doc.setTextColor(...white);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(catorcenaGroup.catorcena, marginX + 4, yPos + 5.5);

        // Subtotales en el header de catorcena
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        const catorcenaSubtotal = `Caras: ${catorcenaGroup.totalCaras} | Bonif: ${catorcenaGroup.totalBonificacion} | Inversión: $${catorcenaGroup.totalInversion.toLocaleString('es-MX')}`;
        doc.text(catorcenaSubtotal, pageWidth - marginX - 4, yPos + 5.5, { align: 'right' });
        yPos += 10;

        // Por cada artículo dentro de la catorcena
        catorcenaGroup.articulos.forEach((articuloGroup) => {
          if (yPos > pageHeight - 35) {
            doc.addPage();
            doc.setFillColor(...white);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            doc.setFillColor(...imuDarkBlue);
            doc.rect(0, 0, pageWidth, 10, 'F');
            doc.setFillColor(...imuGreen);
            doc.rect(0, 10, pageWidth, 1, 'F');
            doc.setTextColor(...white);
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.text(`Solicitud ${data.solicitud.id}`, marginX, 7);
            yPos = 18;
          }

          // Header del artículo
          doc.setFillColor(...imuGreen);
          doc.roundedRect(marginX + 5, yPos, contentWidth - 10, 6, 1, 1, 'F');
          doc.setTextColor(...white);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(articuloGroup.articulo, marginX + 9, yPos + 4);
          doc.setFont('helvetica', 'normal');
          doc.text(`Caras: ${articuloGroup.totalCaras} | $${articuloGroup.totalInversion.toLocaleString('es-MX')}`, pageWidth - marginX - 9, yPos + 4, { align: 'right' });
          yPos += 8;

          // Tabla de caras para este artículo
          let rowNum = 0;
          const tableData = articuloGroup.caras.map(c => {
            rowNum++;
            const inversionCara = (Number(c.tarifa_publica) || 0) * (Number(c.caras) || 0);
            return [
              rowNum.toString(),
              c.estados || '-',
              c.ciudad || '-',
              c.formato || '-',
              (Number(c.caras) || 0).toString(),
              (Number(c.bonificacion) || 0).toString(),
              `$${inversionCara.toLocaleString('es-MX')}`,
            ];
          });

          autoTable(doc, {
            startY: yPos,
            head: [['#', 'Estado', 'Ciudad', 'Formato', 'Caras', 'Bonif.', 'Inversión']],
            body: tableData,
            theme: 'plain',
            margin: { left: marginX + 5, right: marginX + 5 },
            styles: {
              fontSize: 7,
              cellPadding: 2,
              textColor: textDark,
              lineColor: [230, 235, 240],
              lineWidth: 0.1,
            },
            headStyles: {
              fillColor: [240, 245, 250],
              textColor: imuDarkBlue,
              fontStyle: 'bold',
              fontSize: 7,
              halign: 'center',
            },
            alternateRowStyles: { fillColor: [252, 253, 255] },
            columnStyles: {
              0: { cellWidth: 8, halign: 'center' },   // #
              1: { cellWidth: 30 },                     // Estado
              2: { cellWidth: 30 },                     // Ciudad
              3: { cellWidth: 35 },                     // Formato
              4: { cellWidth: 15, halign: 'center' },  // Caras
              5: { cellWidth: 15, halign: 'center' },  // Bonif.
              6: { cellWidth: 25, halign: 'right' },   // Inversión
            },
          });

          yPos = (doc as any).lastAutoTable.finalY + 4;
        }); // End articulos forEach

        yPos += 4; // Extra space after catorcena group
      }); // End catorcenas forEach
    }

    // === FOOTER ===
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFillColor(...imuGreen);
      doc.rect(0, pageHeight - 8, pageWidth, 0.8, 'F');
      doc.setFillColor(...imuDarkBlue);
      doc.rect(0, pageHeight - 7, pageWidth, 7, 'F');
      doc.setTextColor(...white);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text('Grupo IMU', marginX, pageHeight - 2.5);
      doc.text(`${i} / ${totalPages}`, pageWidth - marginX, pageHeight - 2.5, { align: 'right' });
    }

    // Save
    const fileName = `Solicitud_${data.solicitud.id}_${(data.cotizacion?.nombre_campania || '').replace(/[^a-zA-Z0-9]/g, '_') || 'documento'}.pdf`;
    doc.save(fileName);
  };

  if (!isOpen) return null;

  // Calcular KPIs desde las caras reales
  const totalRenta = data?.caras?.reduce((sum, c) => sum + (Number(c.caras) || 0), 0) || 0;
  const totalBonificacion = data?.caras?.reduce((sum, c) => sum + (Number(c.bonificacion) || 0), 0) || 0;
  const totalCaras = totalRenta + totalBonificacion;
  const totalTarifaPublica = data?.caras?.reduce((sum, c) => sum + (Number(c.tarifa_publica) || 0), 0) || 0;
  // Inversión = tarifa pública * caras en renta
  const inversion = data?.caras?.reduce((sum, c) => sum + ((Number(c.tarifa_publica) || 0) * (Number(c.caras) || 0)), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 isolate">
      <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800/50 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-50">
        {/* Header - Estilo violeta consistente */}
        <div className="relative px-6 py-5 border-b border-violet-500/20 bg-gradient-to-r from-violet-600/20 via-purple-600/15 to-fuchsia-600/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white">Solicitud</h2>
                  {data && (
                    <span className="text-violet-300 font-semibold">#{data.solicitud.id}</span>
                  )}
                </div>
                {data?.cotizacion?.nombre_campania && (
                  <p className="text-zinc-400 text-sm">{data.cotizacion.nombre_campania}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={generatePDF}
                disabled={isLoading || !data}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 text-violet-300 text-sm font-medium hover:bg-violet-500/30 disabled:opacity-50 transition-all border border-violet-500/30"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl transition-colors">
                <X className="h-5 w-5 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <span className="text-zinc-500 text-sm">Cargando...</span>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-5">
              {/* Stats Row - Centrado y limpio */}
              <div className="bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-fuchsia-600/10 rounded-2xl p-5 border border-violet-500/20">
                <div className="grid grid-cols-4 gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{totalCaras}</p>
                    <p className="text-xs text-zinc-400 mt-1">Total Caras</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-violet-400">{totalRenta}</p>
                    <p className="text-xs text-zinc-400 mt-1">En Renta</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{totalBonificacion}</p>
                    <p className="text-xs text-zinc-400 mt-1">Bonificación</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{formatCurrency(inversion)}</p>
                    <p className="text-xs text-zinc-400 mt-1">Inversión</p>
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Campaña Info */}
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Campaña
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Nombre</span>
                      <span className="text-white text-sm font-medium">{data.cotizacion?.nombre_campania || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Período</span>
                      <span className="text-violet-300 text-sm font-medium">
                        {data.cotizacion ? getCatorcenaRange(data.cotizacion.fecha_inicio, data.cotizacion.fecha_fin, catorcenas) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Catorcena Inicio</span>
                      <span className="text-white text-sm">{data.cotizacion?.fecha_inicio ? getCatorcenaDisplay(data.cotizacion.fecha_inicio, catorcenas) : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Catorcena Fin</span>
                      <span className="text-white text-sm">{data.cotizacion?.fecha_fin ? getCatorcenaDisplay(data.cotizacion.fecha_fin, catorcenas) : '-'}</span>
                    </div>
                    {data.solicitud.descripcion && (
                      <div className="pt-2 border-t border-zinc-700/50">
                        <span className="text-zinc-500 text-sm block mb-1">Descripción</span>
                        <span className="text-zinc-300 text-sm">{data.solicitud.descripcion}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cliente Info */}
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-4 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Cliente
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">CUIC</span>
                      <span className="text-white text-sm font-mono">{data.solicitud.cuic || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Razón Social</span>
                      <span className="text-white text-sm font-medium truncate ml-4">{data.solicitud.razon_social || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Marca</span>
                      <span className="text-white text-sm">{data.solicitud.marca_nombre || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Categoría</span>
                      <span className="text-white text-sm">{data.solicitud.categoria_nombre || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 text-sm">Agencia</span>
                      <span className="text-white text-sm">{data.solicitud.agencia || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* More Info Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Asesor
                  </h3>
                  <p className="text-white font-medium">{data.solicitud.asesor || '-'}</p>
                  <p className="text-zinc-500 text-xs mt-1">Asesor comercial</p>
                </div>
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Producto
                  </h3>
                  <p className="text-white font-medium">{data.solicitud.producto_nombre || '-'}</p>
                  <p className="text-zinc-500 text-xs mt-1">Producto/Servicio</p>
                </div>
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Asignados
                  </h3>
                  {data.solicitud.asignado ? (
                    <ul className="space-y-1.5">
                      {data.solicitud.asignado.split(',').map((nombre, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                          <span className="text-white text-sm">{nombre.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-zinc-500 text-sm">Sin asignar</p>
                  )}
                </div>
              </div>

              {/* Caras grouped - Diseño con colores */}
              {groupedCaras.length > 0 && (
                <div className="bg-gradient-to-br from-violet-900/20 via-purple-900/15 to-fuchsia-900/10 rounded-2xl border border-violet-500/20 overflow-hidden">
                  <div className="px-5 py-4 border-b border-violet-500/20 bg-violet-600/10">
                    <h3 className="text-sm font-semibold text-violet-300 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Detalle de Caras
                    </h3>
                  </div>
                  <div className="divide-y divide-violet-500/10">
                    {groupedCaras.map((catorcenaGroup) => (
                      <div key={catorcenaGroup.catorcena}>
                        {/* Catorcena Header (Parent Level) */}
                        <button
                          onClick={() => toggleGroup(catorcenaGroup.catorcena)}
                          className="w-full px-5 py-3 flex items-center justify-between hover:bg-violet-600/10 transition-colors bg-violet-600/5"
                        >
                          <div className="flex items-center gap-3">
                            {expandedGroups.has(catorcenaGroup.catorcena) ? (
                              <ChevronDown className="h-4 w-4 text-violet-400" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-violet-500/50" />
                            )}
                            <span className="px-3 py-1 rounded-lg bg-violet-500/30 text-violet-200 text-xs font-medium border border-violet-400/30">
                              {catorcenaGroup.catorcena}
                            </span>
                            <span className="text-zinc-500 text-xs">
                              ({catorcenaGroup.articulos.length} artículo{catorcenaGroup.articulos.length > 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-400 text-xs">Renta:</span>
                              <span className="text-white text-sm font-semibold">{catorcenaGroup.totalCaras}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-400 text-xs">Bonif:</span>
                              <span className="text-white text-sm font-semibold">{catorcenaGroup.totalBonificacion}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-zinc-400 text-xs">Total:</span>
                              <span className="text-white text-sm font-bold">{catorcenaGroup.totalCaras + catorcenaGroup.totalBonificacion}</span>
                            </div>
                            <div className="flex items-center gap-1.5 pl-2 border-l border-violet-500/30">
                              <span className="text-emerald-400 text-xs">Inversión:</span>
                              <span className="text-emerald-300 text-sm font-semibold">{formatCurrency(catorcenaGroup.totalInversion)}</span>
                            </div>
                          </div>
                        </button>

                        {/* Articulo Groups (Nested Level) */}
                        {expandedGroups.has(catorcenaGroup.catorcena) && (
                          <div className="pl-6 border-l-2 border-violet-500/20 ml-5">
                            {catorcenaGroup.articulos.map((articuloGroup) => {
                              const articuloKey = `${catorcenaGroup.catorcena}|${articuloGroup.articulo}`;
                              return (
                                <div key={articuloKey} className="border-b border-violet-500/10 last:border-b-0">
                                  <button
                                    onClick={() => toggleGroup(articuloKey)}
                                    className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-purple-600/10 transition-colors"
                                  >
                                    <div className="flex items-center gap-3">
                                      {expandedGroups.has(articuloKey) ? (
                                        <ChevronDown className="h-3.5 w-3.5 text-purple-400" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5 text-purple-500/50" />
                                      )}
                                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-200 text-xs font-medium border border-purple-400/20">
                                        {articuloGroup.articulo}
                                      </span>
                                      <span className="text-zinc-500 text-xs">
                                        ({articuloGroup.caras.length} cara{articuloGroup.caras.length > 1 ? 's' : ''})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span className="text-zinc-400">R: <span className="text-white font-medium">{articuloGroup.totalCaras}</span></span>
                                      <span className="text-zinc-400">B: <span className="text-white font-medium">{articuloGroup.totalBonificacion}</span></span>
                                      <span className="text-emerald-400">{formatCurrency(articuloGroup.totalInversion)}</span>
                                    </div>
                                  </button>

                                  {expandedGroups.has(articuloKey) && (
                                    <div className="px-4 pb-3">
                                      <div className="overflow-x-auto rounded-xl border border-violet-500/20 bg-zinc-900/50">
                                        <table className="w-full text-sm">
                                          <thead>
                                            <tr className="bg-violet-600/20">
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-violet-200">Ciudad</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-violet-200">Estado</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-violet-200">Formato</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-violet-200">Tipo</th>
                                              <th className="px-3 py-2 text-center text-xs font-semibold text-violet-200">Renta</th>
                                              <th className="px-3 py-2 text-center text-xs font-semibold text-violet-200">Bonif</th>
                                              <th className="px-3 py-2 text-center text-xs font-semibold text-white">Total</th>
                                              <th className="px-3 py-2 text-right text-xs font-semibold text-amber-300">Tarifa</th>
                                              <th className="px-3 py-2 text-right text-xs font-semibold text-emerald-300">Inversión</th>
                                              <th className="px-3 py-2 text-center text-xs font-semibold text-violet-200">Autorización</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-violet-500/10">
                                            {articuloGroup.caras.map((cara, idx) => {
                                              const inversion = (cara.tarifa_publica || 0) * (Number(cara.caras) || 0);
                                              const estadoAuth = cara.estado_autorizacion || 'aprobado';
                                              const authBadgeColors: Record<string, { bg: string; text: string; border: string }> = {
                                                'aprobado': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
                                                'pendiente_dcm': { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
                                                'pendiente_dg': { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
                                                'rechazado': { bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/30' },
                                              };
                                              const authLabels: Record<string, string> = {
                                                'aprobado': 'Aprobado',
                                                'pendiente_dcm': 'Pend. DCM',
                                                'pendiente_dg': 'Pend. DG',
                                                'rechazado': 'Rechazado',
                                              };
                                              const authColor = authBadgeColors[estadoAuth] || authBadgeColors['aprobado'];
                                              const authLabel = authLabels[estadoAuth] || estadoAuth;
                                              return (
                                                <tr key={idx} className="hover:bg-violet-600/10 transition-colors">
                                                  <td className="px-3 py-2 text-zinc-200">{cara.ciudad || '-'}</td>
                                                  <td className="px-3 py-2 text-zinc-300">{cara.estados || '-'}</td>
                                                  <td className="px-3 py-2 text-zinc-300">{cara.formato || '-'}</td>
                                                  <td className="px-3 py-2 text-zinc-300">{cara.tipo || '-'}</td>
                                                  <td className="px-3 py-2 text-center text-white font-medium">{Number(cara.caras) || 0}</td>
                                                  <td className="px-3 py-2 text-center text-white font-medium">{Number(cara.bonificacion) || 0}</td>
                                                  <td className="px-3 py-2 text-center text-white font-bold">{(Number(cara.caras) || 0) + (Number(cara.bonificacion) || 0)}</td>
                                                  <td className="px-3 py-2 text-right text-amber-300 font-medium">{formatCurrency(cara.tarifa_publica || 0)}</td>
                                                  <td className="px-3 py-2 text-right text-emerald-300 font-medium">{formatCurrency(inversion)}</td>
                                                  <td className="px-3 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${authColor.bg} ${authColor.text} border ${authColor.border}`}>
                                                      {authLabel}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Archivo Adjunto - Con preview */}
              {data.solicitud.archivo && (
                <div className="bg-zinc-800/30 rounded-2xl border border-zinc-800/50 overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-800/50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-violet-400 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Archivo Adjunto
                    </h3>
                    <a
                      href={data.solicitud.archivo}
                      download
                      className="px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 text-xs font-medium hover:bg-violet-500/30 transition-colors flex items-center gap-1.5 border border-violet-500/30"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </a>
                  </div>
                  <div className="p-4">
                    {data.solicitud.tipo_archivo?.startsWith('image/') ? (
                      <div className="relative rounded-xl overflow-hidden bg-zinc-900/50 border border-zinc-700/50">
                        <img
                          src={data.solicitud.archivo}
                          alt="Archivo adjunto"
                          className="w-full max-h-64 object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-4 bg-zinc-900/50 rounded-xl border border-zinc-700/50">
                        <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-violet-400" />
                        </div>
                        <div>
                          <p className="text-sm text-white font-medium">Documento</p>
                          <p className="text-xs text-zinc-500">{data.solicitud.tipo_archivo || 'Archivo adjunto'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Historial - Compacto */}
              {data.historial && data.historial.length > 0 && (
                <div className="bg-zinc-800/30 rounded-2xl p-5 border border-zinc-800/50">
                  <h3 className="text-sm font-semibold text-violet-400 mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Historial
                  </h3>
                  <div className="space-y-3">
                    {data.historial.slice(0, 5).map((h, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-violet-500" />
                        <span className="text-zinc-400">{formatDate(h.fecha_hora)}</span>
                        <span className="px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 text-xs">{h.accion}</span>
                        <span className="text-zinc-500 truncate flex-1">{h.detalles}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <XCircle className="h-12 w-12 mb-3 text-zinc-600" />
              <p>No se pudo cargar la información</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', icon: 'text-violet-400' },
    cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: 'text-cyan-400' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: 'text-amber-400' },
  };
  const c = colors[color] || colors.violet;

  return (
    <div className={`${c.bg} rounded-2xl p-4 border border-zinc-800`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${c.icon}`} />
        <span className="text-zinc-400 text-xs">{label}</span>
      </div>
      <p className={`text-lg font-bold ${c.text}`}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, mono = false, highlight = false }: { label: string; value?: string | null; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <span className="text-zinc-500 text-xs block mb-0.5">{label}</span>
      <span className={`text-sm ${mono ? 'font-mono' : ''} ${highlight ? 'text-violet-400 font-medium' : 'text-white'}`}>
        {value || '-'}
      </span>
    </div>
  );
}

// ============ STATUS MODAL WITH COMMENTS ============
interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitud: Solicitud | null;
  onStatusChange: () => void;
  statusReadOnly?: boolean; // Si es true, solo puede ver y comentar, no cambiar estado
}

export function StatusModal({ isOpen, onClose, solicitud, onStatusChange, statusReadOnly = false }: StatusModalProps) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Query para obtener detalles completos (incluye caras con idquote)
  const { data: solicitudDetails } = useQuery({
    queryKey: ['solicitud-details', solicitud?.id],
    queryFn: () => solicitudesService.getFullDetails(solicitud!.id),
    enabled: isOpen && !!solicitud?.id,
  });

  // Obtener idquote de las caras (todas las caras de una solicitud tienen el mismo idquote)
  const idquote = solicitudDetails?.caras?.[0]?.idquote;

  // Query para verificar autorización pendiente
  const { data: autorizacionResumen } = useQuery({
    queryKey: ['autorizacion-resumen', idquote],
    queryFn: () => notificacionesService.getResumenAutorizacion(idquote!),
    enabled: isOpen && !!idquote,
  });

  // Verificar si hay caras pendientes de autorización
  const tienePendientes = autorizacionResumen && (autorizacionResumen.pendientesDg > 0 || autorizacionResumen.pendientesDcm > 0);

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ['solicitud-comments', solicitud?.id],
    queryFn: () => solicitudesService.getComments(solicitud!.id),
    enabled: isOpen && !!solicitud,
    staleTime: 60000, // 1 minuto - evita refetches innecesarios
  });

  // Refetch comments when modal opens
  useEffect(() => {
    if (isOpen && solicitud) {
      refetchComments();
    }
  }, [isOpen, solicitud, refetchComments]);

  const addCommentMutation = useMutation({
    mutationFn: ({ id, comentario }: { id: number; comentario: string }) =>
      solicitudesService.addComment(id, comentario),
    onSuccess: () => {
      setNewComment('');
      refetchComments();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      solicitudesService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
      onStatusChange();
    },
  });

  useEffect(() => {
    if (solicitud) {
      setSelectedStatus(solicitud.status);
    }
  }, [solicitud]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleAddComment = () => {
    if (!newComment.trim() || !solicitud) return;
    addCommentMutation.mutate({ id: solicitud.id, comentario: newComment });
  };

  const handleChangeStatus = () => {
    if (!solicitud || selectedStatus === solicitud.status) return;
    updateStatusMutation.mutate({ id: solicitud.id, status: selectedStatus });
  };

  if (!isOpen || !solicitud) return null;

  const statusColor = STATUS_COLORS[solicitud.status] || DEFAULT_STATUS_COLOR;
  const statusOptions = ['Pendiente', 'Aprobada', 'Rechazada', 'Desactivada', 'Ajustar'];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Estado y Comentarios</h2>
            <span className={`px-2 py-1 rounded-full text-xs ${statusColor.bg} ${statusColor.text} border ${statusColor.border}`}>
              {solicitud.status}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>

        {/* Status Selector */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-800/30">
          {/* Alerta de autorización pendiente */}
          {tienePendientes && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-200 font-medium">Autorización pendiente</p>
                <p className="text-xs text-amber-300/70 mt-1">
                  Esta solicitud tiene {(autorizacionResumen?.pendientesDg || 0) + (autorizacionResumen?.pendientesDcm || 0)} cara(s) pendientes de autorización.
                  {autorizacionResumen?.pendientesDg ? ` DG: ${autorizacionResumen.pendientesDg}.` : ''}
                  {autorizacionResumen?.pendientesDcm ? ` DCM: ${autorizacionResumen.pendientesDcm}.` : ''}
                  {' '}No se puede aprobar hasta que todas las caras sean autorizadas.
                </p>
              </div>
            </div>
          )}
          {statusReadOnly ? (
            <>
              <label className="block text-sm text-zinc-400 mb-2">Estado actual:</label>
              <div className="px-4 py-2 rounded-lg bg-zinc-800/50 border border-zinc-700 text-white text-sm">
                {solicitud.status}
              </div>
            </>
          ) : (
            <>
              <label className="block text-sm text-zinc-400 mb-2">Cambiar estado a:</label>
              <div className="flex items-center gap-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                >
                  {statusOptions.map(s => (
                    <option
                      key={s}
                      value={s}
                      disabled={s === 'Aprobada' && tienePendientes}
                    >
                      {s}{s === 'Aprobada' && tienePendientes ? ' (Requiere autorización)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleChangeStatus}
                  disabled={selectedStatus === solicitud.status || updateStatusMutation.isPending || (selectedStatus === 'Aprobada' && tienePendientes)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] justify-center"
                >
                  {updateStatusMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Actualizando...
                    </>
                  ) : (
                    'Actualizar'
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {comments && comments.length > 0 ? (
            comments.slice().reverse().map((comment) => (
              <CommentBubble key={comment.id} comment={comment} />
            ))
          ) : (
            <div className="text-center text-zinc-500 py-8">
              No hay comentarios aún
            </div>
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* New Comment Input */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-800/30">
          <div className="flex items-end gap-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || addCommentMutation.isPending}
              className="p-3 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addCommentMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommentBubble({ comment }: { comment: Comentario }) {
  return (
    <div className="flex gap-3">
      <UserAvatar nombre={comment.autor_nombre} foto_perfil={comment.autor_foto} size="lg" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-white text-sm">{comment.autor_nombre}</span>
          <span className="text-xs text-zinc-500">
            {new Date(comment.creado_en).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-sm text-zinc-300">
          {comment.comentario}
        </div>
      </div>
    </div>
  );
}

// ============ ATENDER MODAL ============
interface AtenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  solicitud: Solicitud | null;
  onSuccess: () => void;
}

export function AtenderModal({ isOpen, onClose, solicitud, onSuccess }: AtenderModalProps) {
  const [selectedAsignados, setSelectedAsignados] = useState<{ id: number; nombre: string }[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Socket para actualizar usuarios en tiempo real
  useSocketEquipos();

  // Block body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Fetch ALL users (no team filtering) to include Tráfico users globally
  const { data: users } = useQuery({
    queryKey: ['solicitudes-users', 'all-users', 'atender-modal'],
    queryFn: () => solicitudesService.getUsers(undefined, false),
    enabled: isOpen,
  });

  // Pre-populate asignados with: 1) Original assignees from solicitud + 2) All users from "Tráfico" area
  useEffect(() => {
    if (isOpen && solicitud && users) {
      const combinedAsignados: { id: number; nombre: string }[] = [];
      const addedIds = new Set<number>();

      // 1. Add original assignees from solicitud
      if (solicitud.id_asignado && solicitud.asignado) {
        const ids = solicitud.id_asignado.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        const nombres = solicitud.asignado.split(',').map(n => n.trim());
        ids.forEach((id, idx) => {
          if (nombres[idx] && !addedIds.has(id)) {
            combinedAsignados.push({ id, nombre: nombres[idx] });
            addedIds.add(id);
          }
        });
      }

      // 2. Add all users from Tráfico area (if not already added)
      const traficoUsers = users.filter(u =>
        u.area?.toLowerCase() === 'tráfico' || u.area?.toLowerCase() === 'trafico'
      );
      traficoUsers.forEach(u => {
        if (!addedIds.has(u.id)) {
          combinedAsignados.push({ id: u.id, nombre: u.nombre });
          addedIds.add(u.id);
        }
      });

      setSelectedAsignados(combinedAsignados);
    }
  }, [isOpen, solicitud, users]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const queryClient = useQueryClient();

  const atenderMutation = useMutation({
    mutationFn: ({ id, asignados }: { id: number; asignados: { id: number; nombre: string }[] }) =>
      solicitudesService.atender(id, asignados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitudes'] });
      queryClient.invalidateQueries({ queryKey: ['solicitudes-stats'] });
      queryClient.invalidateQueries({ queryKey: ['propuestas'] });
      onSuccess();
      onClose();
    },
  });

  const handleAddUser = (user: UserOption) => {
    if (!selectedAsignados.find(a => a.id === user.id)) {
      setSelectedAsignados(prev => [...prev, { id: user.id, nombre: user.nombre }]);
    }
    setUserSearch('');
    setShowUserDropdown(false);
  };

  const handleRemoveUser = (userId: number) => {
    setSelectedAsignados(prev => prev.filter(a => a.id !== userId));
  };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u =>
      !selectedAsignados.find(a => a.id === u.id) &&
      u.nombre.toLowerCase().includes(userSearch.toLowerCase())
    );
  }, [users, selectedAsignados, userSearch]);

  if (!isOpen || !solicitud) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
            <PlayCircle className="h-6 w-6 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Atender Solicitud</h3>
            <p className="text-sm text-zinc-400">#{solicitud.id}</p>
          </div>
        </div>

        {/* Asignados Section */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            <Users className="h-4 w-4 inline mr-1.5 text-cyan-400" />
            Asignados
          </label>
          <div className="relative" ref={dropdownRef}>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 min-h-[48px]">
              {selectedAsignados.map(asignado => (
                <span
                  key={asignado.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs border border-cyan-500/30"
                >
                  {asignado.nombre}
                  <button
                    type="button"
                    onClick={() => handleRemoveUser(asignado.id)}
                    className="hover:text-cyan-100 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setShowUserDropdown(true);
                }}
                onFocus={() => setShowUserDropdown(true)}
                placeholder={selectedAsignados.length === 0 ? "Buscar usuarios..." : ""}
                className="flex-1 min-w-[120px] bg-transparent text-white text-sm placeholder:text-zinc-500 focus:outline-none"
              />
            </div>
            {showUserDropdown && filteredUsers.length > 0 && (
              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg bg-zinc-800 border border-zinc-700 shadow-lg">
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleAddUser(user)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-700 transition-colors"
                  >
                    <span className="text-white">{user.nombre}</span>
                    {user.area && (
                      <span className="text-zinc-500 text-xs ml-2">({user.area})</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1.5">
            Los asignados serán responsables de dar seguimiento a la propuesta
          </p>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 text-sm font-medium mb-1">¿Estás seguro?</p>
              <p className="text-amber-200/80 text-xs">
                Al atender esta solicitud, se creará una propuesta activa y se notificará al equipo asignado.
                Esta acción no se puede deshacer.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
          <h4 className="text-sm text-zinc-400 mb-2">Lo que sucederá:</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2 text-zinc-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              El status cambiará a "Atendida"
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              La propuesta se activará con status "Abierto"
            </li>
            <li className="flex items-center gap-2 text-zinc-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Se crearán tareas de seguimiento
            </li>
          </ul>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 border border-zinc-700"
          >
            Cancelar
          </button>
          <button
            onClick={() => atenderMutation.mutate({ id: solicitud.id, asignados: selectedAsignados })}
            disabled={atenderMutation.isPending}
            className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm hover:bg-cyan-700 disabled:opacity-50 flex items-center gap-2"
          >
            {atenderMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Atender Solicitud
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
