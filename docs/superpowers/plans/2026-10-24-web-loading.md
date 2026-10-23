# Web loading implementation plan

Goal: Keep the existing Two Master 5.9.62 game bytes and public URL, remove the 565 MB blocking HTML download, and prove public browser gameplay.

Architecture: Extract original embedded Unity assets during Pages deployment. Gzip independent 2 MiB chunks with content hashes. A small same-origin loader downloads eight chunks concurrently, verifies and decompresses them, caches completed chunks, and starts the unchanged Unity loader with Blob URLs. Preserve company/product identifiers and IndexedDB save synchronization.

The single HTML remains available locally and in the existing Release parts. No Unity project or gameplay changes are needed. Keep the prior deployment commit recoverable through Git history.

Tasks:
- [x] Reproduce and measure the original public loading bottleneck.
- [x] Add packaging round-trip and missing-asset tests; observe the missing packer failure.
- [x] Implement deterministic extraction and compressed chunk manifest packaging.
- [x] Verify local packaging byte parity and browser startup; exercise retry/cache behavior.
- [ ] Update deployment to package the existing verified Release HTML; publish.
- [ ] Measure public cold load, enter game, perform visible gameplay actions, and verify warm cached load.

Verification: Python unittest for byte parity and malformed input, real browser network instrumentation and screenshots, public GitHub Actions success, game startup logs, public cold/warm timings and battle screenshots. Browser plugin is not available; use bundled Playwright with installed Edge. Save evidence outside the publishing repository.

Risks to check: interrupted chunk requests, cache quota failures, corrupted cache entries, unsupported decompression APIs, GPU/WebAssembly startup, save identity, and slow public CDN connections.
