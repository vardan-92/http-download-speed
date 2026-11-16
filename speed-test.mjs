import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';

const REQUEST_COUNT = 10;
const TIMEOUT_MS = 30_000;
const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

async function download(url, signal, redirectsLeft = 20) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Укажите URL с протоколом HTTP или HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Укажите URL без имени пользователя и пароля.');
  }

  const get = url.protocol === 'https:' ? httpsGet : httpGet;
  const response = await new Promise((resolve, reject) => {
    get(url, { signal }, resolve).once('error', reject);
  });

  const { statusCode, headers } = response;
  if (REDIRECT_STATUSES.includes(statusCode) && headers.location) {
    response.destroy();
    if (redirectsLeft === 0) {
      throw new Error('Слишком много перенаправлений.');
    }
    return download(new URL(headers.location, url), signal, redirectsLeft - 1);
  }
  if (statusCode < 200 || statusCode >= 300) {
    response.destroy();
    throw new Error(`HTTP ${statusCode}`);
  }

  let bytes = 0;
  for await (const chunk of response) {
    bytes += chunk.length;
  }
  return bytes;
}

async function measure(address) {
  if (!address) {
    throw new Error('Использование: node speed-test.mjs <http(s)://адрес>');
  }

  const url = new URL(address);
  let totalBytes = 0;
  let totalSeconds = 0;

  for (let attempt = 1; attempt <= REQUEST_COUNT; attempt++) {
    const startedAt = performance.now();

    try {
      totalBytes += await download(url, AbortSignal.timeout(TIMEOUT_MS));
    } catch (error) {
      throw new Error(`Запрос ${attempt} из ${REQUEST_COUNT}: ${error.message}`);
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
