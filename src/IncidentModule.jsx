import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  RefreshCw,
  Clock,
  Calendar,
  User,
  MapPin,
  Tag,
  AlertTriangle,
  X
} from 'lucide-react';

const INCIDENTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1Z9a1gFKCiaq_9xD52s18ut_aEfYB5rkn7DpNyWtUTlY/export?format=csv&gid=640859887';

export default function IncidentModule({ loggedUser, station, onBack, hasMultipleModules }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Form states for new incident
  const [incidentType, setIncidentType] = useState('');
  const [incidentImpact, setIncidentImpact] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentAction, setIncidentAction] = useState('');
  const [incidentSerie, setIncidentSerie] = useState('');
  const [incidentTaskName, setIncidentTaskName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadIncidents = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${INCIDENTS_CSV_URL}&t=${new Date().getTime()}`);
      if (!response.ok) throw new Error('Error al conectar con la planilla');
      const csvText = await response.text();

      const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = lines.slice(1).map((line, index) => {
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, ''));
        // Columnas: A:Fecha, B:Estación, C:Serie, D:Tarea, E:Usuario, F:Estado, G:Tipo, H:Impacto, I:Descripción, J:Acción
        return {
          id: index,
          fecha: cells[0] || '',
          estacion: cells[1] || '',
          serie: cells[2] || '',
          tarea: cells[3] || '',
          usuario: cells[4] || '',
          estado: cells[5] || 'Reportada',
          tipo: cells[6] || '',
          impacto: cells[7] || '',
          descripcion: cells[8] || '',
          accion: cells[9] || ''
        };
      });

      // Filtrar por la estación actual
      const filtered = parsed.filter(inc =>
        !station || inc.estacion.trim().toLowerCase() === station.trim().toLowerCase()
      ).reverse(); // Mostrar las más nuevas primero

      setIncidents(filtered);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las incidencias.');
    } finally {
      setLoading(false);
    }
  };

  const handleIncidentSubmit = async () => {
    if (!incidentType || !incidentImpact || !incidentDescription) {
      alert('por favor completa los campos obligatorios (tipo, impacto y descripción)');
      return;
    }

    setIsSubmitting(true);
    try {
      // Usamos la API_URL global que maneja produccion (la pasamos por props o la hardcodeamos si es fija)
      const API_URL = 'https://script.google.com/macros/s/AKfycbxpHtkkS4luxBUbufGzt0jGkYkZlolQCZSDgkNv6UP_JRxPyO0Q4VjMucykr8decuS-/exec';

      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          module: 'produccion',
          action: 'add_incident',
          estacion: station,
          serie: incidentSerie || '-',
          tarea: incidentTaskName || 'Reporte Manual',
          usuario: loggedUser?.name || 'desconocido',
          tipo: incidentType,
          impacto: incidentImpact,
          descripcionCorta: incidentDescription,
          accionTomada: incidentAction
        })
      });

      // Limpiar y cerrar
      setIncidentType('');
      setIncidentImpact('');
      setIncidentDescription('');
      setIncidentAction('');
      setIncidentSerie('');
      setIncidentTaskName('');
      setShowReportModal(false);

      // Recargar lista
      loadIncidents();
    } catch (err) {
      console.error(err);
      alert('error al enviar la incidencia');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const getImpactColor = (impacto) => {
    const imp = impacto.toLowerCase();
    if (imp.includes('total')) return '#ef4444';
    if (imp.includes('parcial')) return '#f97316';
    if (imp.includes('reproceso')) return '#facc15';
    return '#3b82f6'; // retraso o otros
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {hasMultipleModules && (
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <ChevronLeft size={28} />
            </button>
          )}
          <h2 className="dashboard-title" style={{ margin: 0 }}>Módulo de test</h2>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setShowReportModal(true)}
            style={{
              background: 'var(--primary)', border: 'none', borderRadius: '12px',
              padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '0.6rem', color: 'white', fontWeight: 750, boxShadow: '0 4px 12px rgba(0, 90, 50, 0.2)'
            }}
          >
            <AlertTriangle size={20} /> Nueva Incidencia
          </button>
          <button
            onClick={loadIncidents}
            style={{
              background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px',
              padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '0.6rem', color: 'var(--text-primary)', fontWeight: 750, boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
            }}
            disabled={loading}
          >
            <RefreshCw size={20} className={loading ? 'spin-anim' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: '#b91c1c', fontWeight: 600 }}>
          <AlertCircle size={24} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '8rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 2rem', width: '60px', height: '60px', borderWidth: '4px' }}></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 600 }}>Cargando historial de incidencias...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '10rem 0', color: 'var(--text-secondary)', background: 'var(--card-bg)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
              <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p style={{ fontSize: '1.2rem' }}>No se registran incidencias en esta estación.</p>
            </div>
          ) : incidents.map(inc => (
            <div
              key={inc.id}
              onClick={() => setSelectedIncident(inc)}
              className="task-horizontal-card"
              style={{
                background: 'var(--card-bg)', borderRadius: '20px', border: '1px solid var(--border-color)',
                padding: '1.25rem 1.5rem', cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '6px', textTransform: 'uppercase' }}>
                      {inc.tipo}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'white', background: getImpactColor(inc.impacto), padding: '0.2rem 0.5rem', borderRadius: '6px', textTransform: 'uppercase' }}>
                      {inc.impacto}
                    </span>
                  </div>
                  <h3 style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{inc.tarea}</h3>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <div>{inc.fecha}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                    <User size={14} /> {inc.usuario}
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '12px', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                {inc.descripcion}
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {inc.serie && <span>SERIE: {inc.serie}</span>}
                {inc.estacion && <span>ESTACIÓN: {inc.estacion}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETALLE DE INCIDENCIA MODAL */}
      {selectedIncident && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '2rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '32px', maxWidth: '600px', width: '100%',
            boxShadow: '0 30px 60px rgba(0,0,0,0.3)', position: 'relative',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* STICKY HEADER */}
            <div style={{ padding: '2.5rem 2.5rem 1.5rem', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
              <button
                onClick={() => setSelectedIncident(null)}
                style={{
                  position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--bg-secondary)',
                  border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)'
                }}
              >
                <X size={20} />
              </button>

              <div style={{ textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'white', background: getImpactColor(selectedIncident.impacto), padding: '0.3rem 0.6rem', borderRadius: '8px', textTransform: 'uppercase' }}>
                    {selectedIncident.impacto}
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '0.3rem 0.6rem', borderRadius: '8px', textTransform: 'uppercase' }}>
                    {selectedIncident.tipo}
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>Detalles del reporte</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.4rem' }}>{selectedIncident.tarea}</p>
              </div>
            </div>

            {/* SCROLLABLE BODY */}
            <div style={{ padding: '1.5rem 2.5rem 2.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>USUARIO</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <User size={18} /> {selectedIncident.usuario}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>FECHA Y HORA</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <Calendar size={18} /> {selectedIncident.fecha}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>SERIE</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <Tag size={18} /> {selectedIncident.serie || '-'}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>ESTACIÓN</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    <MapPin size={18} /> {selectedIncident.estacion}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>DESCRIPCIÓN</label>
                <div style={{ padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.6 }}>{selectedIncident.descripcion}</p>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase' }}>ACCIÓN TOMADA</label>
                <div style={{ padding: '1.25rem', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #dcfce7' }}>
                  <p style={{ margin: 0, fontSize: '1rem', fontWeight: 400, color: '#166534', lineHeight: 1.6 }}>{selectedIncident.accion}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORT NEW INCIDENT MODAL */}
      {showReportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000, padding: '2rem'
        }}>
          <div style={{
            background: 'white', borderRadius: '32px', padding: '2.5rem', maxWidth: '550px', width: '100%',
            boxShadow: '0 30px 60px rgba(0,0,0,0.3)', position: 'relative'
          }}>
            <h3 style={{ margin: '0 0 1.5rem', fontSize: '1.6rem', fontWeight: 900 }}>Reportar Incidencia</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Tipo de incidencia</label>
                  <select
                    className="custom-select"
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                  >
                    <option value="">seleccionar...</option>
                    <option value="Mecánica">Mecánica</option>
                    <option value="Eléctrica">Eléctrica</option>
                    <option value="Material">Falta de Material</option>
                    <option value="Diseño">Error de Diseño</option>
                    <option value="Calidad">Calidad / Medidas</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Impacto</label>
                  <select
                    className="custom-select"
                    value={incidentImpact}
                    onChange={(e) => setIncidentImpact(e.target.value)}
                  >
                    <option value="">seleccionar...</option>
                    <option value="Parada Total">Parada Total</option>
                    <option value="Parada Parcial">Parada Parcial</option>
                    <option value="Retraso">Retraso</option>
                    <option value="Reproceso">Reproceso</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Nº Serie (opcional)</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={incidentSerie}
                    onChange={(e) => setIncidentSerie(e.target.value)}
                    placeholder="ej: 1234"
                  />
                </div>
                <div className="form-group">
                  <label>Tarea / Referencia</label>
                  <input
                    type="text"
                    className="custom-input"
                    value={incidentTaskName}
                    onChange={(e) => setIncidentTaskName(e.target.value)}
                    placeholder="ej: soldadura chasis"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción corta</label>
                <textarea
                  className="custom-input"
                  style={{ minHeight: '80px', padding: '0.75rem', resize: 'none' }}
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Acción tomada</label>
                <textarea
                  className="custom-input"
                  style={{ minHeight: '80px', padding: '0.75rem', resize: 'none' }}
                  value={incidentAction}
                  onChange={(e) => setIncidentAction(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowReportModal(false)}
                  style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'white', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleIncidentSubmit}
                  disabled={isSubmitting}
                  style={{ flex: 2, padding: '1rem', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {isSubmitting ? <div className="spinner" style={{ width: '20px', height: '20px' }}></div> : 'Enviar Reporte'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
