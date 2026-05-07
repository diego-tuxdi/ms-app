import { useState, useEffect } from 'react';
import { UserCircle2, KeyRound, AlertCircle, AlertTriangle, RefreshCw, MoveRight, Eye, EyeOff, LogOut, Truck, Package, Factory, MapPin, ChevronLeft, Wrench, CheckCircle2, Scissors, Zap, Monitor, Droplet, Hammer, Home, Menu as MenuIcon, Bell, MessageCircle } from 'lucide-react';
import InventoryModule from './InventoryModule';
import ProductionModule from './ProductionModule';
import IncidentModule from './IncidentModule';

// Google Sheets CSV Export URL
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1EB5qfFa9Hr-lQuUPxegl7PmQG30Ti5friDjkQIXjfzk/export?format=csv&id=1EB5qfFa9Hr-lQuUPxegl7PmQG30Ti5friDjkQIXjfzk&gid=0';

export default function App() {
  const [selectedName, setSelectedName] = useState('');
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [allStations, setAllStations] = useState([]);
  const [loggedUser, setLoggedUser] = useState(() => JSON.parse(localStorage.getItem('loggedUser')) || null);
  const [station, setStation] = useState(() => localStorage.getItem('station') || '');
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'inicio');
  const [activeModule, setActiveModule] = useState(() => localStorage.getItem('activeModule') || null);
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem('isLocked') === 'true');
  const [isAdminConfiguring, setIsAdminConfiguring] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);

  useEffect(() => {
    if (loggedUser) localStorage.setItem('loggedUser', JSON.stringify(loggedUser));
    else localStorage.removeItem('loggedUser');
  }, [loggedUser]);

  useEffect(() => localStorage.setItem('station', station), [station]);

  useEffect(() => localStorage.setItem('activeTab', activeTab), [activeTab]);

  useEffect(() => {
    if (activeModule) localStorage.setItem('activeModule', activeModule);
    else localStorage.removeItem('activeModule');
  }, [activeModule]);

  useEffect(() => {
    localStorage.setItem('isLocked', isLocked);
  }, [isLocked]);

  const STATIONS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1EB5qfFa9Hr-lQuUPxegl7PmQG30Ti5friDjkQIXjfzk/gviz/tq?tqx=out:csv&sheet=Estaciones';

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Fetch data from Google Sheets
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, stationsRes] = await Promise.all([
          fetch(`${SHEET_CSV_URL}&t=${new Date().getTime()}`),
          fetch(STATIONS_CSV_URL)
        ]);

        if (!usersRes.ok || !stationsRes.ok) throw new Error('Error al conectar con la planilla');

        const usersText = await usersRes.text();
        const stationsText = await stationsRes.text();

        // Parse Users
        const usersLines = usersText.split('\n');
        // skip header at index 0
        const fetchedUsers = usersLines.slice(1).reduce((acc, line) => {
          // Splitting by comma, ignoring commas inside double quotes
          const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          if (cells.length > 7) {
            const id = cells[0]?.trim();
            const nombre = cells[1]?.trim();
            const apellido = cells[2]?.trim();
            // Email is 3
            const codigo = cells[4]?.trim(); 
            const rol = cells[5]?.trim(); 

            let estacionesStr = cells[6]?.trim() || '';
            if (estacionesStr.startsWith('"') && estacionesStr.endsWith('"')) {
              estacionesStr = estacionesStr.slice(1, -1);
            }
            const userStations = estacionesStr.split(',').map(s => s.trim()).filter(Boolean);

            const strActivo = cells[7]?.trim().toUpperCase();

            // Parse Modulos (Column 8)
            let userModules = ['producción', 'inventario']; // Base por defecto
            if (cells.length > 8) {
              let modulosStr = cells[8]?.trim() || '';
              if (modulosStr.startsWith('"') && modulosStr.endsWith('"')) {
                modulosStr = modulosStr.slice(1, -1);
              }
              if (modulosStr) {
                // Split por coma, punto y coma o salto de línea, y limpiar espacios
                userModules = modulosStr.split(/[,;\n]/).map(m => m.trim().toLowerCase()).filter(Boolean);
              } else {
                userModules = []; 
              }
            }

            const isActive = strActivo === 'TRUE' || strActivo === 'VERDADERO' || strActivo === '1' || strActivo === 'SI';

            if (id && nombre) {
              acc.push({ id, name: `${nombre} ${apellido}`, code: codigo, rol, isActive, stations: userStations, modules: userModules });
            }
          }
          return acc;
        }, []);

        setUsers(fetchedUsers);

        // Sincronizar el usuario logueado con los datos nuevos (por si cambiaron sus módulos en el sheet)
        setLoggedUser(prev => {
          if (!prev) return null;
          const updated = fetchedUsers.find(u => u.id === prev.id);
          return updated ? { ...updated } : prev;
        });

        // Parse Stations
        const stationsLines = stationsText.split('\n');
        const fetchedStations = stationsLines.slice(1).reduce((acc, line) => {
          const cells = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
          let st = cells[0]?.trim();
          if (st) {
            if (st.startsWith('"') && st.endsWith('"')) {
              st = st.slice(1, -1);
            }
            if (st && st.toLowerCase() !== 'estaciones' && st.toLowerCase() !== 'nombre') {
              acc.push(st);
            }
          }
          return acc;
        }, []);

        setAllStations(fetchedStations);

      } catch (err) {
        console.error(err);
        setError('Error al cargar datos de Google Sheets.');
      }
    };

    fetchData();
  }, []);

  // get specific icon per station
  const getStationIcon = (stationName) => {
    const name = stationName.toUpperCase();
    if (name.includes('EI')) return <Wrench size={26} color="var(--primary)" />;
    if (name.includes('EF')) return <CheckCircle2 size={26} color="var(--primary)" />;
    if (name.includes('PANTÓGRAFO') || name.includes('SERRUCHO') || name.includes('SIERRA')) return <Scissors size={26} color="var(--primary)" />;
    if (name.includes('LÁSER')) return <Zap size={26} color="var(--primary)" />;
    if (name.includes('CNC') || name.includes('CENTRO') || name.includes('ROBOT')) return <Monitor size={26} color="var(--primary)" />;
    if (name.includes('PINTURA')) return <Droplet size={26} color="var(--primary)" />;
    if (name.includes('PARALELO') || name.includes('CILINDRADORA') || name.includes('PLEGADO')) return <Hammer size={26} color="var(--primary)" />;
    return <Factory size={26} color="var(--primary)" />;
  };

  // Derived state for filtering
  const usersForStation = users.filter(u =>
    u.stations && u.stations.some(s => s.trim().toLowerCase() === station.trim().toLowerCase())
  );

  // API URL from Google Apps Script (Deberás pegar aquí tu URL cuando termines el Script)
  const API_URL = 'https://script.google.com/macros/s/AKfycbzEv7FdjY-9VBL_hs4HM2wMFAI1XToI2jkOPL7RjlcKsmUzESXUT0_FrOzMySz3ZVd8/exec';

  // API URL para el nuevo script de INVENTARIO
  const INVENTORY_API_URL = 'https://script.google.com/macros/s/AKfycbw8SFAmjoAZxzKBl5NILzsUMvfzPsKkHOx7OiUNgGJbkaVjIAspCuTY7O1zR_LeQnKL/exec';

  // API URL para el nuevo script de PRODUCCIÓN
  const PRODUCTION_API_URL = 'https://script.google.com/macros/s/AKfycbxpHtkkS4luxBUbufGzt0jGkYkZlolQCZSDgkNv6UP_JRxPyO0Q4VjMucykr8decuS-/exec';

  const handleLogout = () => {
    setLoggedUser(null);
    setCode('');
    setActiveTab('inicio');
    setActiveModule(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedName || !code) {
      setError('Por favor selecciona tu nombre e ingresa tu código');
      return;
    }

    setLoading(true);

    try {
      const user = users.find(u => u.name === selectedName);

      if (!user) {
        setError('Usuario no encontrado.');
        return;
      }

      if (!user.isActive) {
        setError('Acceso denegado. Este usuario se encuentra inactivo.');
        return;
      }

      if (user.code?.toString().trim() === code.trim()) {
        // Check for Admin Role in Setup/Unlock mode
        const isUserAdmin = user.rol?.trim().toLowerCase() === 'admin';

        if ((!isLocked || isAdminConfiguring) && !isUserAdmin) {
          setError('Este usuario no tiene permisos de administrador (Rol: ' + (user.rol || 'ninguno') + ').');
          return;
        }

        if (isAdminConfiguring || !isLocked) {
          // Admin successfully logged in to configure
          setIsAdminAuthenticated(true);
          setStation('');
          setIsLocked(false);
          setLoggedUser(null);
          setCode('');
          return;
        }

        setLoggedUser(user);
        setSuccess('');

        if (user.modules && user.modules.length === 1) {
          setActiveModule(user.modules[0]);
        } else {
          setActiveModule(null);
        }

        // Log Last Access in background
        if (API_URL) {
          fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors', // GAS often works better with no-cors for background logs
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: 'login', userName: selectedName, station: station })
          }).catch(console.error); 
        }

        // Here we would typically redirect to the main tablet dashboard!
      } else {
        setError('El código ingresado es incorrecto.');
      }
    } catch (err) {
      setError('Ocurrió un error inesperado al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("el navegador aún no habilitó la instalación. puede que no estés usando chrome, que no estés usando https en producción, o que la app ya esté instalada.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleLongPressStart = () => {
    const timer = setTimeout(() => {
      if (confirm('¿desea entrar al modo de configuración de terminal?')) {
        setIsAdminConfiguring(true);
        setIsAdminAuthenticated(false);
        setLoggedUser(null);
      }
    }, 3000);
    setPressTimer(timer);
  };

  const handleLongPressEnd = () => {
    if (pressTimer) clearTimeout(pressTimer);
  };

  const handleResendCode = async () => {
    if (!selectedName) {
      setError('Selecciona tu nombre primero para reenviar el código.');
      return;
    }

    if (!API_URL) {
      setError('Falta configurar el servidor de correos (Aguardando Script).');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // Force send even without CORS headers
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'resend', userName: selectedName })
      });
      
      // In no-cors mode we can't read the response, so we show a general success message
      setSuccess('Solicitud enviada correctamente. Revise su bandeja de entrada en unos instantes.');
      setTimeout(() => setSuccess(''), 6000);
      
    } catch (err) {
      console.error(err);
      setError('Error al conectar con el servidor de correos.');
    } finally {
      setLoading(false);
    }
  };

  if (loggedUser) {
    const renderContent = () => {
      switch (activeTab) {
        case 'inicio':
          if (activeModule) {
            return (
              <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {activeModule.includes('inv') ? (
                  <InventoryModule
                    loggedUser={loggedUser}
                    station={station}
                    API_URL={INVENTORY_API_URL}
                    onBack={() => setActiveModule(null)}
                    hasMultipleModules={loggedUser.modules && loggedUser.modules.length > 1}
                  />
                ) : activeModule.includes('prod') ? (
                  <ProductionModule
                    loggedUser={loggedUser}
                    station={station}
                    API_URL={PRODUCTION_API_URL}
                    onBack={() => setActiveModule(null)}
                    hasMultipleModules={loggedUser.modules && loggedUser.modules.length > 1}
                    usersForStation={usersForStation}
                  />
                ) : activeModule.includes('inci') ? (
                  <IncidentModule
                    loggedUser={loggedUser}
                    station={station}
                    onBack={() => setActiveModule(null)}
                    hasMultipleModules={(loggedUser?.modules || []).length > 1}
                  />
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                      {loggedUser.modules && loggedUser.modules.length > 1 && (
                        <button
                          onClick={() => setActiveModule(null)}
                          style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}
                        >
                          <ChevronLeft size={24} />
                        </button>
                      )}
                      <h2 className="dashboard-title" style={{ margin: 0 }}>
                        Módulo de {activeModule}
                      </h2>
                    </div>
                    <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '4rem 2rem', textAlign: 'center', border: '1px solid var(--border-color)', boxShadow: '0 4px 20px -10px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'inline-flex', background: 'var(--input-bg)', padding: '2rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                        {activeModule.includes('log') ? <Truck size={48} color="var(--primary)" /> :
                          <Factory size={48} color="var(--primary)" />}
                      </div>
                      <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Contenido de {activeModule}</h3>
                      <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Esta vista se encuentra en desarrollo.</p>
                    </div>
                  </>
                )}
              </div>
            );
          }

          const modules = loggedUser?.modules || [];
          const hasLogistica = modules.some(m => m.toLowerCase().includes('log'));
          const hasInventario = modules.some(m => m.toLowerCase().includes('inv'));
          const hasProduccion = modules.some(m => m.toLowerCase().includes('prod'));
          // El módulo separado de incidencias solo se muestra si tiene el permiso explícito
          const hasIncidencias = modules.some(m => m.toLowerCase().includes('inci'));

          return (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <h2 className="dashboard-title">Seleccione un módulo</h2>

              {modules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <AlertCircle size={48} color="var(--error)" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
                  <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Sin acceso a módulos</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>Tu usuario no tiene módulos asignados. Contacta a un administrador.</p>
                </div>
              ) : (
                <div className="modules-grid">
                  {hasLogistica && (
                    <div className="module-card logistica" onClick={() => setActiveModule('logística')}>
                      <div className="module-icon-wrapper">
                        <Truck size={40} />
                      </div>
                      <h3 className="module-title">Logística</h3>
                      <p className="module-desc">Gestión de despachos y recepciones</p>
                    </div>
                  )}

                  {hasInventario && (
                    <div className="module-card inventario" onClick={() => setActiveModule('inventario')}>
                      <div className="module-icon-wrapper">
                        <Package size={40} />
                      </div>
                      <h3 className="module-title">Inventario</h3>
                      <p className="module-desc">Control de stock y movimientos</p>
                    </div>
                  )}

                  {hasProduccion && (
                    <div className="module-card produccion" onClick={() => setActiveModule('producción')}>
                      <div className="module-icon-wrapper">
                        <Factory size={40} />
                      </div>
                      <h3 className="module-title">Producción</h3>
                      <p className="module-desc">Órdenes de trabajo y procesos</p>
                    </div>
                  )}

                  {hasIncidencias && (
                    <div className="module-card incidencias" onClick={() => setActiveModule('incidencias')}>
                      <div className="module-icon-wrapper" style={{ background: '#fef2f2', color: '#ef4444' }}>
                        <AlertTriangle size={40} />
                      </div>
                      <h3 className="module-title">Incidencias</h3>
                      <p className="module-desc">Historial y avisos de estación</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        case 'menu':
          return (
            <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '600px', margin: '0 auto', width: '100%' }}>

              <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '1.5rem', boxShadow: '0 4px 20px -10px rgba(0,0,0,0.05)' }}>
                <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '50%' }}>
                  <UserCircle2 size={56} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>{loggedUser.name}</h3>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '1.1rem' }}>{loggedUser.rol || 'Sin rol especificado'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={() => window.open(`https://wa.me/5491100000000?text=Hola,%20soy%20${encodeURIComponent(loggedUser.name)}%20y%20necesito%20ayuda%20con%20la%20aplicación%20de%20tablets`, '_blank')}
                  style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem 1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-primary)', transition: 'all 0.2s', justifyContent: 'flex-start', fontWeight: 500, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <MessageCircle size={28} color='var(--success-text)' />
                  Soporte
                </button>

                <button
                  onClick={handleInstallClick}
                  style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem 1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-primary)', transition: 'all 0.2s', justifyContent: 'flex-start', fontWeight: 500, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <Monitor size={28} color='var(--success-text)' />
                  Instalar aplicación
                </button>

                <button
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem 1.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-primary)', transition: 'all 0.2s', justifyContent: 'flex-start', fontWeight: 500, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#25D366'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <LogOut size={28} color='var(--success-text)' />
                  cerrar sesión
                </button>
              </div>
            </div>
          );
        case 'notificaciones':
          return (
            <div style={{ animation: 'fadeIn 0.3s ease-out', textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ display: 'inline-flex', background: 'var(--input-bg)', padding: '2rem', borderRadius: '50%', marginBottom: '1.5rem' }}>
                <Bell size={64} color="var(--text-secondary)" style={{ opacity: 0.5 }} />
              </div>
              <h2 className="dashboard-title" style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No hay notificaciones</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Esta función estará disponible más adelante.</p>
            </div>
          );
        default:
          return null;
      }
    };

    return (
      <div className="dashboard-container">
        <header className="dashboard-header" style={{ padding: '1rem 2rem' }}>

          <div
            className="logo-container"
            style={{ margin: 0, height: '40px', flex: '0 0 auto', cursor: 'pointer' }}
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
          >
            <img src="/logo.png" alt="M&S Logo" style={{ height: '100%' }} onError={(e) => { e.target.style.display = 'none'; }} />
          </div>

          <div className="header-info-badge station" style={{ flex: '0 0 auto', paddingRight: '0.4rem', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={18} />
              {station}
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'rgba(22, 101, 52, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#166534',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(22, 101, 52, 0.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(22, 101, 52, 0.08)'; }}
              title="cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>

        </header>

        <main className="dashboard-content" style={{ paddingBottom: '7rem' }}>
          {renderContent()}
        </main>

        {/* Floating Bottom Nav */}
        {!activeModule && (
          <nav style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '999px',
            padding: '0.5rem',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            gap: '0.25rem',
            boxShadow: '0 20px 40px -10px rgba(0, 90, 50, 0.15)',
            zIndex: 50
          }}>
            {[
              { id: 'inicio', label: 'Inicio', icon: <Home size={22} /> },
              { id: 'menu', label: 'Menú', icon: <MenuIcon size={22} /> },
              { id: 'notificaciones', label: 'Notificaciones', icon: <Bell size={22} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.875rem 1.5rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                  color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                  fontWeight: activeTab === tab.id ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  fontSize: '1rem'
                }}
                onMouseEnter={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.05)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeTab !== tab.id) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {tab.icon}
                <span style={{
                  /* Ocultar texto en pantallas super chicas si se requiere, pero por ahora lo dejamos fijo normal */
                }}>{tab.label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="auth-card" style={{ maxWidth: (!station && isAdminAuthenticated) ? '680px' : '480px', transition: 'max-width 0.3s ease' }}>
        <div className="auth-header">
          <div
            className="logo-container"
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            style={{ cursor: 'pointer' }}
          >
            {/* Logo provided by user, reading from placeholder path */}
            <img src="/logo.png" alt="Martinez Staneck Logo" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block' }} />
            <h1 style={{ color: 'var(--primary)', fontSize: '2.2rem', display: 'none' }}>M&S</h1>
          </div>
          <h1>{isAdminConfiguring || !isLocked ? 'Configuración de terminal' : 'Portal de operarios'}</h1>
        </div>

        {success && !error ? (
          <div className="success-message">
            {success}
          </div>
        ) : (!station || isAdminConfiguring) && !isAdminAuthenticated ? (
          <div className="admin-login-step">
            {!isAdminConfiguring && !isLocked && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', color: '#92400e', fontSize: '0.9rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <AlertCircle size={20} />
                Esta terminal no está configurada aún.
              </div>
            )}

            <form onSubmit={handleLogin} className="form-group" style={{ gap: '1.25rem' }}>
              <div className="form-group">
                <label>Administrador</label>
                <select
                  className="custom-select"
                  value={selectedName}
                  onChange={(e) => { setSelectedName(e.target.value); setError(''); }}
                >
                  <option value="" disabled>Seleccionar usuario...</option>
                  {users.filter(u => u.rol?.toLowerCase() === 'admin').map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                  {users.filter(u => u.rol?.toLowerCase() === 'admin').length === 0 && (
                    <option disabled>No existen administradores</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Código</label>
                <div className="input-wrapper">
                  <input
                    id="admin-code-input"
                    type={showCode ? "text" : "password"}
                    inputMode="numeric"
                    className="custom-input"
                    placeholder="Ingrese código"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ paddingRight: '3rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(!showCode)}
                    style={{
                      position: 'absolute',
                      right: '1rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      display: 'flex'
                    }}
                    title={showCode ? "Ocultar PIN" : "Mostrar PIN"}
                  >
                    {showCode ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && <div className="error-message"><AlertCircle size={16} />{error}</div>}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <div className="spinner"></div> : 'Iniciar sesión'}
              </button>
            </form>
          </div>
        ) : !station ? (
          <div className="stations-step" style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ textTransform: 'lowercase', marginBottom: '1.5rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Selecciona la estación base para esta tablet</h3>
            {allStations.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando estaciones...</div>
            ) : (
              <div className="stations-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '1rem',
                padding: '0.25rem'
              }}>
                {allStations.map(st => (
                  <div
                    key={st}
                    className="station-card"
                    onClick={() => {
                      setStation(st);
                      setIsLocked(true);
                      setIsAdminAuthenticated(false);
                      setIsAdminConfiguring(false);
                      setSelectedName('');
                      setError('');
                    }}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.75rem',
                      padding: '1.25rem 0.5rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 90, 50, 0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    {getStationIcon(st)}
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '0.2rem' }}>{st}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleLogin} className="form-group" style={{ gap: '1.25rem', animation: 'fadeIn 0.3s ease-out' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 600 }}>
                <MapPin size={18} />
                {station}
              </div>
              {/* Volver button removed for workers if locked */}
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => { setStation(''); setSelectedName(''); setError(''); }}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '0.875rem'
                  }}
                >
                  <ChevronLeft size={16} /> Volver
                </button>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="user-select">
                Operario autorizado
              </label>
              <select
                id="user-select"
                className="custom-select"
                value={selectedName}
                onChange={(e) => {
                  setSelectedName(e.target.value);
                  setError('');
                }}
              >
                <option value="" disabled>Seleccionar operario...</option>
                {usersForStation.length === 0 && <option disabled>No hay operarios habilitados aquí</option>}
                {usersForStation.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="code-input">
                Código de autorización
              </label>
              <div className="input-wrapper">
                <input
                  id="code-input"
                  type={showCode ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="custom-input"
                  placeholder="Ingrese su código"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={6}
                  autoComplete="one-time-code"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex'
                  }}
                  title={showCode ? "Ocultar código" : "Mostrar código"}
                >
                  {showCode ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading || !users.length}>
              {loading ? (
                <div className="spinner"></div>
              ) : (
                <>
                  Ingresar al sistema
                  <MoveRight size={18} />
                </>
              )}
            </button>
          </form>
        )}

        {!success && station && (
          <div className="form-group" style={{ marginTop: '0.5rem', alignItems: 'center' }}>
            <p className="info-text">¿Olvidó su código o necesita uno nuevo?</p>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleResendCode}
              disabled={loading}
            >
              <RefreshCw size={16} />
              Solicitar reenvío de código
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
