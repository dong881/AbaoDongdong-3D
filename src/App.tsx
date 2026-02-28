import { useCallback, useEffect, useState } from 'react';
import { CanvasContainer } from './components/CanvasContainer';
import { initGapiClient, initTokenClient, requestAccessToken, listFiles, revokeAllBlobUrls } from './utils/GoogleDriveManager';
import { useExperienceStore } from './store';
import type { DriveFile } from './store';
import './App.css';

type InitStatus = 'IDLE' | 'INIT' | 'READY' | 'ERROR';

function App() {
  const setPhotos = useExperienceStore((s) => s.setPhotos);
  const setMode = useExperienceStore((s) => s.setMode);
  const mode = useExperienceStore((s) => s.mode);

  const [initStatus, setInitStatus] = useState<InitStatus>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  const loadFiles = useCallback(async () => {
    try {
      const files = await listFiles();
      if (files.length === 0) {
        setErrorMsg('No photos found in the folder.');
      } else {
        setPhotos(files as DriveFile[]);
        setMode('TREE');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('Error loading photos:', e);
      setErrorMsg(`Error loading photos: ${message}`);
    }
  }, [setPhotos, setMode]);

  useEffect(() => {
    const start = async () => {
      try {
        setInitStatus('INIT');
        await initGapiClient();

        initTokenClient(() => {
          setIsAuthorized(true);
          loadFiles();
        });

        setInitStatus('READY');
      } catch (e) {
        console.error('Google API init failed:', e);
        setInitStatus('ERROR');
        setErrorMsg('Failed to initialize Google API');
      }
    };
    start();

    return () => {
      revokeAllBlobUrls();
    };
  }, [loadFiles]);

  const handleStart = useCallback(() => {
    requestAccessToken();
  }, []);

  if (mode !== 'LOADING') {
    return <CanvasContainer />;
  }

  return (
    <div className="landing-screen">
      <div className="content">
        <h1>3rd Anniversary &amp; Christmas</h1>
        <p>A romantic gift for Abao from Dongdong</p>

        {initStatus === 'INIT' && <p aria-live="polite">Connecting to Services...</p>}
        {initStatus === 'ERROR' && <p className="error" role="alert">{errorMsg}</p>}
        {initStatus === 'READY' && (
          <button
            className="start-btn"
            onClick={handleStart}
            aria-label={isAuthorized ? 'Loading memories' : 'Connect and open gift'}
            disabled={isAuthorized}
          >
            {isAuthorized ? 'Loading Memories...' : 'Connect & Open Gift 🎁'}
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
