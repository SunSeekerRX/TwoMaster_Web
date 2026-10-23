# Web loading implementation plan

Goal: Keep the existing Two Master 5.9.62 game bytes and public URL, remove the 565 MB blocking HTML download, and prove public browser gameplay.

Architecture: Extract original embedded Unity assets during Pages deployment. Gzip independent 2 MiB chunks with content hashes. A small same-origin loader downloads eight chunks concurrently, verifies and decompresses them, caches completed chunks, and starts the unchanged Unity loader with Blob URLs. Preserve company/product identifiers and IndexedDB save synchronization.

The single HTML remains available locally and in the existing Release parts. No Unity project or gameplay changes are needed. Keep the prior deployment commit recoverable through Git history.

Tasks:
- [x] Reproduce and measure the original public loading bottleneck.
- [x] Add packaging round-trip and missing-asset tests; observe the missing packer failure.
- [x] Implement deterministic extraction and compressed chunk manifest packaging.
- [x] Verify local packaging byte parity and browser startup; exercise retry/cache behavior.
- [x] Update deployment to package the existing verified Release HTML; publish.
- [x] Measure public cold load, enter game, perform visible gameplay actions, and verify warm cached load.

Result: Public Edge cold navigation to menu 653.2 seconds on this connection (365,759,498 compressed game bytes, zero retries). Cached public reload 8.21 seconds including HTML/scripts, zero game resource network bytes. One-hero AI match, supply selection, drag/target casting (AP 4 to 3 and shield +3), AI turn and player turn 3, and saved battle restoration all passed with no runtime errors. Independent code review found no blocking issues. Evidence is stored outside this repository in Two Master/outputs/github-publish/public-acceptance.json and screenshots.

Verification: Python unittest for byte parity and malformed input, real browser network instrumentation and screenshots, public GitHub Actions success, game startup logs, public cold/warm timings and battle screenshots. Browser plugin is not available; use bundled Playwright with installed Edge. Save evidence outside the publishing repository.

Risks to check: interrupted chunk requests, cache quota failures, corrupted cache entries, unsupported decompression APIs, GPU/WebAssembly startup, save identity, and slow public CDN connections.
