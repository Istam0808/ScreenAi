'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import styles from '@/app/page.module.scss';

function captureScreen(bounds) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.electron?.getScreenSourceForPoint && !window.electron?.getScreenSources) {
      reject(new Error('Не в среде Electron'));
      return;
    }
    const centerX = bounds ? (bounds.x || 0) + (bounds.width || 0) / 2 : 0;
    const centerY = bounds ? (bounds.y || 0) + (bounds.height || 0) / 2 : 0;
    const getSourceId = window.electron.getScreenSourceForPoint
      ? () => window.electron.getScreenSourceForPoint(centerX, centerY)
      : () => window.electron.getScreenSources().then((s) => (s[0] ? s[0].id : null));

    getSourceId().then((sourceId) => {
      if (!sourceId) {
        reject(new Error('Нет доступа к экрану'));
        return;
      }
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        },
      }).then((stream) => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
          const fullCanvas = document.createElement('canvas');
          fullCanvas.width = video.videoWidth;
          fullCanvas.height = video.videoHeight;
          const fullCtx = fullCanvas.getContext('2d');
          fullCtx.drawImage(video, 0, 0);
          stream.getTracks().forEach((t) => t.stop());

          if (bounds && bounds.width > 0 && bounds.height > 0) {
            const dpr = bounds.devicePixelRatio || 1;
            const x = Math.round((bounds.x || 0) * dpr);
            const y = Math.round((bounds.y || 0) * dpr);
            const w = Math.round((bounds.width || 0) * dpr);
            const h = Math.round((bounds.height || 0) * dpr);
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = w;
            cropCanvas.height = h;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(fullCanvas, x, y, w, h, 0, 0, w, h);
            resolve(cropCanvas.toDataURL('image/png'));
          } else {
            resolve(fullCanvas.toDataURL('image/png'));
          }
        };
        video.onerror = () => {
          stream.getTracks().forEach((t) => t.stop());
          reject(new Error('Ошибка захвата видео'));
        };
      }).catch(reject);
    }).catch(reject);
  });
}

/** Проверяет, не является ли изображение в основном чёрным (типично для захвата окна Chrome с аппаратным ускорением). */
function isImageMostlyBlack(dataUrl, sampleSize = 20, blackThreshold = 25) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = Math.min(img.width, 400);
      const h = Math.min(img.height, 400);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const step = Math.max(1, Math.floor((w * h) / (sampleSize * sampleSize)));
      let sum = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += step * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        sum += (r + g + b) / 3;
        count += 1;
      }
      const avg = count ? sum / count : 0;
      resolve(avg <= blackThreshold);
    };
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

async function analyzeImage(dataUrl) {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Ошибка ${res.status}`);
  }
  const data = await res.json();
  return data.text || '';
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleSentHint, setGoogleSentHint] = useState('');
  const [screenshotIsBlack, setScreenshotIsBlack] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const runCaptureAndAnalyze = useCallback(async (bounds) => {
    setError('');
    setLoading(true);
    setScreenshot(null);
    setAnalysis('');
    setGoogleSentHint('');
    setScreenshotIsBlack(false);
    try {
      const dataUrl = await captureScreen(bounds);
      setScreenshot(dataUrl);
      const black = await isImageMostlyBlack(dataUrl);
      setScreenshotIsBlack(black);
      const text = await analyzeImage(dataUrl);
      setAnalysis(text);
    } catch (e) {
      setError(e?.message || 'Произошла ошибка');
    } finally {
      setLoading(false);
      // Показываем окно только после захвата, чтобы не перекрывать экран (например, Google в браузере)
      if (typeof window !== 'undefined' && window.electron?.showMainWindow) {
        window.electron.showMainWindow();
      }
    }
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined' || !window.electron) return;
    if (window.electron.onCaptureRegion) {
      window.electron.onCaptureRegion((bounds) => {
        // Задержка, чтобы окно захвата закрылось и экран (в т.ч. Chrome/Google) успел перерисоваться
        setTimeout(() => runCaptureAndAnalyze(bounds), 600);
      });
    }
    if (window.electron.onScreenshotRequest) {
      window.electron.onScreenshotRequest(() => runCaptureAndAnalyze(null));
    }
  }, [mounted, runCaptureAndAnalyze]);

  const isElectron = mounted && typeof window !== 'undefined' && !!window.electron;

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>ScreenAI</h1>
        <nav className={styles.nav}>
          <Link href="/settings" className={styles.link}>Настройки</Link>
        </nav>
      </header>

      <section className={styles.welcome}>
        <h2 className={styles.welcomeTitle}>Главный экран</h2>
        <p className={styles.hint}>
          {isElectron
            ? 'Нажмите Ctrl+Home — экран затемнится, выделите область мышью. Esc — отмена. Выделенная область отправится в Google AI.'
            : 'Запустите приложение через Electron (npm run electron:dev), чтобы использовать захват экрана.'}
        </p>
        {isElectron && (
          <p className={styles.hintSmall}>
            Если вкладка Google/Chrome на скриншоте чёрная — отключите в Chrome «Использовать аппаратное ускорение»: Настройки → Система → перезапустите браузер.
          </p>
        )}
      </section>

      {loading && <p className={styles.loading}>Захват экрана и анализ…</p>}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.content}>
        {screenshot && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Скриншот</h2>
            {screenshotIsBlack && (
              <div className={styles.chromeFixTip} role="alert">
                <strong>На скриншоте не видно содержимое вкладки (чёрный экран).</strong>
                <br />
                Так бывает при захвате окна Chrome. Отключите аппаратное ускорение: <strong>Chrome → Настройки → Система</strong> → снимите «Использовать аппаратное ускорение» → перезапустите Chrome.
              </div>
            )}
            <img src={screenshot} alt="Скриншот" className={styles.preview} />
            {isElectron && (
              <>
                <button
                  type="button"
                  className={styles.googleBtn}
                  onClick={async () => {
                    setGoogleSentHint('');
                    const result = await window.electron.openGoogleWithScreenshot(screenshot);
                    if (result?.ok) {
                      setGoogleSentHint('Открыто окно Google Lens. Через пару секунд изображение вставится автоматически.');
                    } else {
                      setGoogleSentHint(result?.error || 'Не удалось открыть Google');
                    }
                  }}
                >
                  Открыть в Google AI (Lens)
                </button>
                {googleSentHint && (
                  <p className={styles.googleHint}>{googleSentHint}</p>
                )}
              </>
            )}
          </section>
        )}
        {analysis && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Анализ Google AI</h2>
            <div className={styles.analysis}>{analysis}</div>
          </section>
        )}
      </div>
    </main>
  );
}
