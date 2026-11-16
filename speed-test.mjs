import { performance } from 'node:perf_hooks';

const REQUEST_COUNT = 10;
const TIMEOUT_MS = 30_000;

async function measure(address) {
  if (!address) {
    throw new Error('Использование: node speed-test.mjs <http(s)://адрес>');
  }

  const url = new URL(address);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Укажите URL с протоколом HTTP или HTTPS.');
  }

  let totalBytes = 0;
  let totalSeconds = 0;

  for (let attempt = 1; attempt <= REQUEST_COUNT; attempt++) {
    const startedAt = performance.now();

    try {
      const response = await fetch(url, {
        headers: { 'Accept-Encoding': 'identity' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      }

      for await (const chunk of response.body ?? []) {
        totalBytes += chunk.byteLength;
      }
    } catch (error) {
      const message = error.cause?.message ?? error.message;
      throw new Error(`Запрос ${attempt} из ${REQUEST_COUNT}: ${message}`);
    }

    totalSeconds += (performance.now() - startedAt) / 1_000;
  }

  const averageMs = (totalSeconds * 1_000) / REQUEST_COUNT;
  const speedMbps = (totalBytes * 8) / (totalSeconds * 1_000_000);

  console.log(`Среднее время запроса: ${averageMs.toFixed(2)} мс`);
  console.log(`Общий объём: ${totalBytes} байт`);
  console.log(`Скорость скачивания: ${speedMbps.toFixed(2)} Мбит/с`);
}

try {
  await measure(process.argv[2]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
