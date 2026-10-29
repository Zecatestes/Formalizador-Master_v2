import { useEffect, useRef } from 'react';

const THEME_STORAGE_KEY = 'odeen-theme';

export default function FormalizadorPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const basePath = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (typeof event.data !== 'object' || event.data === null) return;

      const message = event.data as { type?: unknown; theme?: unknown };

      if (message.type === 'odeen-formalizador:request-theme') {
        let theme = 'light';
        try {
          theme = window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
        } catch {
          // Use the default theme when browser storage is unavailable.
        }

        iframeRef.current.contentWindow?.postMessage(
          { type: 'odeen-formalizador:theme', theme },
          '*',
        );
      }

      if (
        message.type === 'odeen-formalizador:theme-change' &&
        (message.theme === 'light' || message.theme === 'dark')
      ) {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, message.theme);
        } catch {
          // Theme changes still apply inside the current document without storage.
        }
        window.dispatchEvent(new CustomEvent('odeen-theme-change', { detail: message.theme }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <section className="panel-odeen overflow-hidden" aria-label="Gerador de formalizações">
      <iframe
        ref={iframeRef}
        title="Gerador de Formalizações — ODEEN"
        src={`${basePath}formalizador-faster.html`}
        sandbox="allow-scripts allow-forms allow-modals"
        allow="clipboard-write"
        referrerPolicy="no-referrer"
        onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: 'odeen-formalizador:request-theme' }, '*')}
        className="block w-full border-0 bg-white"
        style={{ height: 'calc(100dvh - 180px)', minHeight: '720px' }}
      />
    </section>
  );
}
