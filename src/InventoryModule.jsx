import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, RefreshCw, CheckCircle2, Plus, Trash2, ChevronLeft, Calendar as CalendarIcon, Clock, Package, X, Check } from 'lucide-react';

const INVENTORY_CSV_URL = 'https://docs.google.com/spreadsheets/d/19tG5yfoz2CIFsQg0umLJdB2w-zSrB8jl4RY6qyeS-Nc/export?format=csv&id=19tG5yfoz2CIFsQg0umLJdB2w-zSrB8jl4RY6qyeS-Nc&gid=1970976422';
const MATERIALES_CSV_URL = 'https://docs.google.com/spreadsheets/d/19tG5yfoz2CIFsQg0umLJdB2w-zSrB8jl4RY6qyeS-Nc/gviz/tq?tqx=out:csv&sheet=Materiales';
const REGISTRO_CSV_URL = 'https://docs.google.com/spreadsheets/d/19tG5yfoz2CIFsQg0umLJdB2w-zSrB8jl4RY6qyeS-Nc/gviz/tq?tqx=out:csv&sheet=Registro';

export default function InventoryModule({ loggedUser, station, API_URL, onBack, hasMultipleModules }) {
  const [view, setView] = useState('history'); // 'history' | 'form'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [materiales, setMateriales] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [historialCargas, setHistorialCargas] = useState([]);

  // Checking local draft
  const [hasDraft, setHasDraft] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [inventoryRawInfo, setInventoryRawInfo] = useState([]);
  const [selectedCarga, setSelectedCarga] = useState(null);

  const loadData = async (shouldRestoreDraft = true) => {
    setLoading(true);
    setError('');

    try {
      const [invRes, matsRes, regRes] = await Promise.all([
        fetch(INVENTORY_CSV_URL),
        fetch(MATERIALES_CSV_URL),
        fetch(REGISTRO_CSV_URL)
      ]);

      if (!invRes.ok || !matsRes.ok || !regRes.ok) throw new Error('Error al conectar con la planilla de datos');

      const invText = await invRes.text();
      const matsText = await matsRes.text();
      const regText = await regRes.text();

      // --- 1. Parsear Materiales Constantes ---
      let rawMats = matsText.split('\n')
        .map(l => l.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
        .filter(Boolean);

      // Limpiar el encabezado (Fila 1) tal cual lo solicitó el usuario
      if (rawMats.length > 0) {
        rawMats.shift();
      }

      // Evitar duplicados
      const uniqueTipos = [...new Set(rawMats)];

      // --- 2. Parsear Inventario para últimos registros e Historial ---
      const lines = invText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsedData = lines.slice(1).reduce((acc, line) => {
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => {
          let val = c.trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          return val;
        });

        if (cells.length > 4) {
          acc.push({
            id: cells[0],
            fecha: cells[1],
            usuario: cells[2],
            estacion: cells[3],
            tipo: cells[4],
            unidad: cells[5],
            cantidad: cells[6],
            largo: cells[7],
            ancho: cells[8],
          });
        }
        return acc;
      }, []);
      setInventoryRawInfo(parsedData);

      // -- 3. Parsear Registro para Historial (ya NO del inventario) --
      const regLines = regText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsedRegistro = regLines.slice(1).map((line, customKey) => {
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => {
          let val = c.trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          return val;
        });
        return {
          id: cells[0] || `tmp-${customKey}`,    // ID Carga
          fecha: cells[1] || '',                 // Fecha
          usuario: cells[2] || '',               // Usuario
          estacion: cells[3] || '',              // Estacion
          estado: cells[4] || 'Completo',        // Estado
          itemsDesc: cells[5] || ''              // Observaciones
        };
      });

      // Filtrar solo las filas que tengan ID numérico válido para historial
      const validCargas = parsedRegistro.filter(r => !isNaN(parseInt(r.id)));

      // Ordenar descendente según ID numérico
      validCargas.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      setHistorialCargas(validCargas);

      // Obtener la última carga de cada tipo ("traerte las ultimas cargas registradas")
      const lastEnterasMap = {};
      parsedData.forEach(row => {
        const t = row.tipo;
        if (!t) return;
        if (row.unidad === 'Unidad') {
          lastEnterasMap[t] = row.cantidad || '';
        }
      });

      // Crear el array base usando la lista Fija de materiales pre-cargando la última cantidad
      let matsArray = uniqueTipos.map(t => ({
        tipo: t,
        enteras: lastEnterasMap[t] || '',
        recortes: [],
        hasChanges: false
      }));

      // Load local draft if exists to overwrite enteras and recortes
      const savedDraft = localStorage.getItem('inventoryDraft');
      if (shouldRestoreDraft && savedDraft) {
        try {
          const draftObj = JSON.parse(savedDraft);
          matsArray = matsArray.map(mat => {
            const draftMat = draftObj.find(d => d.tipo === mat.tipo);
            if (draftMat) return draftMat;
            return mat;
          });
          // append any new manual ones they added inside the draft
          const newMats = draftObj.filter(draftMat => !matsArray.find(m => m.tipo === draftMat.tipo));
          matsArray = [...newMats, ...matsArray];
        } catch (e) {
          console.error("Error reading draft", e);
        }
      }

      setHasDraft(!!savedDraft);
      setMateriales(matsArray);

    } catch (err) {
      console.error(err);
      setError('Error al cargar datos de inventario. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line
  }, []);

  const isThisWeek = (dateStr) => {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length < 3) return false;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2].split(' ')[0], 10);

    const d = new Date(year, month, day);
    const now = new Date();
    const currentDay = now.getDay() === 0 ? 7 : now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - currentDay + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    return d >= startOfWeek;
  };

  const weeklyCompleted = !hasDraft && historialCargas.length > 0 && isThisWeek(historialCargas[0]?.fecha);

  // --- ACTIONS FOR FORM ---
  const handleEnterasChange = (index, val) => {
    const updated = [...materiales];
    updated[index].enteras = val;
    updated[index].hasChanges = true;
    setMateriales(updated);
  };

  const addRecorte = (index) => {
    const updated = [...materiales];
    updated[index].recortes.push({ cantidad: '', largo: '', ancho: '', obs: '', confirmed: false });
    updated[index].hasChanges = true;
    setMateriales(updated);
  };

  const updateRecorte = (matIndex, recIndex, field, val) => {
    const updated = [...materiales];
    updated[matIndex].recortes[recIndex][field] = val;
    updated[matIndex].hasChanges = true;
    setMateriales(updated);
  };

  const removeRecorte = (matIndex, recIndex) => {
    const updated = [...materiales];
    updated[matIndex].recortes.splice(recIndex, 1);
    updated[matIndex].hasChanges = true;
    setMateriales(updated);
  };

  // Remove unused functions related to NUEVO MATERIAL since requirement changed
  // (We'll just omit them from being used, though you can delete them if desired)

  // Manual save current state to draft
  const handleSaveDraft = () => {
    localStorage.setItem('inventoryDraft', JSON.stringify(materiales));
    setHasDraft(true);
    setMsg({ type: 'success', text: 'Progreso guardado localmente.' });
    setTimeout(() => setView('history'), 500);
  };

  const clearDraft = () => {
    localStorage.removeItem('inventoryDraft');
    setHasDraft(false);
  };

  // Cancelar (discards current unsaved changes, returns to history)
  const handleCancelar = () => {
    if (!window.confirm('¿Estás seguro de cancelar? Se perderán todos los datos no guardados en el borrador.')) return;
    setAttemptedSubmit(false);
    loadData(true); // reload to erase unsaved state, but read draft if any
    setView('history');
  };

  const handleFinalize = async () => {
    setAttemptedSubmit(true);
    if (!API_URL) {
      setMsg({ type: 'error', text: 'Error: Falta configurar el INVENTORY_API_URL en App.jsx' });
      return;
    }

    setMsg({ type: '', text: '' });

    // 1. Validar faltantes de stock entero
    const incompletos = materiales.filter(mat => mat.enteras === '');
    if (incompletos.length > 0) {
      setMsg({ type: 'error', text: `Falta completar el stock de ${incompletos.length} materiales. Todos los campos de 'Enteras' son obligatorios.` });
      return;
    }

    // 2. Validar recortes incompletos
    let recortesIncompletos = false;
    let recortesSinConfirmar = false;
    materiales.forEach(mat => {
      mat.recortes.forEach(rec => {
        if (!rec.cantidad || !rec.largo || !rec.ancho) {
          recortesIncompletos = true;
        }
        if (!rec.confirmed) {
          recortesSinConfirmar = true;
        }
      });
    });

    if (recortesIncompletos) {
      setMsg({ type: 'error', text: `Hay recortes iniciados que están incompletos. Para agregar un recorte es obligatorio la cantidad y las dos medidas.` });
      return;
    }

    if (recortesSinConfirmar) {
      setMsg({ type: 'error', text: `Tienes recortes sin confirmar. Debes hacer clic en 'Agregar' (check verde) en tus recortes para poder finalizar.` });
      return;
    }

    if (!window.confirm('¿Confirmas que deseas enviar el formulario definitivo?\nUna vez enviado no podrás editarlo.')) return;

    // Recolectar TODO el inventario
    const itemsToSave = [];

    materiales.forEach(mat => {
      if (mat.enteras !== '') {
        itemsToSave.push({
          tipo: mat.tipo,
          unidad: 'Unidad',
          cantidad: mat.enteras,
          largo: '-',
          ancho: '-',
          observaciones: '' // Solo se carga lo que ponga el usuario
        });
      }

      mat.recortes.forEach(rec => {
        itemsToSave.push({
          tipo: mat.tipo,
          unidad: 'Recorte',
          cantidad: rec.cantidad,
          largo: rec.largo,
          ancho: rec.ancho,
          observaciones: rec.obs || ''
        });
      });
    });

    if (itemsToSave.length === 0) {
      setMsg({ type: 'error', text: 'El formulario está vacío. No hay nada para enviar.' });
      return;
    }

    setSaving(true);

    const payload = {
      action: 'inventory_add_batch',
      usuario: loggedUser.name,
      estacion: station,
      items: itemsToSave
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (data.status === 'success') {
        clearDraft();
        setView('history');
        setMsg({ type: 'success', text: `Inventario finalizado (${itemsToSave.length} registros).` });

        loadData(false);
        setTimeout(() => setMsg({ type: '', text: '' }), 5000);
      } else {
        setMsg({ type: 'error', text: data.message || 'Error al guardar el registro.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Falla al guardar. Verificá tu conexión a internet.' });
    } finally {
      setSaving(false);
    }
  };

  const filteredMaterials = materiales.filter(m => m.tipo.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- DASHBOARD SUPERVISOR LOGIC ---
  const normalizeStr = (s) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
  const isManager = loggedUser && normalizeStr(loggedUser.rol).includes('direccion');

  const dashboardData = React.useMemo(() => {
    if (!isManager || !historialCargas.length || !inventoryRawInfo.length || !materiales.length) return null;

    const normalize = (s) => String(s || '').trim().toLowerCase();

    // Helper to categorize based on string includes
    const classifyThickness = (tipo) => {
      const t = normalize(tipo);
      if (t.includes('1/8') || t.includes('3/16') || t.includes('1/4') || t.includes('5/16')) return 'Medios';
      if (t.includes('3/8') || t.includes('1/2') || t.includes('5/8')) return 'Altos';
      if (t.includes('18') || t.includes('16') || t.includes('14')) return 'Bajos';
      return 'Otros';
    };

    // 1. Find the LATEST ID that actually has data in inventoryRawInfo (skip IDs like 11 if empty)
    let lastIdWithData = '';
    for (const hc of historialCargas) {
      const idS = normalize(hc.id);
      const hasRows = inventoryRawInfo.some(inv => normalize(inv.id) === idS && normalize(inv.unidad) === 'unidad');
      if (hasRows) {
        lastIdWithData = idS;
        break;
      }
    }

    // 2. Build stock cards based on the MASTER LIST (materiales)
    // This ensures cards NEVER disappear, they just show 0
    const groupOrder = { Bajos: 0, Medios: 1, Altos: 2, Otros: 3 };
    const perMaterialStock = materiales.map(m => {
      const tipo = m.tipo;
      // Look for this material in the latest valid upload
      const rows = inventoryRawInfo.filter(inv => normalize(inv.id) === lastIdWithData && normalize(inv.tipo) === normalize(tipo) && normalize(inv.unidad) === 'unidad');
      const total = rows.reduce((sum, r) => sum + (parseInt(r.cantidad, 10) || 0), 0);
      
      return {
        tipo: tipo,
        cantidad: total,
        grupo: classifyThickness(tipo)
      };
    }).sort((a, b) => {
      const gDiff = (groupOrder[a.grupo] ?? 9) - (groupOrder[b.grupo] ?? 9);
      return gDiff !== 0 ? gDiff : a.tipo.localeCompare(b.tipo);
    });

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 3. Build History Points (skipping empty uploads)
    const historyPoints = [];
    let maxChartValue = 0;

    // We process historial in chronological order (oldest to newest)
    [...historialCargas].reverse().forEach(carga => {
      const idS = normalize(carga.id);
      const items = inventoryRawInfo.filter(item => normalize(item.id) === idS && normalize(item.unidad) === 'unidad');
      
      if (items.length === 0) return; // Skip empty IDs (like 11) for the chart

      const point = { 
        label: carga.fecha ? carga.fecha.substring(0, 5) : '??', 
        Bajos: 0, 
        Medios: 0, 
        Altos: 0 
      };

      items.forEach(item => {
        const cat = classifyThickness(item.tipo);
        if (cat !== 'Otros') point[cat] += (parseInt(item.cantidad, 10) || 0);
      });

      const dateParts = carga.fecha ? carga.fecha.split('/') : [];
      if (dateParts.length >= 3) {
        const d = new Date(parseInt(dateParts[2].split(' ')[0], 10), parseInt(dateParts[1], 10) - 1, parseInt(dateParts[0], 10));
        if (d >= threeMonthsAgo) {
          const pointMax = Math.max(point.Bajos, point.Medios, point.Altos);
          if (pointMax > maxChartValue) maxChartValue = pointMax;
          historyPoints.push(point);
        }
      }
    });

    if (maxChartValue === 0) maxChartValue = 1;

    return { perMaterialStock, historyPoints, maxChartValue };
  }, [historialCargas, inventoryRawInfo, isManager, materiales]);

  if (loading && materiales.length === 0 && historialCargas.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 2rem', color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', marginBottom: '1.5rem', borderColor: 'var(--primary) transparent transparent transparent' }}></div>
        <p style={{ fontSize: '1.1rem', margin: 0, fontWeight: 500 }}>Cargando esquema de materiales...</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: view === 'form' ? '7rem' : '2rem', animation: 'fadeIn 0.3s ease-out' }}>

      {/* HEADER EXCLUSIVO PARA INVENTARIO */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {hasMultipleModules && view === 'history' && (
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', padding: '0.5rem' }}
            >
              <ChevronLeft size={24} />
            </button>
          )}
          {view === 'form' && (
            <button
              onClick={handleCancelar}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', padding: '0.5rem' }}
            >
              <ChevronLeft size={24} />
            </button>
          )}
          <h2 className="dashboard-title" style={{ margin: 0 }}>
            Módulo de inventario
          </h2>
        </div>

        {/* Acciones Superiores - Se eliminó botón Actualizar según requerimiento EN EL HISTORIAL, agregado en form */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {view === 'form' && (
            <button onClick={() => loadData(true)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, fontSize: '0.9rem', padding: '0.5rem 0.9rem' }} disabled={loading}>
              <RefreshCw size={15} className={loading ? "spin-anim" : ""} /> Actualizar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#FEF2F2', color: '#B91C1C', borderRadius: '8px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={20} /> {error}
        </div>
      )}

      {msg.text && view === 'history' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.5rem', background: msg.type === 'success' ? '#F0FDF4' : '#FEF2F2', color: msg.type === 'success' ? '#166534' : '#B91C1C', borderRadius: '12px', fontSize: '0.95rem', marginBottom: '1.5rem', border: `1px solid ${msg.type === 'success' ? '#A7F3D0' : '#FECACA'}` }}>
          {msg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {msg.text}
        </div>
      )}

      {/* --- HISTORY VIEW --- */}
      {view === 'history' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>

          <div style={{ background: hasDraft ? '#FFFBEB' : (weeklyCompleted ? '#F0FDF4' : 'var(--card-bg)'), borderRadius: '16px', border: hasDraft ? '2px solid #F59E0B' : (weeklyCompleted ? '2px solid #166534' : '1px solid var(--border-color)'), padding: '2rem', marginBottom: '2rem', boxShadow: '0 4px 20px -10px rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.4rem', margin: '0 0 0.5rem 0', color: hasDraft ? '#B45309' : (weeklyCompleted ? '#166534' : 'var(--text-primary)'), display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {hasDraft ? <Clock size={24} /> : (weeklyCompleted ? <CheckCircle2 size={24} /> : <Clock size={24} />)}
                {hasDraft ? 'Inventario en borrador' : (weeklyCompleted ? 'Inventario de la semana completado' : 'Control semanal pendiente')}
              </h3>
              <p style={{ margin: 0, color: hasDraft ? '#B45309' : (weeklyCompleted ? '#166534' : 'var(--text-secondary)'), fontSize: '1.05rem', maxWidth: '500px' }}>
                {hasDraft
                  ? 'Tienes un recuento guardado a medias esperando ser finalizado.'
                  : (weeklyCompleted ? 'Ya se ha registrado con éxito el control de inventario de esta semana.' : 'El inventario de todos los materiales correspondiente a esta semana está habilitado. Por favor complétalo o verifica sus cantidades.')}
              </p>
            </div>
            <button
              onClick={() => { setView('form'); setMsg({ type: '', text: '' }); setAttemptedSubmit(false); }}
              className="btn btn-primary"
              style={{ padding: '1rem 2rem', fontSize: '1.1rem', background: hasDraft ? '#F59E0B' : (weeklyCompleted ? '#DCFCE7' : 'var(--primary)'), color: weeklyCompleted ? '#166534' : 'white', border: weeklyCompleted ? '1px solid #166534' : 'none', fontWeight: 600 }}
            >
              {hasDraft ? 'Continuar Editando' : (weeklyCompleted ? '+ Agregar registro' : 'Comenzar Formulario')}
            </button>
          </div>

          {dashboardData && (
            <div style={{ marginBottom: '3rem', animation: 'fadeIn 0.4s' }}>

              {/* Header + Refresh */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Package size={20} color="var(--primary)" /> Stock actual por material (última carga)
                </h3>
                <button onClick={() => loadData(true)} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, fontSize: '0.9rem', padding: '0.5rem 0.9rem' }} disabled={loading}>
                  <RefreshCw size={15} className={loading ? 'spin-anim' : ''} /> Actualizar
                </button>
              </div>

              {/* Per-material cards - flat grid, sorted by group */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.6rem', marginBottom: '2.5rem' }}>
                {dashboardData.perMaterialStock.map((mat, i) => {
                  const colors = {
                    Bajos:  { bg: '#EFF6FF', border: '#3B82F6', color: '#3B82F6' },
                    Medios: { bg: '#FAF5FF', border: '#A855F7', color: '#A855F7' },
                    Altos:  { bg: '#FFF7ED', border: '#F97316', color: '#F97316' },
                    Otros:  { bg: '#F3F4F6', border: '#9CA3AF', color: '#6B7280' },
                  };
                  const c = colors[mat.grupo] || colors.Otros;
                  return (
                    <div key={i} style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: '10px', padding: '0.9rem 0.75rem', textAlign: 'center' }}>
                      <p style={{ margin: 0, color: c.color, fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.3 }}>{mat.tipo}</p>
                      <p style={{ margin: '0.3rem 0 0 0', color: c.color, fontSize: '1.6rem', fontWeight: 700 }}>{mat.cantidad}</p>
                    </div>
                  );
                })}
              </div>

              {/* Line Chart */}
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarIcon size={20} color="var(--primary)" /> Evolución por grupo (últimos 3 meses)
              </h3>

              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.5rem', overflowX: 'auto', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                {dashboardData.historyPoints.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>No hay cargas en los últimos 3 meses.</p>
                ) : (() => {
                  const pts = dashboardData.historyPoints;
                  const W = 1000; // Internal coordinate width for viewBox
                  const H = 200;  // Internal coordinate height
                  const PAD = { top: 20, right: 30, bottom: 40, left: 40 };
                  const chartW = W - PAD.left - PAD.right;
                  const chartH = H - PAD.top - PAD.bottom;
                  const maxV = dashboardData.maxChartValue;

                  const xPos = (i) => pts.length === 1
                    ? PAD.left + chartW / 2
                    : PAD.left + (i / (pts.length - 1)) * chartW;
                  const yPos = (v) => PAD.top + chartH - (v / maxV) * chartH;

                  const makePath = (key) => pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)},${yPos(pt[key]).toFixed(1)}`).join(' ');
                  const series = [
                    { key: 'Bajos', color: '#3B82F6', label: 'Espesores bajos' },
                    { key: 'Medios', color: '#A855F7', label: 'Espesores medios' },
                    { key: 'Altos', color: '#F97316', label: 'Espesores altos' },
                  ];

                  // Y-axis ticks
                  const yTicks = [0, Math.round(maxV * 0.5), maxV];

                  return (
                    <div style={{ width: '100%' }}>
                      <svg 
                        viewBox={`0 0 ${W} ${H}`} 
                        width="100%" 
                        height="auto" 
                        style={{ display: 'block', overflow: 'visible' }}
                      >
                        {/* grid lines */}
                        {yTicks.map((v, i) => (
                          <g key={i}>
                            <line x1={PAD.left} x2={W - PAD.right} y1={yPos(v)} y2={yPos(v)} stroke="#E5E7EB" strokeWidth="1" strokeDasharray={v === 0 ? '0' : '4,3'} />
                            <text x={PAD.left - 6} y={yPos(v) + 4} textAnchor="end" fontSize="11" fill="#9CA3AF">{v}</text>
                          </g>
                        ))}
                        {/* X labels */}
                        {pts.map((pt, i) => (
                          <text key={i} x={xPos(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#9CA3AF">{pt.label}</text>
                        ))}
                        {/* Lines + dots */}
                        {series.map(s => (
                          <g key={s.key}>
                            <path d={makePath(s.key)} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                            {pts.map((pt, i) => (
                              <circle key={i} cx={xPos(i)} cy={yPos(pt[s.key])} r="5" fill={s.color} stroke="white" strokeWidth="2">
                                <title>{s.label}: {pt[s.key]} ({pt.label})</title>
                              </circle>
                            ))}
                          </g>
                        ))}
                      </svg>
                      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '1.5rem', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                        {series.map(s => (
                          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '3px', background: s.color }}></div>
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={20} color="var(--text-secondary)" /> Historial de registros
          </h3>

          {historialCargas.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '12px', color: 'var(--text-secondary)' }}>No hay cargas previas registradas.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historialCargas.slice(0, 15).map((carga, idx) => (
                <div key={idx} onClick={() => { setSelectedCarga(carga); setView('detail'); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-secondary)'} onMouseOut={e => e.currentTarget.style.background = 'var(--card-bg)'}>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <h4 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      Carga N° {carga.id}
                      {carga.estacion && <span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>• {carga.estacion}</span>}
                    </h4>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.95rem' }}>
                      <CalendarIcon size={14} /> {carga.fecha ? carga.fecha.substring(0, 16) : ''} • {carga.usuario}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {carga.itemsDesc && carga.itemsDesc.trim() !== '' && (
                      <p style={{ margin: '0', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', background: 'var(--bg-secondary)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                        {carga.itemsDesc}
                      </p>
                    )}
                    <span style={{ display: 'inline-block', padding: '0.3rem 1rem', background: '#ECFDF5', color: '#047857', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #A7F3D0' }}>
                      {carga.estado || 'Completo'}
                    </span>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- FORM VIEW --- */}
      {view === 'form' && (
        <div style={{ animation: 'fadeIn 0.3s' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {materiales.map((mat, realIndex) => {

              const isInvalidUnit = attemptedSubmit && mat.enteras === '';
              const isInvalidRecortes = attemptedSubmit && mat.recortes.some(r => !r.cantidad || !r.largo || !r.ancho);
              const customBorder = (isInvalidUnit || isInvalidRecortes) ? '2px solid #EF4444' : '1px solid var(--border-color)';

              return (
                <div key={realIndex} style={{ background: 'var(--card-bg)', borderRadius: '12px', border: customBorder, padding: '1.25rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', transition: 'border 0.2s' }}>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: '1 1 200px' }}>
                      <h4 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{mat.tipo}</h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--input-bg)', padding: '0.25rem', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem', fontWeight: 500 }}>Unidades Enteras:</span>
                        <input
                          type="number"
                          className="custom-input"
                          placeholder=""
                          value={mat.enteras}
                          onChange={(e) => handleEnterasChange(realIndex, e.target.value)}
                          style={{ width: '90px', padding: '0.5rem', border: 'none', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: 'var(--primary)', fontWeight: 600, fontSize: '1.1rem' }}
                        />
                      </div>

                      <button
                        onClick={() => addRecorte(realIndex)}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.6rem 1rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}
                      >
                        <Plus size={16} /> Recorte
                      </button>
                    </div>
                  </div>

                  {mat.recortes.length > 0 && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {mat.recortes.map((rec, recIndex) => {
                        const showCantErr = (rec.attemptedConfirm || attemptedSubmit) && !rec.cantidad;
                        const showLargoErr = (rec.attemptedConfirm || attemptedSubmit) && !rec.largo;
                        const showAnchoErr = (rec.attemptedConfirm || attemptedSubmit) && !rec.ancho;

                        return (
                          <div key={recIndex} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px' }}>
                            <input type="number" placeholder="Cant." className="custom-input" style={{ width: '70px', padding: '0.5rem', border: showCantErr ? '2px solid #EF4444' : undefined }} value={rec.cantidad} onChange={(e) => updateRecorte(realIndex, recIndex, 'cantidad', e.target.value)} disabled={rec.confirmed} />
                            <span style={{ color: 'var(--text-secondary)' }}>x</span>
                            <input type="number" placeholder="Largo (mm)" className="custom-input" style={{ width: '90px', padding: '0.5rem', border: showLargoErr ? '2px solid #EF4444' : undefined }} value={rec.largo} onChange={(e) => updateRecorte(realIndex, recIndex, 'largo', e.target.value)} disabled={rec.confirmed} />
                            <span style={{ color: 'var(--text-secondary)' }}>x</span>
                            <input type="number" placeholder="Ancho (mm)" className="custom-input" style={{ width: '90px', padding: '0.5rem', border: showAnchoErr ? '2px solid #EF4444' : undefined }} value={rec.ancho} onChange={(e) => updateRecorte(realIndex, recIndex, 'ancho', e.target.value)} disabled={rec.confirmed} />
                            <input type="text" placeholder="Obs..." className="custom-input" style={{ flex: 1, minWidth: '100px', padding: '0.5rem' }} value={rec.obs} onChange={(e) => updateRecorte(realIndex, recIndex, 'obs', e.target.value)} disabled={rec.confirmed} />
                            
                            {!rec.confirmed ? (
                              <>
                                <button onClick={(e) => {
                                  e.preventDefault();
                                  if (!rec.cantidad || !rec.largo || !rec.ancho) {
                                    updateRecorte(realIndex, recIndex, 'attemptedConfirm', true);
                                    setMsg({ type: 'error', text: 'Debes completar cantidad, largo (mm) y ancho (mm) para poder agregar este recorte.' });
                                    return;
                                  }
                                  setMsg({ type: '', text: '' });
                                  updateRecorte(realIndex, recIndex, 'attemptedConfirm', false);
                                  updateRecorte(realIndex, recIndex, 'confirmed', true);
                              }} style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#10B981', padding: '0.5rem 0.8rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }} title="Confirmar recorte">
                                <Check size={16} /> Agregar
                              </button>
                              <button onClick={() => removeRecorte(realIndex, recIndex)} style={{ background: 'transparent', border: 'none', color: '#EF4444', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Cancelar recorte">
                                <X size={18} />
                              </button>
                            </>
                          ) : (
                            <button onClick={() => removeRecorte(realIndex, recIndex)} style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#EF4444', padding: '0.5rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Eliminar recorte">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    </div>
                  )}

                </div>
              );
            })}

            {materiales.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No hay materiales configurados en la lista.
              </div>
            )}
          </div>

          <div style={{ position: 'fixed', bottom: 0, left: '0', right: '0', background: 'white', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', borderTop: '1px solid var(--border-color)', boxShadow: '0 -10px 25px rgba(0,0,0,0.05)', zIndex: 100 }}>

            <div style={{ flex: 1, maxWidth: '800px', display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap' }}>

              <button
                onClick={handleCancelar}
                style={{ background: '#FEF2F2', color: '#B91C1C', border: 'none', padding: '1rem 1.5rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: '1 1 120px', justifyContent: 'center' }}
              >
                <X size={20} /> Cancelar
              </button>

              <button
                onClick={handleSaveDraft}
                style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '1rem 1.5rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', flex: '1 1 200px' }}
              >
                Guardar Borrador
              </button>

              <button
                onClick={handleFinalize}
                disabled={saving}
                style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem 1.5rem', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 4px 15px rgba(0, 90, 50, 0.2)', flex: '3 1 300px' }}
              >
                {saving ? <div className="spinner" style={{ width: '20px', height: '20px', borderColor: 'white transparent transparent transparent' }}></div> : <><CheckCircle2 size={20} /> Enviar Definitivo (Finalizar)</>}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- DETAIL VIEW --- */}
      {view === 'detail' && selectedCarga && (
        <div style={{ animation: 'fadeIn 0.3s' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '2rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <button
                onClick={() => setView('history')}
                style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
              >
                <ChevronLeft size={22} /> Volver
              </button>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>
                Detalles de la Carga N° {selectedCarga.id}
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Fecha</p><p style={{ margin: 0, fontWeight: 600 }}>{selectedCarga.fecha}</p></div>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Usuario</p><p style={{ margin: 0, fontWeight: 600 }}>{selectedCarga.usuario}</p></div>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Estación</p><p style={{ margin: 0, fontWeight: 600 }}>{selectedCarga.estacion || '-'}</p></div>
              <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px' }}><p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Estado</p><p style={{ margin: 0, fontWeight: 600, color: '#166534' }}>{selectedCarga.estado}</p></div>
            </div>

            <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>Artículos Registrados</h4>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Material</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Tipo</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cant.</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Dimensiones</th>
                    <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRawInfo.filter(item => String(item.id) === String(selectedCarga.id)).length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No se encontraron registros detallados para este ID en la base de inventario.</td></tr>
                  ) : (
                    inventoryRawInfo.filter(item => String(item.id) === String(selectedCarga.id)).map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{item.tipo}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ padding: '0.2rem 0.6rem', background: item.unidad === 'Unidad' ? '#EFF6FF' : '#FDF4FF', color: item.unidad === 'Unidad' ? '#1D4ED8' : '#A21CAF', borderRadius: '4px', fontSize: '0.85rem' }}>{item.unidad}</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.cantidad}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>{item.unidad === 'Recorte' ? `${item.largo}x${item.ancho}mm` : '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.observaciones || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
