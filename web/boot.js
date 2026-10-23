/* Game binaries are unchanged. Only download, recovery and caching happen here. */
(() => {
  'use strict';
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const retry = document.getElementById('retry');
  const metrics = window.twoMasterLoad = { startedAt: performance.now(), networkBytes: 0, cachedBytes: 0, retries: 0 };
  const blobUrls = [];
  const loaded = new Map();
  let cache;
  let total = 1;
  const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const checksum = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
  const paint = () => {
    const current = Array.from(loaded.values()).reduce((sum, value) => sum + value, 0);
    progress.value = Math.min(current / total, 1);
    status.textContent = `正在准备游戏资源 ${Math.floor(current / 1048576)} / ${Math.ceil(total / 1048576)} MB（${Math.floor(progress.value * 100)}%）`;
  };

  async function download(chunk) {
    if (cache) {
      try {
        const hit = await cache.match(chunk.url);
        if (hit) {
          const bytes = new Uint8Array(await hit.arrayBuffer());
          if (bytes.length === chunk.compressedSize && await checksum(bytes) === chunk.sha256) {
            loaded.set(chunk.url, bytes.length); metrics.cachedBytes += bytes.length; paint();
            return bytes;
          }
          await cache.delete(chunk.url);
        }
      } catch (error) { console.warn('Resource cache unavailable:', error.message); cache = null; }
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const abort = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 45000);
      try {
        loaded.set(chunk.url, 0);
        const response = await fetch(chunk.url, { signal: abort.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const reader = response.body.getReader();
        const pieces = [];
        let length = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          pieces.push(value); length += value.length; metrics.networkBytes += value.length;
          loaded.set(chunk.url, Math.min(length, chunk.compressedSize)); paint();
        }
        if (length !== chunk.compressedSize) throw new Error('资源下载不完整');
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const piece of pieces) { bytes.set(piece, offset); offset += piece.length; }
        if (await checksum(bytes) !== chunk.sha256) throw new Error('资源校验未通过');
        if (cache) {
          try { await cache.put(chunk.url, new Response(bytes)); }
          catch (error) { console.warn('Resource cache write skipped:', error.message); cache = null; }
        }
        return bytes;
      } catch (error) {
        loaded.delete(chunk.url); paint();
        if (attempt === 3) throw new Error('部分资源下载失败，请点击“继续加载”重试。已完成的资源可以继续使用。', { cause: error });
        metrics.retries++;
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 800));
      } finally { clearTimeout(timeout); }
    }
  }

  async function start() {
    if (!window.DecompressionStream || !crypto.subtle) throw new Error('此浏览器不支持游戏资源解压，请使用新版 Edge 或 Chrome。');
    try { cache = await caches.open('two-master-web-assets-v1'); }
    catch (error) { console.warn('Resource cache unavailable:', error.message); }
    const response = await fetch('manifest.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('无法读取游戏资源清单，请重试。');
    const manifest = await response.json();
    const keys = ['codeUrl', 'frameworkUrl', 'dataUrl'];
    const buffers = {};
    const tasks = [];
    total = 0;
    for (const key of keys) {
      const asset = manifest.assets[key];
      buffers[key] = new Uint8Array(asset.size);
      for (const chunk of asset.chunks) { tasks.push({ key, chunk }); total += chunk.compressedSize; }
    }
    paint();
    let cursor = 0;
    let failure;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (!failure && cursor < tasks.length) {
        const { key, chunk } = tasks[cursor++];
        try {
          const bytes = await download(chunk);
          const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
          const unpacked = new Uint8Array(await new Response(stream).arrayBuffer());
          if (unpacked.length !== chunk.size) throw new Error('资源解压长度不一致');
          buffers[key].set(unpacked, chunk.offset);
        } catch (error) { failure = error; }
      }
    }));
    if (failure) throw failure;
    metrics.downloadFinishedAt = performance.now();
    console.log('TWO_MASTER_ASSETS_READY', JSON.stringify(metrics));
    const urls = {};
    for (const key of keys) {
      urls[key] = URL.createObjectURL(new Blob([buffers[key]], { type: manifest.assets[key].mime }));
      blobUrls.push(urls[key]);
      delete buffers[key];
    }
    status.textContent = '资源已就绪，正在启动游戏…';
    progress.value = 0;
    window.game = await createUnityInstance(document.getElementById('game'), {
      companyName: 'Independent Arcana', productName: 'Two Master Cast59', productVersion: '5.9.62',
      streamingAssetsUrl: '', autoSyncPersistentDataPath: true, matchWebGLToCanvasSize: true, ...urls
    }, value => { progress.value = value; status.textContent = `正在启动游戏 ${Math.round(value * 100)}%`; });
    metrics.readyAt = performance.now();
    console.log('TWO_MASTER_WEB_READY', JSON.stringify(metrics));
    document.getElementById('loading').remove();
    document.getElementById('game').focus();
  }
  retry.addEventListener('click', () => location.reload());
  start().catch(error => {
    console.error('TWO_MASTER_LOAD_FAILED', error);
    status.textContent = error.message || String(error);
    retry.hidden = false;
  }).finally(() => { for (const url of blobUrls) URL.revokeObjectURL(url); });
})();
