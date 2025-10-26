/**
 * Helper para polling de generaciones
 * Reutilizable en todas las páginas de generación
 */

export interface PollingOptions {
  jobId: string;
  statusEndpoint: string;
  onProgress?: (progress: number) => void;
  onComplete: (resultUrl: string) => void;
  onError: (error: string) => void;
  pollInterval?: number; // ms, default 5000
  timeout?: number; // ms, default 300000 (5 min)
}

export function startPolling(options: PollingOptions) {
  const {
    jobId,
    statusEndpoint,
    onProgress,
    onComplete,
    onError,
    pollInterval = 5000,
    timeout = 300000,
  } = options;

  let progressValue = 10;

  // Simular progreso mientras se procesa
  const progressInterval = setInterval(() => {
    if (onProgress && progressValue < 90) {
      progressValue += 5;
      onProgress(progressValue);
    }
  }, 3000);

  // Polling del status
  const pollIntervalId = setInterval(async () => {
    try {
      const statusResponse = await fetch(`${statusEndpoint}/${jobId}`);

      if (!statusResponse.ok) {
        clearInterval(pollIntervalId);
        clearInterval(progressInterval);
        onError('Failed to check status');
        return;
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'completed') {
        clearInterval(pollIntervalId);
        clearInterval(progressInterval);
        if (onProgress) onProgress(100);
        onComplete(statusData.result_url);
      } else if (statusData.status === 'failed') {
        clearInterval(pollIntervalId);
        clearInterval(progressInterval);
        onError(statusData.error_message || 'Generation failed');
      }
      // Si está en 'processing', continuar polling
    } catch (pollError) {
      console.error('Polling error:', pollError);
    }
  }, pollInterval);

  // Timeout
  const timeoutId = setTimeout(() => {
    clearInterval(pollIntervalId);
    clearInterval(progressInterval);
    onError('Tiempo de espera agotado. Revisa el historial más tarde.');
  }, timeout);

  // Retornar función de cleanup
  return () => {
    clearInterval(pollIntervalId);
    clearInterval(progressInterval);
    clearTimeout(timeoutId);
  };
}

/**
 * Helper para manejar errores de créditos
 */
export function handleCreditsError(
  errorData: any,
  router: any,
  toast: any
): boolean {
  if (errorData.required) {
    toast.error(
      `Créditos insuficientes. Necesitas ${errorData.required} créditos.`
    );
    setTimeout(() => router.push('/configuracion'), 2000);
    return true;
  }
  return false;
}

/**
 * Helper para iniciar generación con manejo completo
 */
export async function startGeneration(
  endpoint: string,
  data: any,
  options: {
    router: any;
    toast: any;
    onStart: () => void;
    onProgress?: (progress: number) => void;
    onComplete: (resultUrl: string) => void;
    onError: (error: string) => void;
    onFinally: () => void;
  }
) {
  const { router, toast, onStart, onProgress, onComplete, onError, onFinally } =
    options;

  onStart();

  try {
    // Iniciar generación
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();

      // Manejar error de créditos
      if (response.status === 402) {
        handleCreditsError(errorData, router, toast);
        onFinally();
        return;
      }

      throw new Error(errorData.error || 'Generation failed');
    }

    const responseData = await response.json();
    const { jobId } = responseData;

    // Iniciar polling
    const cleanup = startPolling({
      jobId,
      statusEndpoint: endpoint.replace('/generate', '/status'),
      onProgress,
      onComplete: (resultUrl) => {
        onComplete(resultUrl);
        onFinally();
      },
      onError: (error) => {
        onError(error);
        onFinally();
      },
    });

    // Retornar cleanup para poder cancelar si es necesario
    return cleanup;
  } catch (error: any) {
    console.error('Generation error:', error);
    onError(error.message || 'Error al generar');
    onFinally();
  }
}

