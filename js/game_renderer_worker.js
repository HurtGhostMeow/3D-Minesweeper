import * as THREE from 'https://esm.sh/three@0.180.0';
import { initialGame } from './game_minesweeper.js';

// Worker 已加载
try { self.postMessage && self.postMessage({ type: 'worker-loaded' }); } catch (e) {}

// 全局错误处理器，将问题上报给主线程
self.addEventListener('error', (err) => {
    try { self.postMessage({ type: 'worker-error', message: err.message, filename: err.filename, lineno: err.lineno }); } catch (e) {}
});

self.addEventListener('unhandledrejection', (ev) => {
    try { self.postMessage({ type: 'worker-unhandledrejection', reason: (ev && ev.reason && ev.reason.toString) ? ev.reason.toString() : String(ev) }); } catch (e) {}
});

let canvas, renderer, scene, camera, controls;
let canvasWidth = 800, canvasHeight = 600;
let devicePixelRatio = 1;
let gameState = null;

self.addEventListener('message', async (ev) => {
    const msg = ev.data;
    try {
        switch (msg.type) {
            case 'init': {
                const offscreen = msg.canvas;
                // 保留对 OffscreenCanvas 的引用以在重置大小时回退
                canvas = offscreen;
                // msg.width/msg.height 为逻辑（CSS）像素
                canvasWidth = msg.width || 800;
                canvasHeight = msg.height || 600;
                devicePixelRatio = msg.devicePixelRatio || 1;
                scene = new THREE.Scene();

                camera = new THREE.PerspectiveCamera(msg.cameraFov || 70, canvasWidth / canvasHeight, 0.1, 1000);
                camera.position.set(10, 10, 10);

                // 尝试优先使用 WebGPU 渲染器（如果可用），否则回退到 WebGLRenderer
                try {
                    let created = false;
                    // 显式检测 navigator.gpu 支持并尝试 requestAdapter 以确认运行时支持
                    let webgpuCandidate = false;
                    try {
                        webgpuCandidate = !!(self.navigator && self.navigator.gpu);
                        self.postMessage({ type: 'debug', message: 'navigator.gpu present', value: webgpuCandidate });
                        if (webgpuCandidate) {
                            try {
                                const adapter = await self.navigator.gpu.requestAdapter();
                                self.postMessage({ type: 'debug', message: 'navigator.gpu.requestAdapter', available: !!adapter });
                                webgpuCandidate = !!adapter;
                            } catch (e) {
                                webgpuCandidate = false;
                                self.postMessage({ type: 'debug', message: 'navigator.gpu.requestAdapter failed', error: String(e) });
                            }
                        }
                    } catch (e) {
                        webgpuCandidate = false;
                        try { self.postMessage({ type: 'debug', message: 'navigator.gpu check failed', error: String(e) }); } catch (e) {}
                    }

                    if (webgpuCandidate) {
                        try {
                            // 首先尝试导入社区/本地打包的 three.webgpu 实现（用户指定），再回退到 WebGPURenderer 兼容位置
                            const candidateUrls = [
                                'https://unpkg.com/three@0.180.0/examples/jsm/renderers/three.webgpu.js',
                                'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/renderers/three.webgpu.js',
                                'https://esm.sh/three@0.180.0/examples/jsm/renderers/three.webgpu.js',
                                // 兼容旧的 WebGPURenderer 名称（仍保留作为后备）
                                'https://unpkg.com/three@0.180.0/examples/jsm/renderers/WebGPURenderer.js',
                                'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/renderers/WebGPURenderer.js',
                                // 本地相对路径备用，便于用户将实现 vendor 到仓库
                                './lib/three.webgpu.js',
                                './lib/WebGPURenderer.js'
                            ];
                            let mod = null;
                            let lastErr = null;
                            for (const url of candidateUrls) {
                                try {
                                    self.postMessage({ type: 'debug', message: 'Attempting dynamic import', url });
                                    mod = await import(url);
                                    if (mod) {
                                        self.postMessage({ type: 'debug', message: 'Dynamic import succeeded', url });
                                        break;
                                    }
                                } catch (ie) {
                                    lastErr = ie;
                                    try { self.postMessage({ type: 'debug', message: 'Dynamic import failed', url, error: String(ie) }); } catch (e) {}
                                }
                            }
                            const WebGPURenderer = mod && (mod.WebGPURenderer || mod.default);
                            if (WebGPURenderer) {
                                try {
                                    renderer = new WebGPURenderer({ canvas: offscreen, antialias: true, alpha: true });
                                    const drawW = Math.max(1, Math.floor(canvasWidth * devicePixelRatio));
                                    const drawH = Math.max(1, Math.floor(canvasHeight * devicePixelRatio));
                                    try { renderer.setPixelRatio && renderer.setPixelRatio(devicePixelRatio); } catch (e) {}
                                    try { renderer.setSize && renderer.setSize(drawW, drawH, false); } catch (e) {}
                                    self.postMessage({ type: 'debug', message: 'Using WebGPU renderer in worker' });
                                    self.postMessage({ type: 'renderer-choice', choice: 'webgpu' });
                                    created = true;
                                } catch (e) {
                                    self.postMessage({ type: 'debug', message: 'WebGPURenderer init failed', error: String(e) });
                                    created = false;
                                }
                            } else {
                                self.postMessage({ type: 'debug', message: 'WebGPURenderer module not found on any candidate', lastError: String(lastErr) });
                            }
                        } catch (e) {
                            self.postMessage({ type: 'debug', message: 'Failed to import WebGPURenderer module (general)', error: String(e) });
                        }
                    } else {
                        self.postMessage({ type: 'debug', message: 'WebGPU not available on this worker (navigator.gpu missing or adapter unavailable)' });
                    }

                    if (!created) {
                        try {
                            const context = offscreen.getContext('webgl2', { antialias: true }) || offscreen.getContext('webgl', { antialias: true });
                            renderer = new THREE.WebGLRenderer({ canvas: offscreen, context, antialias: true, alpha: true });
                            const drawW = Math.max(1, Math.floor(canvasWidth * devicePixelRatio));
                            const drawH = Math.max(1, Math.floor(canvasHeight * devicePixelRatio));
                            try { renderer.setPixelRatio(devicePixelRatio); } catch (e) {}
                            try { renderer.setSize(drawW, drawH, false); } catch (e) { try { if (offscreen) { offscreen.width = drawW; offscreen.height = drawH; } } catch (e) {} }
                            try { if (renderer.setClearColor) renderer.setClearColor(0x000000, 0); } catch (e) {}
                            self.postMessage({ type: 'debug', message: 'Using WebGL renderer in worker' });
                            self.postMessage({ type: 'renderer-choice', choice: 'webgl' });
                        } catch (e) {
                            self.postMessage({ type: 'debug', message: 'Failed to create WebGL renderer in worker', error: String(e) });
                            try { if (offscreen) { offscreen.width = Math.max(1, Math.floor(canvasWidth * devicePixelRatio)); offscreen.height = Math.max(1, Math.floor(canvasHeight * devicePixelRatio)); } } catch (e) {}
                        }
                    }
                } catch (e) {
                    try { self.postMessage({ type: 'debug', message: 'Renderer selection failed', error: String(e) }); } catch (e) {}
                    try { if (offscreen) { offscreen.width = Math.max(1, Math.floor(canvasWidth * devicePixelRatio)); offscreen.height = Math.max(1, Math.floor(canvasHeight * devicePixelRatio)); } } catch (e) {}
                }

                // 基本灯光
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                scene.add(ambientLight);
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(5, 10, 7.5);
                scene.add(directionalLight);

                self.postMessage({ type: 'inited' });
                try {
                    // 报告初始绘图缓冲区尺寸以便调试
                    const drawW = Math.max(1, Math.floor(canvasWidth * devicePixelRatio));
                    const drawH = Math.max(1, Math.floor(canvasHeight * devicePixelRatio));
                    self.postMessage({ type: 'debug-resize', drawW, drawH, devicePixelRatio });
                } catch (e) {}
                break;
            }
            case 'setMeshes': {
                // 使用提供的简化网格替换场景子对象
                // 期望的网格格式：{ id, x,y,z, color, opacity }
                // 移除之前的网格组
                while (scene.children.length > 0) {
                    scene.remove(scene.children[0]);
                }
                // 重新添加灯光（简单处理）
                const ambient = new THREE.AmbientLight(0xffffff, 0.6);
                scene.add(ambient);
                const dir = new THREE.DirectionalLight(0xffffff, 0.8);
                dir.position.set(5, 10, 7.5);
                scene.add(dir);

                const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
                for (const m of msg.meshes || []) {
                    const mat = new THREE.MeshStandardMaterial({ color: m.color || 0x999999, transparent: (m.opacity !== undefined ? m.opacity : 1.0) < 1, opacity: m.opacity !== undefined ? m.opacity : 1.0 });
                    // for correct blending, disable depthWrite when semi-transparent
                    if (mat.opacity < 1) { mat.depthWrite = false; }
                    mat.needsUpdate = true;
                    const mesh = new THREE.Mesh(boxGeo, mat);
                    mesh.position.set(m.posX || 0, m.posY || 0, m.posZ || 0);
                    mesh.userData = m.userData || {};
                    mesh.userData.__id = m.id;
                    scene.add(mesh);
                }
                break;
            }
            case 'updateMesh': {
                // 按 __id 查找
                const id = msg.id;
                const found = scene.children.find(c => c.userData && c.userData.__id === id);
                if (found) {
                    if (msg.position) found.position.set(msg.position.x, msg.position.y, msg.position.z);
                    if (msg.color !== undefined && found.material) found.material.color.set(msg.color);
                    if (msg.opacity !== undefined && found.material) {
                        found.material.transparent = msg.opacity < 1;
                        found.material.opacity = msg.opacity;
                        found.material.depthWrite = msg.opacity >= 1;
                        found.material.needsUpdate = true;
                    }
                }
                break;
            }
            case 'removeMesh': {
                const id = msg.id;
                const found = scene.children.find(c => c.userData && c.userData.__id === id);
                if (found && found.parent) found.parent.remove(found);
                break;
            }
            case 'resize': {
                // msg.width/msg.height 为逻辑（CSS）像素
                canvasWidth = msg.width;
                canvasHeight = msg.height;
                devicePixelRatio = msg.devicePixelRatio || devicePixelRatio || 1;
                if (camera) {
                    camera.aspect = canvasWidth / canvasHeight;
                    camera.updateProjectionMatrix();
                }
                // 尝试 renderer.setSize，否则直接设置 canvas 宽高
                try {
                    if (renderer && renderer.setSize) {
                        const drawW = Math.max(1, Math.floor(canvasWidth * devicePixelRatio));
                        const drawH = Math.max(1, Math.floor(canvasHeight * devicePixelRatio));
                        if (renderer.setPixelRatio) renderer.setPixelRatio(devicePixelRatio);
                        renderer.setSize(drawW, drawH, false);
                        try { self.postMessage({ type: 'debug-resize', drawW, drawH, devicePixelRatio }); } catch (e) {}
                    } else if (canvas) { canvas.width = Math.max(1, Math.floor(canvasWidth * devicePixelRatio)); canvas.height = Math.max(1, Math.floor(canvasHeight * devicePixelRatio)); }
                } catch (e) {
                    try { if (canvas) { canvas.width = canvasWidth; canvas.height = canvasHeight; } } catch (e) {}
                }
                break;
            }
            case 'camera': {
                // 接受相机矩阵/位置
                if (msg.matrix) {
                    camera.matrix.fromArray(msg.matrix);
                    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale);
                    if (msg.target) {
                        try { camera.lookAt(new THREE.Vector3(msg.target.x, msg.target.y, msg.target.z)); } catch (e) {}
                    }
                } else if (msg.position) {
                    camera.position.set(msg.position.x, msg.position.y, msg.position.z);
                    if (msg.lookAt) camera.lookAt(new THREE.Vector3(msg.lookAt.x, msg.lookAt.y, msg.lookAt.z));
                }
                break;
            }
            case 'startGame': {
                const size = msg.size || 3;
                const mines = msg.mines || 3;
                gameState = initialGame(size, mines);

                // 清除非灯光子对象
                scene.children = scene.children.filter(c => (c.type && (c.type === 'AmbientLight' || c.type === 'DirectionalLight')));
                const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
                const spacing = 2.2;
                const offset = (size - 1) * spacing / 2;
                for (let x = 0; x < size; x++) {
                    for (let y = 0; y < size; y++) {
                        for (let z = 0; z < size; z++) {
                            const cell = gameState.grid[x][y][z];
                            if (cell && cell.isRealved && cell.neighborMines === 0) continue;
                            const id = `${x}_${y}_${z}`;
                            const posX = (x * spacing) - offset;
                            const posY = (y * spacing) - offset;
                            const posZ = (z * spacing) - offset;
                            const mat = new THREE.MeshStandardMaterial({ color: 0x999999, transparent: false, opacity: 1 });
                            const mesh = new THREE.Mesh(boxGeo, mat);
                            mesh.position.set(posX, posY, posZ);
                            mesh.userData = { x, y, z, __id: id };
                            scene.add(mesh);
                        }
                    }
                }
                try { self.postMessage({ type: 'game-started', length: gameState.length, mineCount: gameState.mineCount }); } catch (e) {}
                try { self.postMessage({ type: 'ui-update', state: { length: gameState.length, mineCount: gameState.mineCount, flagged: gameState.flagged, realved: gameState.realved, gameOver: gameState.gameOver, gameWon: gameState.gameWon } }); } catch (e) {}
                try { self.postMessage({ type: 'save-state', state: gameState }); } catch (e) {}
                break;
            }

            // 注意：之前的 pointer-action 会在渲染 worker 内修改 gameState
            // 渲染器不应修改权威的 gameState；输入处理应由主线程/逻辑 worker 负责。
            // 我们在 'pointer' 消息中保留命中检测，但不在此处修改状态。
            case 'pointer': {
                // 执行射线检测
                const rect = msg.rect || { left: 0, top: 0, width: canvasWidth, height: canvasHeight };
                const x = ((msg.clientX - rect.left) / rect.width) * 2 - 1;
                const y = -((msg.clientY - rect.top) / rect.height) * 2 + 1;
                const mouse = new THREE.Vector2(x, y);
                const raycaster = new THREE.Raycaster();
                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObjects(scene.children.filter(c => c.userData && c.userData.__id), false);
                if (intersects && intersects.length) {
                    const first = intersects[0];
                    self.postMessage({ type: 'pointer-result', hit: true, id: first.object.userData.__id, userData: first.object.userData });
                } else {
                    self.postMessage({ type: 'pointer-result', hit: false });
                }
                break;
            }
            case 'ping': {
                try { self.postMessage({ type: 'pong' }); } catch (e) {}
                break;
            }
            case 'start': {
                // 启动简单循环
                let running = true;
                const raf = (typeof self.requestAnimationFrame === 'function') ? ((fn) => self.requestAnimationFrame(fn)) : ((fn) => setTimeout(fn, 16));
                const loop = () => {
                    if (!running) return;
                    try { if (renderer && scene && camera) renderer.render(scene, camera); } catch (e) { try { self.postMessage({ type: 'worker-error', message: String(e) }); } catch (e2) {} }
                    try { raf(loop); } catch (e) { setTimeout(loop, 16); }
                };
                loop();
                break;
            }
        }
    } catch (e) {
        console.error('Worker error handling message', e);
    }
});
