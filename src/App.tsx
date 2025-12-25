import { useEffect, useState } from 'react';
import { CanvasContainer } from './components/CanvasContainer';
import { initGapiClient, initTokenClient, requestAccessToken, listFiles } from './utils/GoogleDriveManager';
import { useExperienceStore } from './store';
import './App.css';

function App() {
  const { setPhotos, setMode, mode } = useExperienceStore();
  const [initStatus, setInitStatus] = useState<'IDLE' | 'INIT' | 'READY' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const start = async () => {
      try {
        setInitStatus('INIT');
        await initGapiClient();

        // Setup Token Client
        initTokenClient((_tokenResponse) => {
          setIsAuthorized(true);
          // Load files immediately after auth
          loadFiles();
        });

        setInitStatus('READY');
      } catch (e) {
        console.error(e);
        setInitStatus('ERROR');
        setErrorMsg('Failed to initialize Google API');
      }
    };
    start();
  }, []);

  const loadFiles = async () => {
    try {
      const files = await listFiles();
      if (files.length === 0) {
        alert("No photos found in the folder!");
      } else {
        setPhotos(files as any);
        setMode('TREE');
      }
    } catch (e: any) {
      console.error(e);
      alert(`Error loading photos: ${e.message || e}`);
    }
  }

  const handleStart = () => {
    requestAccessToken();
  };

  if (mode !== 'LOADING') {
    return <CanvasContainer />;
  }

  return (
    <div className="landing-screen">
      <div className="content">
        <h1>3rd Anniversary & Christmas</h1>
        <p>A romantic gift for Abao from Dongdong</p>

        {initStatus === 'INIT' && <p>Connecting to Services...</p>}
        {initStatus === 'ERROR' && <p className="error">{errorMsg}</p>}
        {initStatus === 'READY' && (
          <button className="start-btn" onClick={handleStart}>
            {isAuthorized ? "Loading Memories..." : "Connect & Open Gift 🎁"}
          </button>
        )}

        <div className="instructions">
          <p className="hint">Allow Camera Access for Magic Controls</p>
        </div>
      </div>
    </div>
  );
}

export default App;
