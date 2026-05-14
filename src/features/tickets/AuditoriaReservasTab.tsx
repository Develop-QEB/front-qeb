import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2, AlertTriangle, Search, Database, Calendar, Building2, Copy, UserX,
  Activity, Trash2, Bug, MapPin, Users, Tag, Layers, ArrowRightLeft, Boxes, ChevronRight,
} from 'lucide-react';
import { auditReservasService } from '../../services/auditReservas.service';

type SubTab =
  | 'resumen'
  | 'duplicados' | 'cross-cam-fisico' | 'inv-duplicados' | 'cod-reutilizado'
  | 'huerfanos' | 'zombies' | 'reservas-sucias' | 'ei-duplicado'
  | 'cliente-desalineado' | 'status-raro'
  | 'inv-sucio'
  | 'aps-compartido'
  | 'marca-clientes-dup'
  | 'catorcena' | 'cliente' | 'vendedor';

// =============================================================================
// KPI cards
// =============================================================================
function KpiCard({
  label, value, isDark, severity = 'neutral', hint, onClick,
}: {
  label: string; value: number | string; isDark: boolean;
  severity?: 'neutral' | 'ok' | 'warn' | 'danger' | 'critical';
  hint?: string; onClick?: () => void;
}) {
  const colors = {
    neutral: { text: isDark ? 'text-zinc-200' : 'text-gray-800', border: isDark ? 'border-zinc-700/40' : 'border-gray-200', bg: '' },
    ok:       { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'hover:bg-emerald-500/5' },
    warn:     { text: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'hover:bg-amber-500/5' },
    danger:   { text: 'text-orange-400',  border: 'border-orange-500/40',  bg: 'hover:bg-orange-500/5' },
    critical: { text: 'text-red-400',     border: 'border-red-500/40',     bg: 'hover:bg-red-500/10' },
  };
  const c = colors[severity];
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border ${c.border} ${isDark ? 'bg-zinc-900/60' : 'bg-white'} p-4 transition-all ${clickable ? `cursor-pointer ${c.bg} hover:scale-[1.02]` : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className={`text-xs uppercase tracking-wider font-semibold ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{label}</div>
        {clickable && <ChevronRight className={`w-3.5 h-3.5 ${isDark ? 'text-zinc-600' : 'text-gray-400'}`} />}
      </div>
      <div className={`text-2xl font-bold mt-1 ${c.text}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {hint && <div className={`text-[11px] mt-1.5 leading-snug ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{hint}</div>}
    </div>
  );
}

function MotivoChip({ motivo, color = 'amber' }: { motivo: string; color?: 'amber' | 'red' | 'purple' | 'blue' | 'emerald' }) {
  const map = {
    amber:   'bg-amber-500/20 text-amber-300 border-amber-500/30',
    red:     'bg-red-500/20 text-red-300 border-red-500/30',
    purple:  'bg-purple-500/20 text-purple-300 border-purple-500/30',
    blue:    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] border ${map[color]} whitespace-nowrap`}>{motivo}</span>;
}

function severityFor(motivo: string | null | undefined): 'amber' | 'red' | 'purple' | 'blue' {
  const m = (motivo || '').toLowerCase();
  if (m.includes('crítico') || m.includes('eliminada') || m.includes('inexistente')) return 'red';
  if (m.includes('invertido') || m.includes('desincron') || m.includes('=0') || m.includes('apartado')) return 'purple';
  if (m.includes('inactiva')) return 'blue';
  return 'amber';
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// =============================================================================
// Section heading helper
// =============================================================================
function SectionHeader({ title, hint, isDark }: { title: string; hint?: string; isDark: boolean }) {
  return (
    <div className="mb-3">
      <h3 className={`text-sm font-bold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>{title}</h3>
      {hint && <p className={`text-[11px] mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{hint}</p>}
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================
export function AuditoriaReservasTab({ isDark }: { isDark: boolean }) {
  const [subTab, setSubTab] = useState<SubTab>('resumen');
  const [search, setSearch] = useState('');

  const summaryQuery = useQuery({ queryKey: ['audit-reservas','summary'], queryFn: () => auditReservasService.getSummary() });

  const dupQuery     = useQuery({ queryKey: ['audit-reservas','duplicados'],          queryFn: auditReservasService.getDuplicados,          enabled: subTab === 'duplicados' });
  const huerQuery    = useQuery({ queryKey: ['audit-reservas','huerfanos'],           queryFn: auditReservasService.getHuerfanos,           enabled: subTab === 'huerfanos' });
  const catQuery     = useQuery({ queryKey: ['audit-reservas','por-catorcena'],       queryFn: auditReservasService.getPorCatorcena,        enabled: subTab === 'catorcena' });
  const cliQuery     = useQuery({ queryKey: ['audit-reservas','por-cliente'],         queryFn: auditReservasService.getPorCliente,          enabled: subTab === 'cliente' });
  const vendQuery    = useQuery({ queryKey: ['audit-reservas','por-vendedor'],        queryFn: auditReservasService.getPorVendedor,         enabled: subTab === 'vendedor' });
  const invDupQuery  = useQuery({ queryKey: ['audit-reservas','inv-duplicados'],      queryFn: auditReservasService.getInvDuplicados,       enabled: subTab === 'inv-duplicados' });
  const cliDesQuery  = useQuery({ queryKey: ['audit-reservas','cliente-desalineado'], queryFn: auditReservasService.getClienteDesalineado,  enabled: subTab === 'cliente-desalineado' });
  const statusQuery  = useQuery({ queryKey: ['audit-reservas','status-raro'],         queryFn: auditReservasService.getStatusRaro,          enabled: subTab === 'status-raro' });
  const invSucioQ    = useQuery({ queryKey: ['audit-reservas','inv-sucio'],           queryFn: auditReservasService.getInvSucio,            enabled: subTab === 'inv-sucio' });
  const rsvSuciaQ    = useQuery({ queryKey: ['audit-reservas','reservas-sucias'],     queryFn: auditReservasService.getReservasSucias,      enabled: subTab === 'reservas-sucias' });
  const crossFisQ    = useQuery({ queryKey: ['audit-reservas','cross-cam-fisico'],    queryFn: auditReservasService.getCrossCamFisico,      enabled: subTab === 'cross-cam-fisico' });
  const codReutQ     = useQuery({ queryKey: ['audit-reservas','cod-reutilizado'],     queryFn: auditReservasService.getCodReutilizado,      enabled: subTab === 'cod-reutilizado' });
  const apsQ         = useQuery({ queryKey: ['audit-reservas','aps-compartido'],      queryFn: auditReservasService.getApsCompartido,       enabled: subTab === 'aps-compartido' });
  const zombieQ      = useQuery({ queryKey: ['audit-reservas','zombies'],             queryFn: auditReservasService.getZombies,             enabled: subTab === 'zombies' });
  const eiDupQ       = useQuery({ queryKey: ['audit-reservas','ei-duplicado'],        queryFn: auditReservasService.getEiDuplicado,         enabled: subTab === 'ei-duplicado' });
  const marcaQ       = useQuery({ queryKey: ['audit-reservas','marca-clientes-dup'],  queryFn: auditReservasService.getMarcaClientesDup,    enabled: subTab === 'marca-clientes-dup' });

  // Filtros con buscador (cliente-side)
  const term = search.toLowerCase().trim();
  const filt = <T,>(list: T[] | undefined, getStr: (r: T) => string) =>
    term ? (list || []).filter(r => getStr(r).includes(term)) : (list || []);

  const dupFiltered     = useMemo(() => filt(dupQuery.data, r => `${r.codigo_unico||''} ${r.plaza||''} ${r.cliente||''} ${r.cam_nombre||''} ${r.articulo||''}`.toLowerCase()), [dupQuery.data, term]);
  const huerFiltered    = useMemo(() => filt(huerQuery.data, r => `${r.codigo_unico||''} ${r.plaza||''} ${r.cliente_nombre||''} ${r.propuesta_id_text||''} ${r.motivo}`.toLowerCase()), [huerQuery.data, term]);
  const cliFiltered     = useMemo(() => filt(cliQuery.data, r => `${r.razon_social||''} ${r.marca||''} ${r.asesor||''}`.toLowerCase()), [cliQuery.data, term]);
  const vendFiltered    = useMemo(() => filt(vendQuery.data, r => (r.asesor||'').toLowerCase()), [vendQuery.data, term]);
  const invDupFiltered  = useMemo(() => filt(invDupQuery.data, r => `${r.codigo||''} ${r.plaza||''} ${r.codigos_unicos||''} ${r.ubicaciones||''}`.toLowerCase()), [invDupQuery.data, term]);
  const cliDesFiltered  = useMemo(() => filt(cliDesQuery.data, r => `${r.cam_nombre||''} ${r.cli_razon_social||''} ${r.sol_razon_social||''} ${r.motivos}`.toLowerCase()), [cliDesQuery.data, term]);
  const statusFiltered  = useMemo(() => filt(statusQuery.data, r => `${r.cam_nombre||''} ${r.motivo||''}`.toLowerCase()), [statusQuery.data, term]);
  const invSucioFiltered= useMemo(() => filt(invSucioQ.data, r => `${r.codigo_unico||''} ${r.plaza||''} ${r.motivo}`.toLowerCase()), [invSucioQ.data, term]);
  const rsvSuciaFiltered= useMemo(() => filt(rsvSuciaQ.data, r => `${r.cam_nombre||''} ${r.estatus||''} ${r.motivo}`.toLowerCase()), [rsvSuciaQ.data, term]);
  const crossFisFiltered= useMemo(() => filt(crossFisQ.data, r => `${r.codigo||''} ${r.plaza||''} ${r.cams_nombres||''}`.toLowerCase()), [crossFisQ.data, term]);
  const codReutFiltered = useMemo(() => filt(codReutQ.data, r => `${r.codigo||''} ${r.plaza||''} ${r.codigos_unicos||''}`.toLowerCase()), [codReutQ.data, term]);
  const apsFiltered     = useMemo(() => filt(apsQ.data, r => `${r.APS||''} ${r.cams_nombres||''} ${r.clientes||''}`.toLowerCase()), [apsQ.data, term]);
  const zombieFiltered  = useMemo(() => filt(zombieQ.data, r => `${r.cam_nombre||''} ${r.cliente_nombre||''} ${r.articulo||''}`.toLowerCase()), [zombieQ.data, term]);
  const eiDupFiltered   = useMemo(() => filt(eiDupQ.data, r => `${r.codigo_unico||''} ${r.plaza||''}`.toLowerCase()), [eiDupQ.data, term]);
  const marcaFiltered   = useMemo(() => filt(marcaQ.data, r => `${r.marca||''} ${r.producto||''} ${r.razones_sociales||''}`.toLowerCase()), [marcaQ.data, term]);

  const kpis = summaryQuery.data?.kpis;

  // Goto helper
  const goto = (t: SubTab) => { setSubTab(t); setSearch(''); };

  // Tabs config — order matches resumen sections
  const tabs: { key: SubTab; label: string; icon: any; group: string }[] = [
    { key: 'resumen',             label: 'Resumen',                icon: Activity,       group: '' },
    { key: 'duplicados',          label: 'PATSA-style',            icon: Copy,           group: 'Duplicación' },
    { key: 'cross-cam-fisico',    label: 'Cross-cam físico',       icon: ArrowRightLeft, group: 'Duplicación' },
    { key: 'inv-duplicados',      label: 'Inv duplicados',         icon: Database,       group: 'Duplicación' },
    { key: 'cod-reutilizado',     label: 'Cod reutilizado',        icon: MapPin,         group: 'Duplicación' },
    { key: 'huerfanos',           label: 'Huérfanas',              icon: AlertTriangle,  group: 'Integridad' },
    { key: 'zombies',             label: 'Zombies (ei ausente)',   icon: Bug,            group: 'Integridad' },
    { key: 'reservas-sucias',     label: 'Reservas sucias',        icon: Trash2,         group: 'Integridad' },
    { key: 'ei-duplicado',        label: 'EI duplicado',           icon: Boxes,          group: 'Integridad' },
    { key: 'cliente-desalineado', label: 'Cliente desalineado',    icon: UserX,          group: 'Status' },
    { key: 'status-raro',         label: 'Status raro',            icon: Activity,       group: 'Status' },
    { key: 'inv-sucio',           label: 'Inv sucio',              icon: Trash2,         group: 'Catálogo' },
    { key: 'aps-compartido',      label: 'APS compartido',         icon: Tag,            group: 'APS' },
    { key: 'marca-clientes-dup',  label: 'Marca dup',              icon: Layers,         group: 'Clientes' },
    { key: 'catorcena',           label: 'Por catorcena',          icon: Calendar,       group: 'Agregados' },
    { key: 'cliente',             label: 'Por cliente',            icon: Building2,      group: 'Agregados' },
    { key: 'vendedor',            label: 'Por vendedor',           icon: Users,          group: 'Agregados' },
  ];

  return (
    <div className={`${isDark ? 'text-zinc-200' : 'text-gray-800'} space-y-6`}>
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Database className="w-6 h-6 text-violet-400" /> Auditoría de Reservas
        </h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-zinc-400' : 'text-gray-600'}`}>
          Panel SOLO-LECTURA con KPIs y tablas para detectar inconsistencias en reservas, inventarios, clientes y propuestas.
          Cada KPI te lleva a su tab con detalle. Datos validados contra producción.
        </p>
      </div>

      {/* Tabs nav */}
      <div className={`flex flex-wrap gap-1.5 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'} pb-2`}>
        {tabs.map(t => {
          const Icon = t.icon;
          const active = subTab === t.key;
          return (
            <button key={t.key} onClick={() => goto(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                active
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                  : isDark ? 'text-zinc-400 hover:bg-zinc-800/60' : 'text-gray-600 hover:bg-gray-100'
              }`}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Search (oculto en resumen) */}
      {subTab !== 'resumen' && subTab !== 'catorcena' && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-white border-gray-200'}`}>
          <Search className={`w-4 h-4 ${isDark ? 'text-zinc-500' : 'text-gray-400'}`} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtrar..."
            className={`flex-1 bg-transparent outline-none text-sm ${isDark ? 'text-zinc-200 placeholder-zinc-600' : 'text-gray-800 placeholder-gray-400'}`} />
        </div>
      )}

      {/* ================================================================== */}
      {/* RESUMEN — KPIs comprehensivos clickables */}
      {/* ================================================================== */}
      {subTab === 'resumen' && (
        <div className="space-y-6">
          {summaryQuery.isLoading && <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Cargando KPIs...</div>}
          {summaryQuery.isError && <div className="text-red-400 text-sm">Error al cargar resumen.</div>}
          {kpis && (
            <>
              {/* Generales */}
              <div>
                <SectionHeader title="Resumen general" isDark={isDark} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard isDark={isDark} label="Reservas activas"      value={kpis.total_reservas}      severity="neutral" hint="Total de reservas con deleted_at NULL" />
                  <KpiCard isDark={isDark} label="Catorcenas activas"    value={kpis.catorcenas_activas}  severity="neutral" hint="DISTINCT sc.inicio_periodo" onClick={() => goto('catorcena')} />
                  <KpiCard isDark={isDark} label="Total inventarios"     value={kpis.total_inventarios}   severity="neutral" hint="Filas en inventarios" />
                </div>
              </div>

              {/* Duplicación */}
              <div>
                <SectionHeader title="Duplicación de reservas / inventario" isDark={isDark} hint="Los bugs más graves: misma cara reservada 2 veces" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard isDark={isDark} label="PATSA-style"        value={kpis.patsa_style}      severity={kpis.patsa_style > 0 ? 'critical' : 'ok'} hint="Mismo (sc + inv) 2+ veces — bug doble click" onClick={() => goto('duplicados')} />
                  <KpiCard isDark={isDark} label="Cross-cam físico"   value={kpis.cross_cam_fisico} severity={kpis.cross_cam_fisico > 0 ? 'critical' : 'ok'} hint="2 cams peleando misma cara por inv dup" onClick={() => goto('cross-cam-fisico')} />
                  <KpiCard isDark={isDark} label="Inv duplicados"     value={kpis.inv_duplicados}   severity={kpis.inv_duplicados > 0 ? 'danger' : 'ok'} hint="Mismo parabús cargado 2+ veces" onClick={() => goto('inv-duplicados')} />
                  <KpiCard isDark={isDark} label="Cod reutilizado"    value={kpis.cod_reutilizado}  severity={kpis.cod_reutilizado > 0 ? 'warn' : 'ok'} hint="Mismo codigo+cara+plaza con coords distintas" onClick={() => goto('cod-reutilizado')} />
                </div>
              </div>

              {/* Integridad */}
              <div>
                <SectionHeader title="Integridad referencial" isDark={isDark} hint="Reservas apuntando a registros que ya no existen o son inválidos" />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <KpiCard isDark={isDark} label="Huérfanas"           value={kpis.huerfanas}    severity={kpis.huerfanas > 100 ? 'danger' : kpis.huerfanas > 0 ? 'warn' : 'ok'} hint="Sin sc/propuesta válida" onClick={() => goto('huerfanos')} />
                  <KpiCard isDark={isDark} label="Zombies (EI)"        value={kpis.zombies_ei}   severity={kpis.zombies_ei > 100 ? 'danger' : kpis.zombies_ei > 0 ? 'warn' : 'ok'} hint="espacio_inventario inexistente" onClick={() => goto('zombies')} />
                  <KpiCard isDark={isDark} label="Calendario invertido" value={kpis.cal_invertido} severity={kpis.cal_invertido > 0 ? 'warn' : 'ok'} hint="fecha_fin < fecha_inicio" onClick={() => goto('reservas-sucias')} />
                  <KpiCard isDark={isDark} label="calendario_id = 0"   value={kpis.cal_cero}     severity={kpis.cal_cero > 0 ? 'warn' : 'ok'} hint="Reservas sin calendario asignado" onClick={() => goto('reservas-sucias')} />
                  <KpiCard isDark={isDark} label="EI duplicado"        value={kpis.ei_duplicado} severity={kpis.ei_duplicado > 0 ? 'warn' : 'ok'} hint="(inv + numero_espacio) repetido" onClick={() => goto('ei-duplicado')} />
                </div>
              </div>

              {/* Status */}
              <div>
                <SectionHeader title="Consistencia de status / clientes" isDark={isDark} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <KpiCard isDark={isDark} label="Cliente desalineado"          value={kpis.cliente_desalineado}        severity={kpis.cliente_desalineado > 0 ? 'danger' : 'ok'} hint="sol/prop/cam con cliente_id distinto" onClick={() => goto('cliente-desalineado')} />
                  <KpiCard isDark={isDark} label="Cam inactiva con reservas"    value={kpis.cam_inactiva_con_reservas}  severity={kpis.cam_inactiva_con_reservas > 0 ? 'warn' : 'ok'} hint="campania.status='inactiva' pero con reservas activas" onClick={() => goto('status-raro')} />
                </div>
              </div>

              {/* Inv sucio + APS */}
              <div>
                <SectionHeader title="Limpieza de catálogos" isDark={isDark} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiCard isDark={isDark} label="Inv sucio"          value={kpis.inv_sucio}          severity={kpis.inv_sucio > 0 ? 'warn' : 'ok'} hint="codigo_unico con espacio/coma, typo Contaflujo" onClick={() => goto('inv-sucio')} />
                  <KpiCard isDark={isDark} label="APS multi-cam"      value={kpis.aps_multi_cam}      severity={kpis.aps_multi_cam > 0 ? 'warn' : 'ok'} hint="Mismo APS en cams distintas" onClick={() => goto('aps-compartido')} />
                  <KpiCard isDark={isDark} label="APS multi-cliente"  value={kpis.aps_multi_cliente}  severity={kpis.aps_multi_cliente > 0 ? 'warn' : 'ok'} hint="Mismo APS en clientes distintos" onClick={() => goto('aps-compartido')} />
                  <KpiCard isDark={isDark} label="Marca dup"          value={kpis.marca_clientes_dup} severity={kpis.marca_clientes_dup > 0 ? 'warn' : 'ok'} hint="Misma marca/producto con varios card_code" onClick={() => goto('marca-clientes-dup')} />
                </div>
              </div>

              {/* Glosario */}
              <div className={`rounded-xl border ${isDark ? 'border-zinc-700/40 bg-zinc-900/40' : 'border-gray-200 bg-gray-50'} p-4`}>
                <SectionHeader title="Glosario de KPIs" isDark={isDark} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div><span className="text-violet-400 font-semibold">PATSA-style:</span> Misma reserva (mismo sc + mismo inv) creada 2+ veces. Causa típica: doble click o re-toggle en UI.</div>
                  <div><span className="text-violet-400 font-semibold">Cross-cam físico:</span> 2+ cams reservaron la MISMA cara física, pero en BD aparece con distintos inv_id porque el inv está duplicado.</div>
                  <div><span className="text-violet-400 font-semibold">Inv duplicados:</span> Filas en inventarios con mismo codigo+cara+plaza+lat+long. Mismo parabús cargado dos veces.</div>
                  <div><span className="text-violet-400 font-semibold">Cod reutilizado:</span> Mismo codigo+cara+plaza con coords distintas. A veces legítimo (sufijo "2") y a veces data sucia.</div>
                  <div><span className="text-violet-400 font-semibold">Huérfanas:</span> Reserva apunta a solicitudCaras o propuesta que ya no existe o fue eliminada.</div>
                  <div><span className="text-violet-400 font-semibold">Zombies:</span> r.inventario_id apunta a un espacio_inventario.id que no existe.</div>
                  <div><span className="text-violet-400 font-semibold">Calendario invertido / =0:</span> Reservas con calendario fecha_fin &lt; fecha_inicio, o calendario_id=0, o apuntando a calendario inexistente.</div>
                  <div><span className="text-violet-400 font-semibold">EI duplicado:</span> En espacio_inventario hay 2+ filas con mismo (inventario_id + numero_espacio).</div>
                  <div><span className="text-violet-400 font-semibold">Cliente desalineado:</span> Solicitud, propuesta y campaña no apuntan al mismo cliente_id (caso MOTOROLA 80404).</div>
                  <div><span className="text-violet-400 font-semibold">Cam inactiva con reservas:</span> campania.status='inactiva' pero tiene reservas en estatus bloqueante.</div>
                  <div><span className="text-violet-400 font-semibold">Inv sucio:</span> codigo_unico con espacios extras, comas, typo 'Contaflujo' o plaza inválida.</div>
                  <div><span className="text-violet-400 font-semibold">APS compartido:</span> Mismo APS aparece en cams o clientes distintos. CRÍTICO si combina 2+ cams + 2+ clientes.</div>
                  <div><span className="text-violet-400 font-semibold">Marca dup:</span> Misma T2_U_Marca + T2_U_Producto registrada con varios card_code (varios clientes).</div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* PATSA-style */}
      {/* ================================================================== */}
      {subTab === 'duplicados' && (
        <ResultTable
          isDark={isDark} query={dupQuery} data={dupFiltered}
          title="PATSA-style — mismo (sc + inv) repetido"
          subtitle="Mismo solicitudCaras + mismo inventario_id 2+ veces en misma catorcena. Es bug de doble click o re-toggle."
          columns={[
            { h: 'cód único', cell: r => r.codigo_unico || '-' },
            { h: 'plaza', cell: r => r.plaza || '-' },
            { h: 'cara', cell: r => r.tipo_de_cara || '-' },
            { h: 'catorcena', cell: r => `${formatDate(r.fecha_inicio)} → ${formatDate(r.fecha_fin)}` },
            { h: 'veces', cell: r => <span className="text-red-400 font-bold">{r.veces}</span> },
            { h: 'cam', cell: r => r.cam_nombre ? `#${r.cam_id} ${r.cam_nombre}` : `#${r.cam_id || '-'}` },
            { h: 'cliente', cell: r => r.cliente || '-' },
            { h: 'rv_ids', cell: r => <span className="text-[10px] font-mono">{r.rv_ids}</span> },
          ]}
        />
      )}

      {/* CROSS-CAM FÍSICO */}
      {subTab === 'cross-cam-fisico' && (
        <ResultTable
          isDark={isDark} query={crossFisQ} data={crossFisFiltered}
          title="Cross-cam físico"
          subtitle="2+ cams distintas reservaron el mismo parabús físico (codigo+cara+plaza+lat+long) — confusión por inv duplicado."
          columns={[
            { h: 'código', cell: r => r.codigo || '-' },
            { h: 'cara', cell: r => r.cara || '-' },
            { h: 'plaza', cell: r => r.plaza || '-' },
            { h: 'coords', cell: r => <span className="text-[10px] font-mono">{r.latitud?.toFixed(4)}, {r.longitud?.toFixed(4)}</span> },
            { h: 'catorcena', cell: r => formatDate(r.fecha_inicio) },
            { h: 'invs', cell: r => <span className="text-amber-400 font-bold">{r.n_inv_ids}</span> },
            { h: 'cams', cell: r => <span className="text-red-400 font-bold">{r.n_cams}</span> },
            { h: 'inv_ids', cell: r => <span className="text-[10px] font-mono">{r.inv_ids}</span> },
            { h: 'cams_ids', cell: r => <span className="text-[10px] font-mono">{r.cams_ids}</span> },
          ]}
        />
      )}

      {/* INV DUPLICADOS */}
      {subTab === 'inv-duplicados' && (
        <ResultTable
          isDark={isDark} query={invDupQuery} data={invDupFiltered}
          title="Inv duplicados físicos"
          subtitle="Mismo (codigo+cara+plaza+lat+long) cargado 2+ veces en inventarios. El parabús es físicamente el mismo."
          columns={[
            { h: 'código', cell: r => r.codigo || '-' },
            { h: 'cara', cell: r => r.cara || '-' },
            { h: 'plaza', cell: r => r.plaza || '-' },
            { h: 'coords', cell: r => <span className="text-[10px] font-mono">{r.latitud?.toFixed(4)}, {r.longitud?.toFixed(4)}</span> },
            { h: 'n_inv', cell: r => <span className="text-red-400 font-bold">{r.n_inv}</span> },
            { h: 'inv_ids', cell: r => <span className="text-[10px] font-mono">{r.inv_ids}</span> },
            { h: 'cods únicos', cell: r => <span className="text-[10px]">{r.codigos_unicos}</span> },
            { h: 'reservas', cell: r => r.reservas_totales },
          ]}
        />
      )}

      {/* COD REUTILIZADO */}
      {subTab === 'cod-reutilizado' && (
        <ResultTable
          isDark={isDark} query={codReutQ} data={codReutFiltered}
          title="Cod reutilizado"
          subtitle="Mismo (codigo+cara+plaza) con lat/long distintas. A veces legítimo (sufijo '2' en codigo_unico), a veces error."
          columns={[
            { h: 'código', cell: r => r.codigo || '-' },
            { h: 'cara', cell: r => r.cara || '-' },
            { h: 'plaza', cell: r => r.plaza || '-' },
            { h: 'ubicaciones', cell: r => <span className="text-amber-400 font-bold">{r.n_ubicaciones}</span> },
            { h: 'inv_ids', cell: r => <span className="text-[10px] font-mono">{r.inv_ids}</span> },
            { h: 'cods únicos', cell: r => <span className="text-[10px]">{r.codigos_unicos}</span> },
            { h: 'coords', cell: r => <span className="text-[10px] font-mono">{r.coords}</span> },
          ]}
        />
      )}

      {/* HUÉRFANAS */}
      {subTab === 'huerfanos' && (
        <ResultTable
          isDark={isDark} query={huerQuery} data={huerFiltered}
          title="Reservas huérfanas"
          subtitle="Reservas con solicitudCaras o propuesta inexistente / eliminada."
          columns={[
            { h: 'rv_id', cell: r => `#${r.reserva_id}` },
            { h: 'inv_id', cell: r => r.inventario_id },
            { h: 'cód único', cell: r => r.codigo_unico || '-' },
            { h: 'plaza', cell: r => r.plaza || '-' },
            { h: 'cliente', cell: r => r.cliente_nombre || '-' },
            { h: 'propuesta', cell: r => r.propuesta_id_text || '-' },
            { h: 'status', cell: r => r.propuesta_status || '-' },
            { h: 'motivo', cell: r => <MotivoChip motivo={r.motivo} color={severityFor(r.motivo)} /> },
          ]}
        />
      )}

      {/* ZOMBIES */}
      {subTab === 'zombies' && (
        <ResultTable
          isDark={isDark} query={zombieQ} data={zombieFiltered}
          title="Zombies — reservas con espacio_inventario inexistente"
          subtitle="r.inventario_id apunta a un espacio_inventario.id que NO existe en BD."
          columns={[
            { h: 'rv_id', cell: r => `#${r.reserva_id}` },
            { h: 'ei_id apuntado', cell: r => <span className="text-red-400 font-mono">{r.ei_id_apuntado}</span> },
            { h: 'cliente', cell: r => r.cliente_nombre || '-' },
            { h: 'cam', cell: r => r.cam_nombre ? `#${r.cam_id} ${r.cam_nombre}` : `#${r.cam_id || '-'}` },
            { h: 'artículo', cell: r => r.articulo || '-' },
            { h: 'estatus', cell: r => r.estatus || '-' },
            { h: 'APS', cell: r => r.APS || '-' },
            { h: 'catorcena', cell: r => formatDate(r.fecha_inicio) },
          ]}
        />
      )}

      {/* RESERVAS SUCIAS */}
      {subTab === 'reservas-sucias' && (
        <ResultTable
          isDark={isDark} query={rsvSuciaQ} data={rsvSuciaFiltered}
          title="Reservas sucias"
          subtitle="calendario_id=0, calendario inexistente, invertido, desincronizado, o estatus 'Apartado'."
          columns={[
            { h: 'rv_id', cell: r => `#${r.reserva_id}` },
            { h: 'inv_id', cell: r => r.inventario_id },
            { h: 'cam', cell: r => r.cam_nombre || '-' },
            { h: 'sc_inicio', cell: r => formatDate(r.sc_inicio) },
            { h: 'cal_inicio', cell: r => formatDate(r.cal_inicio) },
            { h: 'cal_fin', cell: r => formatDate(r.cal_fin) },
            { h: 'estatus', cell: r => r.estatus || '-' },
            { h: 'motivo', cell: r => <MotivoChip motivo={r.motivo} color={severityFor(r.motivo)} /> },
          ]}
        />
      )}

      {/* EI DUPLICADO */}
      {subTab === 'ei-duplicado' && (
        <ResultTable
          isDark={isDark} query={eiDupQ} data={eiDupFiltered}
          title="Espacio_inventario duplicado"
          subtitle="2+ filas en espacio_inventario con mismo (inventario_id + numero_espacio)."
          columns={[
            { h: 'inv_id', cell: r => r.inventario_id },
            { h: 'cód único', cell: r => r.codigo_unico || '-' },
            { h: 'plaza', cell: r => r.plaza || '-' },
            { h: 'trad/dig', cell: r => r.tradicional_digital || '-' },
            { h: 'numero_espacio', cell: r => r.numero_espacio },
            { h: 'n_rows', cell: r => <span className="text-red-400 font-bold">{r.n_rows}</span> },
            { h: 'ei_ids', cell: r => <span className="text-[10px] font-mono">{r.ei_ids}</span> },
          ]}
        />
      )}

      {/* CLIENTE DESALINEADO */}
      {subTab === 'cliente-desalineado' && (
        <ResultTable
          isDark={isDark} query={cliDesQuery} data={cliDesFiltered}
          title="Cliente desalineado"
          subtitle="Solicitud, propuesta y campaña con cliente_id distinto o card_code/CUIC desfasado."
          columns={[
            { h: 'prop_id', cell: r => `#${r.propuesta_id}` },
            { h: 'cam', cell: r => r.cam_nombre ? `#${r.cam_id} ${r.cam_nombre}` : `#${r.cam_id || '-'}` },
            { h: 'sol cliente_id', cell: r => r.solicitud_cliente_id ?? '-' },
            { h: 'prop cliente_id', cell: r => r.propuesta_cliente_id ?? '-' },
            { h: 'cam cliente_id', cell: r => r.cam_cliente_id ?? '-' },
            { h: 'sol card_code', cell: r => r.sol_card_code || '-' },
            { h: 'cli card_code', cell: r => r.cli_card_code || '-' },
            { h: 'cli razón social', cell: r => r.cli_razon_social || '-' },
            { h: 'motivos', cell: r => <span className="text-[10px]">{r.motivos}</span> },
          ]}
        />
      )}

      {/* STATUS RARO */}
      {subTab === 'status-raro' && (
        <ResultTable
          isDark={isDark} query={statusQuery} data={statusFiltered}
          title="Campañas con status raro"
          subtitle="Campañas inactivas pero con reservas en estatus bloqueante. Secuelas del bug calendario_id sucio."
          columns={[
            { h: 'cam_id', cell: r => `#${r.cam_id}` },
            { h: 'nombre', cell: r => r.cam_nombre || '-' },
            { h: 'cam status', cell: r => r.cam_status || '-' },
            { h: 'prop status', cell: r => r.prop_status || '-' },
            { h: 'reservas activas', cell: r => <span className="text-red-400 font-bold">{r.reservas_activas}</span> },
            { h: 'motivo', cell: r => <MotivoChip motivo={r.motivo} color="blue" /> },
          ]}
        />
      )}

      {/* INV SUCIO */}
      {subTab === 'inv-sucio' && (
        <ResultTable
          isDark={isDark} query={invSucioQ} data={invSucioFiltered}
          title="Inventario sucio"
          subtitle="codigo_unico con espacio extra, coma, typo 'Contaflujo' (sin r), o plaza inválida (ciudad)."
          columns={[
            { h: 'inv_id', cell: r => `#${r.inv_id}` },
            { h: 'cód único', cell: r => <span className="font-mono">{r.codigo_unico || '-'}</span> },
            { h: 'código', cell: r => r.codigo || '-' },
            { h: 'cara', cell: r => r.tipo_de_cara || '-' },
            { h: 'plaza', cell: r => r.plaza || '-' },
            { h: 'mueble', cell: r => r.mueble || '-' },
            { h: 'motivo', cell: r => <MotivoChip motivo={r.motivo} color="purple" /> },
          ]}
        />
      )}

      {/* APS COMPARTIDO */}
      {subTab === 'aps-compartido' && (
        <ResultTable
          isDark={isDark} query={apsQ} data={apsFiltered}
          title="APS compartido"
          subtitle="Mismo APS en cams o clientes distintos. CRÍTICO cuando combina 2+ cams y 2+ clientes."
          columns={[
            { h: 'APS', cell: r => <span className="font-mono">{r.APS}</span> },
            { h: 'reservas', cell: r => r.n_reservas },
            { h: 'cams', cell: r => <span className={r.n_cams > 1 ? 'text-amber-400 font-bold' : ''}>{r.n_cams}</span> },
            { h: 'clientes', cell: r => <span className={r.n_clientes > 1 ? 'text-red-400 font-bold' : ''}>{r.n_clientes}</span> },
            { h: 'cams nombres', cell: r => <span className="text-[10px]">{r.cams_nombres}</span> },
            { h: 'clientes nombres', cell: r => <span className="text-[10px]">{r.clientes}</span> },
            { h: 'severidad', cell: r => <MotivoChip motivo={r.severidad} color={r.severidad.startsWith('CRÍTICO') ? 'red' : 'amber'} /> },
          ]}
        />
      )}

      {/* MARCA CLIENTES DUP */}
      {subTab === 'marca-clientes-dup' && (
        <ResultTable
          isDark={isDark} query={marcaQ} data={marcaFiltered}
          title="Marca con clientes duplicados"
          subtitle="Misma T2_U_Marca + T2_U_Producto registrada en varios card_code (varios clientes con misma marca)."
          columns={[
            { h: 'marca', cell: r => r.marca },
            { h: 'producto', cell: r => r.producto || '-' },
            { h: 'n_clientes', cell: r => <span className="text-amber-400 font-bold">{r.n_clientes}</span> },
            { h: 'card_codes', cell: r => <span className="text-[10px] font-mono">{r.card_codes}</span> },
            { h: 'razones sociales', cell: r => <span className="text-[10px]">{r.razones_sociales}</span> },
            { h: 'sap_dbs', cell: r => <span className="text-[10px]">{r.sap_dbs}</span> },
          ]}
        />
      )}

      {/* POR CATORCENA */}
      {subTab === 'catorcena' && (
        <ResultTable
          isDark={isDark} query={catQuery} data={catQuery.data || []}
          title="Reservas por catorcena"
          subtitle="Agregados por sc.inicio_periodo. La columna 'grupos_duplicados' indica cuántas (sc+inv) tienen 2+ veces."
          columns={[
            { h: 'inicio', cell: r => formatDate(r.fecha_inicio) },
            { h: 'fin', cell: r => formatDate(r.fecha_fin) },
            { h: 'total reservas', cell: r => r.total_reservas.toLocaleString() },
            { h: 'inv únicos', cell: r => r.inventarios_unicos.toLocaleString() },
            { h: 'clientes', cell: r => r.clientes_unicos.toLocaleString() },
            { h: 'propuestas', cell: r => r.propuestas_unicas.toLocaleString() },
            { h: 'grupos dup', cell: r => <span className={r.grupos_duplicados > 0 ? 'text-red-400 font-bold' : ''}>{r.grupos_duplicados}</span> },
          ]}
        />
      )}

      {/* POR CLIENTE */}
      {subTab === 'cliente' && (
        <ResultTable
          isDark={isDark} query={cliQuery} data={cliFiltered}
          title="Reservas por cliente"
          subtitle="Top clientes por volumen de reservas."
          columns={[
            { h: 'cliente_id', cell: r => `#${r.cliente_id}` },
            { h: 'razón social', cell: r => r.razon_social || '-' },
            { h: 'marca', cell: r => r.marca || '-' },
            { h: 'asesor', cell: r => r.asesor || '-' },
            { h: 'total reservas', cell: r => r.total_reservas.toLocaleString() },
            { h: 'inv únicos', cell: r => r.inventarios_unicos.toLocaleString() },
            { h: 'propuestas', cell: r => r.propuestas_unicas.toLocaleString() },
            { h: 'campañas', cell: r => r.campanias_unicas.toLocaleString() },
          ]}
        />
      )}

      {/* POR VENDEDOR */}
      {subTab === 'vendedor' && (
        <ResultTable
          isDark={isDark} query={vendQuery} data={vendFiltered}
          title="Reservas por vendedor (asesor)"
          subtitle="Asesor tomado de cliente.T0_U_Asesor."
          columns={[
            { h: 'asesor', cell: r => r.asesor },
            { h: 'total reservas', cell: r => r.total_reservas.toLocaleString() },
            { h: 'clientes', cell: r => r.clientes_unicos.toLocaleString() },
            { h: 'propuestas', cell: r => r.propuestas_unicas.toLocaleString() },
            { h: 'campañas', cell: r => r.campanias_unicas.toLocaleString() },
          ]}
        />
      )}
    </div>
  );
}

// =============================================================================
// ResultTable — reusable
// =============================================================================
type Col<T> = { h: string; cell: (r: T) => React.ReactNode };

function ResultTable<T>({
  isDark, query, data, title, subtitle, columns,
}: {
  isDark: boolean; query: { isLoading: boolean; isError: boolean; error?: any };
  data: T[]; title: string; subtitle?: string; columns: Col<T>[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {subtitle && <p className={`text-xs mt-0.5 ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{subtitle}</p>}
      </div>

      {query.isLoading && <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Cargando...</div>}
      {query.isError && <div className="text-red-400 text-sm">Error al cargar datos.</div>}

      {!query.isLoading && !query.isError && data.length === 0 && (
        <div className={`p-6 rounded-xl border text-center text-sm ${isDark ? 'border-zinc-800 bg-zinc-900/40 text-zinc-500' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
          Sin resultados.
        </div>
      )}

      {!query.isLoading && data.length > 0 && (
        <>
          <div className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-500'}`}>{data.length.toLocaleString()} fila{data.length === 1 ? '' : 's'}</div>
          <div className={`rounded-xl border overflow-auto ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
            <table className="min-w-full text-xs">
              <thead className={`${isDark ? 'bg-zinc-900/60 text-zinc-400' : 'bg-gray-50 text-gray-600'}`}>
                <tr>{columns.map((c, i) => <th key={i} className="text-left px-3 py-2 font-semibold uppercase tracking-wider whitespace-nowrap">{c.h}</th>)}</tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-gray-100'}`}>
                {data.map((r, idx) => (
                  <tr key={idx} className={isDark ? 'hover:bg-zinc-900/40' : 'hover:bg-gray-50'}>
                    {columns.map((c, i) => <td key={i} className="px-3 py-2 align-top whitespace-nowrap">{c.cell(r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
