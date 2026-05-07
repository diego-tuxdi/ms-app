import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  RefreshCw,
  Info,
  Hash,
  Layout,
  Layers,
  User,
  MessageSquare,
  MoreVertical,
  X
} from 'lucide-react';

const TASKS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1Z9a1gFKCiaq_9xD52s18ut_aEfYB5rkn7DpNyWtUTlY/export?format=csv&gid=0';

export default function ProductionModule({ loggedUser, station, onBack, hasMultipleModules, API_URL, usersForStation = [] }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [finishQuantity, setFinishQuantity] = useState('');
  const [finishObservations, setFinishObservations] = useState('');
  const [isCartCompleted, setIsCartCompleted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentTask, setIncidentTask] = useState(null);
  const [incidentType, setIncidentType] = useState('');
  const [incidentImpact, setIncidentImpact] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentAction, setIncidentAction] = useState('');
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  const [reportedIncidents, setReportedIncidents] = useState(() => {
    const saved = localStorage.getItem('production_reported_incidents');
    const parsed = saved ? JSON.parse(saved) : {};
    // asegurar que cada entrada sea un array para soportar múltiples incidencias
    Object.keys(parsed).forEach(key => {
      if (!Array.isArray(parsed[key])) parsed[key] = [parsed[key]];
    });
    return parsed;
  });
  const [showIncidentViewModal, setShowIncidentViewModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const parseDuration = (dStr) => {
    if (!dStr) return 0;
    const parts = String(dStr).split(':').map(Number);
    if (parts.length === 3 && !isNaN(parts[0])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${TASKS_CSV_URL}&t=${new Date().getTime()}`);
      if (!response.ok) throw new Error('Error al conectar con la planilla');
      const csvText = await response.text();

      const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
      const parsedTasks = lines.slice(1).reduce((acc, line, index) => {
        const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, ''));

        const taskId = cells[0];
        // Only add rows that have a valid ID
        if (taskId && taskId !== '-') {
          let rawStatus = (cells[16] || '').toLowerCase().trim();
          let mappedStatus = 'pendiente';
          if (rawStatus === 'en curso' || rawStatus === 'proceso') mappedStatus = 'proceso';
          else if (rawStatus === 'pausado') mappedStatus = 'pausado';
          else if (rawStatus === 'finalizado') mappedStatus = 'finalizado';

          acc.push({
            id: index,
            taskId: cells[0],
            estacion: cells[1],
            programado: cells[2],
            motivo: cells[3],
            nSerie: cells[4],
            descripcion: cells[5],
            codigo: cells[6],
            material: cells[7],
            archivo: (cells[8] || '').trim(),
            espesor: cells[9],
            cantidad: cells[10],
            prioridad: cells[11],
            origen: cells[12],
            destino: cells[13],
            estimacion: cells[14],
            subtarea: cells[15],
            status: mappedStatus,
            startTime: cells[20] || null,
            endTime: cells[21] || null,
            accumulatedSeconds: parseDuration(cells[22]),
            observaciones: cells[23] || '',
            pauseReason: cells[23] || '',
            completoCarro: cells[24] || ''
          });
        }
        return acc;
      }, []);

      const savedStateStr = localStorage.getItem('production_tasks_state');
      const savedState = savedStateStr ? JSON.parse(savedStateStr) : {};

      setTasks(prevTasks => {
        return parsedTasks.map(newTask => {
          const memTask = prevTasks.find(t => t.taskId === newTask.taskId);
          const localTask = savedState[newTask.taskId];

          if (memTask && memTask.status !== 'finalizado') {
            return {
              ...newTask,
              status: memTask.status,
              startTime: memTask.startTime,
              endTime: memTask.endTime,
              accumulatedSeconds: memTask.accumulatedSeconds !== undefined ? memTask.accumulatedSeconds : newTask.accumulatedSeconds,
              pauseReason: memTask.pauseReason
            };
          } else if (localTask && localTask.status !== 'finalizado') {
            return {
              ...newTask,
              status: localTask.status,
              startTime: localTask.startTime,
              endTime: localTask.endTime,
              accumulatedSeconds: localTask.accumulatedSeconds !== undefined ? localTask.accumulatedSeconds : newTask.accumulatedSeconds,
              pauseReason: localTask.pauseReason,
              observaciones: localTask.observaciones || newTask.observaciones
            };
          }
          return newTask;
        });
      });
    } catch (err) {
      console.error(err);
      setError('Error al cargar datos. Verifica la conexión.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
    if (tasks.length > 0) {
      const stateToSave = tasks.reduce((acc, t) => {
        if (t.status !== 'pendiente') {
          acc[t.taskId] = {
            status: t.status,
            startTime: t.startTime,
            endTime: t.endTime,
            accumulatedSeconds: t.accumulatedSeconds,
            pauseReason: t.pauseReason,
            observaciones: t.observaciones
          };
        }
        return acc;
      }, {});
      localStorage.setItem('production_tasks_state', JSON.stringify(stateToSave));
    }
  }, [tasks]);

  useEffect(() => {
    if (selectedTask) {
      const updated = tasks.find(t => t.taskId === selectedTask.taskId);
      if (updated) {
        setSelectedTask(updated);
      }
    }
  }, [tasks]);

  const updateTaskInSheet = async (taskId, updates) => {
    if (!API_URL) return;

    let statusForSheet = updates.status;
    if (statusForSheet === 'pendiente') statusForSheet = 'En espera';
    else if (statusForSheet === 'proceso') statusForSheet = 'En curso';
    else if (statusForSheet === 'pausado') statusForSheet = 'En curso';
    else if (statusForSheet === 'finalizado') statusForSheet = 'Finalizado';

    try {
      fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          module: 'produccion',
          action: 'update_task',
          taskId: taskId,
          operator: updates.operator || loggedUser?.name || 'Desconocido',
          station: station,
          ...updates,
          status: statusForSheet || updates.status
        })
      });
    } catch (err) {
      console.error('Error enviando actualización a Google Sheets:', err);
    }
  };

  const handleTaskToggle = (taskId) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    if (targetTask.status === 'proceso') {
      if (targetTask.cantidad && targetTask.cantidad.trim() !== '') {
        setActiveTaskId(taskId);
        // Default to estimacion if available, otherwise cantidad
        setFinishQuantity(targetTask.estimacion ? targetTask.estimacion.trim() : targetTask.cantidad.trim());
        setFinishObservations('');
        setIsCartCompleted(false);
        setShowFinishModal(true);
      } else {
        const endTime = new Date();
        updateTaskInSheet(targetTask.taskId, { status: 'finalizado', endTime });
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'finalizado', endTime } : t));
      }
    } else if (targetTask.status === 'pendiente' || targetTask.status === 'pausado') {
      const activeTask = tasks.find(t => t.status === 'proceso');
      if (activeTask && activeTask.id !== taskId) {
        alert('Debes pausar o finalizar la tarea actual antes de iniciar otra.');
        return;
      }
      const isResume = targetTask.status === 'pausado';
      const startTime = new Date();

      const payload = { status: 'proceso' };
      if (!isResume) payload.startTime = startTime;

      updateTaskInSheet(targetTask.taskId, payload);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'proceso', startTime } : t));
    }
  };

  const handlePauseTask = (taskId) => {
    setActiveTaskId(taskId);
    setShowPauseModal(true);
  };

  const confirmPause = () => {
    setTasks(prev => prev.map(t => {
      if (t.id === activeTaskId) {
        const sessionSeconds = Math.floor((new Date() - new Date(t.startTime)) / 1000);
        const newAccumulated = (t.accumulatedSeconds || 0) + sessionSeconds;

        const h = Math.floor(newAccumulated / 3600);
        const m = Math.floor((newAccumulated % 3600) / 60);
        const s = newAccumulated % 60;
        const duracionStr = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        updateTaskInSheet(t.taskId, { status: 'pausado', pauseReason, duracionStr });
        return {
          ...t,
          status: 'pausado',
          pauseReason,
          accumulatedSeconds: newAccumulated
        };
      }
      return t;
    }));
    setShowPauseModal(false);
    setPauseReason('');
    setActiveTaskId(null);
  };

  const confirmFinish = () => {
    const targetTask = tasks.find(t => t.id === activeTaskId);
    const endTime = new Date();

    const sessionSeconds = Math.floor((endTime - new Date(targetTask.startTime)) / 1000);
    const newAccumulated = (targetTask.accumulatedSeconds || 0) + sessionSeconds;

    const h = Math.floor(newAccumulated / 3600);
    const m = Math.floor((newAccumulated % 3600) / 60);
    const s = newAccumulated % 60;
    const duracionStr = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    updateTaskInSheet(targetTask.taskId, {
      status: 'finalizado',
      endTime,
      cantidadRealizada: finishQuantity,
      observaciones: finishObservations,
      completoCarro: isCartCompleted,
      carro: targetTask.origen,
      duracionStr
    });

    setTasks(prev => prev.map(t => {
      if (t.id === activeTaskId) {
        return { ...t, status: 'finalizado', endTime, accumulatedSeconds: newAccumulated, observaciones: finishObservations };
      }
      return t;
    }));

    setShowFinishModal(false);
    setFinishQuantity('');
    setFinishObservations('');
    setIsCartCompleted(false);
    setActiveTaskId(null);
  };

  const TaskTimerSimple = ({ startTime, status, accumulatedSeconds = 0 }) => {
    const [elapsed, setElapsed] = useState(accumulatedSeconds);

    useEffect(() => {
      let interval;
      if (status === 'proceso' && startTime) {
        setElapsed(accumulatedSeconds + Math.floor((new Date() - new Date(startTime)) / 1000));
        interval = setInterval(() => {
          setElapsed(accumulatedSeconds + Math.floor((new Date() - new Date(startTime)) / 1000));
        }, 1000);
      } else {
        setElapsed(accumulatedSeconds);
      }
      return () => clearInterval(interval);
    }, [status, startTime, accumulatedSeconds]);

    const formatTime = (seconds) => {
      if (!seconds || seconds < 0) return '00:00';
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
      <span style={{ fontSize: '1.1rem', fontWeight: 900, color: status === 'proceso' ? 'var(--primary)' : 'inherit', fontFamily: 'monospace' }}>
        {status === 'pendiente' ? '00:00' : formatTime(elapsed)}
      </span>
    );
  };

  const handleIncidentSubmit = async () => {
    if (!API_URL || !incidentTask) return;
    setIsSubmittingIncident(true);
    try {
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          module: 'produccion',
          action: 'add_incident',
          estacion: station,
          serie: incidentTask.nSerie || '-',
          tarea: incidentTask.descripcion || incidentTask.subtarea || incidentTask.taskId,
          usuario: loggedUser?.name || 'desconocido',
          tipo: incidentType,
          impacto: incidentImpact,
          descripcionCorta: incidentDescription,
          accionTomada: incidentAction
        })
      });
      setShowIncidentModal(false);
      setIncidentType('');
      setIncidentImpact('');
      setIncidentDescription('');
      setIncidentAction('');
      setIncidentTask(null);

      const incidentDetails = {
        tipo: incidentType,
        impacto: incidentImpact,
        descripcionCorta: incidentDescription,
        accionTomada: incidentAction,
        fecha: new Date().toISOString()
      };

      const currentList = reportedIncidents[incidentTask.taskId] || [];
      const newReported = { ...reportedIncidents, [incidentTask.taskId]: [...currentList, incidentDetails] };
      setReportedIncidents(newReported);
      localStorage.setItem('production_reported_incidents', JSON.stringify(newReported));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  // Filter tasks based on the current station, ignoring accents and case
  const normalizeText = (text) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() : "";

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const filteredTasks = tasks.filter(t => {
    const isStationMatch = !station || normalizeText(t.estacion) === normalizeText(station);
    if (!isStationMatch) return false;

    // Si la tarea está finalizada, solo la mostramos si finalizó hoy
    if (t.status === 'finalizado') {
      if (t.endTime) {
        return isToday(t.endTime);
      }
      return false; // Si no tiene fecha de fin, asumimos que es vieja
    }

    return true;
  });

  const hasActiveTask = filteredTasks.some(t => t.status === 'proceso');

  const renderTaskRow = (task) => {
    const isDone = task.status === 'finalizado';
    const isProcessing = task.status === 'proceso';
    const isPaused = task.status === 'pausado';
    const isDisabled = hasActiveTask && !isProcessing && !isDone;

    return (
      <div
        key={task.id}
        className="task-horizontal-card"
        style={{
          background: isProcessing ? 'rgba(0, 150, 80, 0.04)' : (isDone ? '#f0fdf4' : 'var(--card-bg)'),
          borderRadius: '20px',
          border: `1px solid ${isProcessing ? 'var(--primary)' : (isDone ? '#86efac' : (isPaused ? '#fbbf24' : 'var(--border-color)'))}`,
          padding: '1.25rem 1.5rem',
          marginBottom: '1rem',
          boxShadow: '0 4px 20px -10px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          gap: '1rem',
          transition: 'all 0.2s',
          position: 'relative'
        }}
      >
        {/* ROW 1: Task ID & Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
              {task.taskId || '-'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => { setIncidentTask(task); setShowIncidentModal(true); }}
              style={{
                background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px',
                padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s'
              }}
            >
              Reportar Incidencia
            </button>
            <button
              onClick={() => setSelectedTask(task)}
              style={{
                background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px',
                padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', transition: 'all 0.2s'
              }}
            >
              Ver detalles
            </button>
          </div>
        </div>

        {/* ROW 2 & 3: Title & Meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {task.descripcion || task.subtarea || 'Tarea sin descripción'}
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {task.codigo && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cód: {task.codigo}</span>}
            {task.espesor && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Esp: {task.espesor}</span>}
            {task.cantidad && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Cant: {task.cantidad}</span>}
            {task.estimacion && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Est: {task.estimacion}</span>}
            {task.nSerie && <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Serie: {task.nSerie}</span>}
          </div>
        </div>

        {/* DIVIDER */}
        <div style={{ width: '100%', borderBottom: '1px dashed var(--border-color)', margin: '0.5rem 0' }}></div>

        {/* ROW 4: Times & State Actions */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap'
        }}>
          {/* Left: INICIO & FIN & DURACION */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>INICIO:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{task.startTime ? new Date(task.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>FIN:</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{task.endTime ? new Date(task.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'white', padding: '0.5rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>DURACIÓN:</span>
              <TaskTimerSimple startTime={task.startTime} status={task.status} accumulatedSeconds={task.accumulatedSeconds} />
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {!isDone && (
              <>
                <button
                  onClick={() => handleTaskToggle(task.id)}
                  disabled={isDisabled}
                  style={{
                    padding: '0 1.25rem', height: '42px', borderRadius: '10px', border: 'none',
                    background: isProcessing ? '#10b981' : (isDisabled ? '#d1d5db' : '#059669'),
                    color: isDisabled ? '#6b7280' : 'white', cursor: isDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1rem',
                    boxShadow: (!isDisabled && !isProcessing) ? '0 4px 12px rgba(5, 150, 105, 0.2)' : 'none'
                  }}
                >
                  {isProcessing ? <CheckCircle2 size={18} /> : (isPaused ? <Play size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />)}
                  {isProcessing ? 'Finalizar' : (isPaused ? 'Reanudar' : 'Iniciar')}
                </button>
                {isProcessing && (
                  <button
                    onClick={() => handlePauseTask(task.id)}
                    style={{
                      width: '42px', height: '42px', borderRadius: '10px', border: '1px solid #fbbf24',
                      background: '#fffbeb', color: '#d97706', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Pause size={18} fill="currentColor" />
                  </button>
                )}
              </>
            )}
            {isDone && (
              <div style={{ background: '#dcfce7', color: '#166534', padding: '0.5rem 1.25rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                <CheckCircle2 size={18} /> Completada
              </div>
            )}
          </div>
        </div>

        {/* INCIDENT NOTIFICATION AT BOTTOM */}
        {reportedIncidents[task.taskId] && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIncident({ list: reportedIncidents[task.taskId], taskId: task.taskId });
              setShowIncidentViewModal(true);
            }}
            style={{
              marginTop: '0.5rem', padding: '0.75rem 1rem', background: '#fef2f2', borderRadius: '12px',
              border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626',
              cursor: 'pointer', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
            onMouseOut={(e) => e.currentTarget.style.background = '#fef2f2'}
          >
            <AlertCircle size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>
              Ver incidencias reportadas
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {selectedTask ? (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button
              onClick={() => setSelectedTask(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '1.2rem' }}
            >
              <ChevronLeft size={28} /> Volver al listado
            </button>

            {reportedIncidents[selectedTask.taskId] && (
              <div
                onClick={() => {
                  setSelectedIncident({ list: reportedIncidents[selectedTask.taskId], taskId: selectedTask.taskId });
                  setShowIncidentViewModal(true);
                }}
                style={{
                  background: '#fef2f2', color: '#dc2626', padding: '0.5rem 1.25rem', borderRadius: '12px',
                  border: '1px solid #fee2e2', fontWeight: 800, fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                onMouseOut={(e) => e.currentTarget.style.background = '#fef2f2'}
              >
                <AlertCircle size={18} /> Ver incidencias reportadas
              </div>
            )}
          </div>

          <div style={{ background: 'var(--card-bg)', borderRadius: '32px', border: '1px solid var(--border-color)', padding: '3rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '2rem', margin: '0 0 2.5rem', fontWeight: 900, letterSpacing: '-0.03em' }}>{selectedTask.descripcion}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '3rem' }}>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>id de tarea</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.taskId || '-'}</p>
              </div>

              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Serie / Código</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.nSerie || '-'} / {selectedTask.codigo || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Material</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.material || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Espesor</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.espesor || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Cantidad</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.cantidad || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Prioridad</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.prioridad || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Origen → Destino</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.origen || '-'} → {selectedTask.destino || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Estimación</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.estimacion || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Motivo</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.motivo || '-'}</p>
              </div>
              <div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>Obervaciones</p>
                <p style={{ margin: '0.5rem 0 0', fontSize: '1.2rem', fontWeight: 800 }}>{selectedTask.observaciones || 'sin observaciones registradas.'}</p>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
              <div style={{ padding: '0 0 2rem 0', background: 'var(--bg-secondary)', borderRadius: '24px' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem', paddingBottom: '1rem', }}>Archivo</p>
                {(() => {
                  const archivo = selectedTask.archivo;
                  if (!archivo || archivo === '-') return <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>no hay archivo adjunto</p>;
                  const urlMatch = archivo.match(/(https?:\/\/[^\s"]+)/);
                  if (urlMatch) {
                    const originalUrl = urlMatch[1];
                    let embedUrl = originalUrl;
                    if (originalUrl.includes('drive.google.com')) {
                      const driveMatch = originalUrl.match(/\/file\/d\/([^\/]+)/) || originalUrl.match(/\/d\/([^\/]+)/) || originalUrl.match(/[?&]id=([^&]+)/);
                      if (driveMatch && driveMatch[1]) {
                        embedUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
                      } else {
                        embedUrl = originalUrl.replace(/\/view(\?.*)?$/, '/preview').replace(/\/edit(\?.*)?$/, '/preview');
                      }
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%' }}>
                        <div style={{ flex: 1, minHeight: '500px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'white' }}>
                          <iframe
                            key={embedUrl}
                            src={embedUrl}
                            width="100%"
                            height="100%"
                            style={{ border: 'none' }}
                            title="vista previa del archivo"
                            allow="autoplay"
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div style={{ padding: '1rem', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fef3c7' }}>
                      <p style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#92400e' }}>no se detectó un link válido:</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '1rem', color: '#b45309', wordBreak: 'break-all' }}>{archivo}</p>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {hasMultipleModules && (
                <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><ChevronLeft size={28} /></button>
              )}
              <h2 className="dashboard-title" style={{ margin: 0 }}>Gestión de producción</h2>
            </div>
            <button
              onClick={loadTasks}
              style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.75rem 1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)', fontWeight: 750, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
              disabled={loading}
            >
              <RefreshCw size={20} className={loading ? 'spin-anim' : ''} /> Actualizar lista
            </button>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1.25rem', borderRadius: '16px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: '#b91c1c', fontWeight: 600 }}>
              <AlertCircle size={24} /> {error}
            </div>
          )}

          {loading && tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '8rem 0' }}>
              <div className="spinner" style={{ margin: '0 auto 2rem', width: '60px', height: '60px', borderWidth: '4px' }}></div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 600 }}>Cargando datos de producción...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '10rem 0', color: 'var(--text-secondary)', background: 'var(--card-bg)', borderRadius: '24px', border: '2px dashed var(--border-color)' }}>
                  <AlertCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                  <p style={{ fontSize: '1.2rem' }}>No hay tareas activas en esta estación.</p>
                </div>
              ) : filteredTasks.map(renderTaskRow)}
            </div>
          )}
        </>
      )}

      {/* PAUSE MODAL */}
      {showPauseModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem'
        }}>
          <div style={{ background: 'white', borderRadius: '32px', padding: '2.5rem', maxWidth: '550px', width: '100%', boxShadow: '0 30px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.75rem', fontWeight: 900 }}>Pausar Tarea</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '1.1rem' }}>Selecciona el motivo oficial de la interrupción:</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2.5rem' }}>
              {['Almuerzo', 'Mantenimiento', 'Falta Material', 'Fin de Turno', 'Limpieza', 'Otro'].map(reason => (
                <button
                  key={reason}
                  onClick={() => setPauseReason(reason)}
                  style={{
                    padding: '1.25rem', borderRadius: '16px', border: '2px solid',
                    borderColor: pauseReason === reason ? 'var(--primary)' : 'var(--border-color)',
                    background: pauseReason === reason ? 'rgba(0, 90, 50, 0.05)' : 'white',
                    color: pauseReason === reason ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowPauseModal(false)} style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={confirmPause}
                disabled={!pauseReason}
                style={{ flex: 2, padding: '1.25rem', borderRadius: '16px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: !pauseReason ? 0.5 : 1 }}
              >
                Confirmar Pausa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINISH MODAL */}
      {showFinishModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem'
        }}>
          <div style={{ background: 'white', borderRadius: '32px', padding: '2.5rem', maxWidth: '500px', width: '100%', boxShadow: '0 30px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.75rem', fontWeight: 900, textAlign: 'center' }}>Finalizar Tarea</h3>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>Cantidad a realizar (estimada):</label>
              <input
                type="number"
                value={finishQuantity}
                onChange={(e) => setFinishQuantity(e.target.value)}
                style={{
                  width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid var(--border-color)',
                  fontSize: '1.5rem', fontWeight: 900, textAlign: 'center', color: 'var(--primary)'
                }}
                autoFocus
              />
            </div>

            {tasks.find(t => t.id === activeTaskId)?.origen && (
              <div style={{ marginBottom: '1.5rem', background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setIsCartCompleted(!isCartCompleted)}>
                <input
                  type="checkbox"
                  checked={isCartCompleted}
                  onChange={(e) => setIsCartCompleted(e.target.checked)}
                  style={{ width: '24px', height: '24px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  ¿Completó carro? <span style={{ color: 'var(--primary)' }}>({tasks.find(t => t.id === activeTaskId)?.origen})</span>
                </span>
              </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '1.1rem', fontWeight: 600 }}>Observaciones:</label>
              <textarea
                value={finishObservations}
                onChange={(e) => setFinishObservations(e.target.value)}
                placeholder="Opcional: detalles sobre la finalización..."
                style={{
                  width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid var(--border-color)',
                  fontSize: '1rem', color: 'var(--text-primary)', minHeight: '80px', resize: 'vertical', fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowFinishModal(false)} style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button
                onClick={confirmFinish}
                disabled={!finishQuantity}
                style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', border: 'none', background: '#10b981', color: 'white', fontWeight: 800, cursor: 'pointer', opacity: !finishQuantity ? 0.5 : 1 }}
              >
                Completar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INCIDENT MODAL */}
      {showIncidentModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem'
        }}>
          <div style={{ background: 'white', borderRadius: '32px', padding: '2.5rem', maxWidth: '600px', width: '100%', boxShadow: '0 30px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900 }}>Reportar incidencia</h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, }}>Tipo</label>
                <select
                  value={incidentType}
                  onChange={(e) => setIncidentType(e.target.value)}
                  style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '1rem', fontWeight: 600, background: 'white' }}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Falta de insumo">Falta de insumo</option>
                  <option value="Falla de máquina">Falla de máquina</option>
                  <option value="Error de proceso">Error de proceso</option>
                  <option value="Problema de plano">Problema de plano</option>
                  <option value="Carro incompleto">Carro incompleto</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, }}>Impacto</label>
                <select
                  value={incidentImpact}
                  onChange={(e) => setIncidentImpact(e.target.value)}
                  style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '1rem', fontWeight: 600, background: 'white' }}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Retraso">Retraso</option>
                  <option value="Parada parcial">Parada parcial</option>
                  <option value="Parada total">Parada total</option>
                  <option value="Reproceso">Reproceso</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, }}>Descripción corta</label>
              <input
                type="text"
                value={incidentDescription}
                onChange={(e) => setIncidentDescription(e.target.value)}
                placeholder="Ej: falta de bisagras para lote..."
                style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '1rem', fontWeight: 600 }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 700, }}>Acción tomada</label>
              <textarea
                value={incidentAction}
                onChange={(e) => setIncidentAction(e.target.value)}
                placeholder="Ej: se avisó a compras y se pausó la tarea..."
                style={{ width: '100%', padding: '0.85rem', borderRadius: '12px', border: '2px solid var(--border-color)', fontSize: '1rem', fontWeight: 600, minHeight: '80px', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowIncidentModal(false)}
                disabled={isSubmittingIncident}
                style={{ flex: 1, padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleIncidentSubmit}
                disabled={isSubmittingIncident || !incidentType || !incidentImpact || !incidentDescription}
                style={{
                  flex: 2, padding: '1.25rem', borderRadius: '16px', border: 'none',
                  background: '#ef4444', color: 'white', fontWeight: 800, cursor: 'pointer',
                  opacity: (isSubmittingIncident || !incidentType || !incidentImpact || !incidentDescription) ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                {isSubmittingIncident ? <RefreshCw size={20} className="spin-anim" /> : 'Reportar incidencia'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* INCIDENT VIEW MODAL */}
      {showIncidentViewModal && selectedIncident && (
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
                onClick={() => setShowIncidentViewModal(false)}
                style={{
                  position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'var(--bg-secondary)',
                  border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
                  zIndex: 10
                }}
              >
                <X size={20} />
              </button>

              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900 }}>Historial de incidencias</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.4rem' }}>Reportadas para la tarea {selectedIncident.taskId}</p>
              </div>
            </div>

            {/* SCROLLABLE BODY */}
            <div style={{ padding: '1.5rem 2.5rem 2.5rem', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {selectedIncident.list && selectedIncident.list.map((inc, idx) => (
                  <div key={idx} style={{ padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>INCIDENCIA #{idx + 1}</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {new Date(inc.fecha).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>TIPO</label>
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{inc.tipo}</p>
                      </div>
                      <div>
                        <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>IMPACTO</label>
                        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#dc2626' }}>{inc.impacto}</p>
                      </div>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>DESCRIPCIÓN</label>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.4 }}>{inc.descripcionCorta}</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>ACCIÓN TOMADA</label>
                      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 400, color: '#166534', lineHeight: 1.4 }}>{inc.accionTomada}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
