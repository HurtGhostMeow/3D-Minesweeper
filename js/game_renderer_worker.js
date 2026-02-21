import * as THREE from 'https://esm.sh/three@0.180.0';
import { initialGame } from './game_minesweeper.js';

// Worker loaded
try { self.postMessage && self.postMessage({ type: 'worker-loaded' }); } catch (e) {}

// Global error handlers to surface issues to main thread
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
                // keep a reference to the OffscreenCanvas for resize fallback
                canvas = offscreen;
                // msg.width/msg.height are logical (CSS) pixels
                canvasWidth = msg.width || 800;
                canvasHeight = msg.height || 600;
                devicePixelRatio = msg.devicePixelRatio || 1;
                scene = new THREE.Scene();

                camera = new THREE.PerspectiveCamera(msg.cameraFov || 70, canvasWidth / canvasHeight, 0.1, 1000);
                camera.position.set(10, 10, 10);

                const context = offscreen.getContext('webgl2', { antialias: true }) || offscreen.getContext('webgl', { antialias: true });
                renderer = new THREE.WebGLRenderer({ canvas: offscreen, context, antialias: true, alpha: true });
                try {
                    // prefer renderer API when available
                    // renderer.setSize expects drawing buffer size: use logical * DPR
                    const drawW = Math.max(1, Math.floor(canvasWidth * devicePixelRatio));
                    const drawH = Math.max(1, Math.floor(canvasHeight * devicePixelRatio));
                    renderer.setPixelRatio(devicePixelRatio);
                    renderer.setSize(drawW, drawH, false);
                    // ensure transparent background
                    try { if (renderer.setClearColor) renderer.setClearColor(0x000000, 0); } catch (e) {}
                } catch (e) {
                    // fallback: directly set OffscreenCanvas size if renderer internals are not ready
                    try { if (canvas) { canvas.width = Math.max(1, Math.floor(canvasWidth * devicePixelRatio)); canvas.height = Math.max(1, Math.floor(canvasHeight * devicePixelRatio)); } } catch (e) {}
                }

                // basic lights
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
                scene.add(ambientLight);
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(5, 10, 7.5);
                scene.add(directionalLight);

                self.postMessage({ type: 'inited' });
                try {
                    // report initial drawing buffer size for debugging
                    const drawW = Math.max(1, Math.floor(canvasWidth * devicePixelRatio));
                    const drawH = Math.max(1, Math.floor(canvasHeight * devicePixelRatio));
                    self.postMessage({ type: 'debug-resize', drawW, drawH, devicePixelRatio });
                } catch (e) {}
                break;
            }
            case 'setMeshes': {
                // replace scene children with provided simple meshes
                // expected mesh format: { id, x,y,z, color, opacity }
                // remove previous mesh group
                while (scene.children.length > 0) {
                    scene.remove(scene.children[0]);
                }
                // re-add lights (simple approach)
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
                // find by __id
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
                // msg.width/msg.height are logical (CSS) pixels
                canvasWidth = msg.width;
                canvasHeight = msg.height;
                devicePixelRatio = msg.devicePixelRatio || devicePixelRatio || 1;
                if (camera) {
                    camera.aspect = canvasWidth / canvasHeight;
                    camera.updateProjectionMatrix();
                }
                // try renderer.setSize, otherwise set canvas width/height directly
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
                // accept camera matrix/position
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

                // clear non-light children
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

            // Note: pointer-action previously modified gameState inside the renderer worker.
            // The renderer should not mutate authoritative gameState; input handling belongs on main/logic worker.
            // We keep pointer->hit detection in the 'pointer' message case and do not mutate state here.
            case 'pointer': {
                // perform raycast
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
            case 'start': {
                // start simple loop
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
