import * as THREE from 'https://esm.sh/three@0.180.0'; // 导入 ThreeJS
import { OrbitControls } from 'https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js'; // 导入轨道控制器
import { highlightModule } from "./show_module.js";

const light = highlightModule('game-renderer-js');

let worker = null;
let canvasEl = null;
let placeholder = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    raycaster: null,
    mouse: null
};
let _dprMql = null;
let _resizeObserver = null;
let _visualViewportHandler = null;

function ensureWorker(canvas) {
    if (worker) return worker;
    const workerUrl = new URL('./game_renderer_worker.js', import.meta.url).href;
    console.log('Creating renderer Worker ->', workerUrl);
    worker = new Worker(workerUrl, { type: 'module' });
    worker.addEventListener('message', (ev) => {
        const msg = ev.data;
        console.log('Renderer worker message:', msg && msg.type);
        if (msg.type === 'inited') {
            console.log('Renderer worker initialized');
        }
        if (msg.type === 'worker-loaded') {
            console.log('Renderer worker script loaded');
        }
        if (msg.type === 'worker-error' || msg.type === 'worker-unhandledrejection') {
            console.error('Renderer worker reported error:', msg);
        }
        // re-dispatch useful worker events to the window for the app to consume
        if (msg.type === 'pointer-result' || msg.type === 'ui-update' || msg.type === 'save-state' || msg.type === 'game-started' || msg.type === 'ui-error') {
            try { window.dispatchEvent(new CustomEvent('renderer-worker-event', { detail: msg })); } catch (e) {}
        }
    });
    // surface load/parse errors
    worker.addEventListener('error', (ev) => {
        try {
            console.error('Renderer worker load/parse error:', ev.message, ev.filename || ev.fileName, ev.lineno || ev.lineno, ev.colno || ev.colno, ev.error || ev);
        } catch (e) { console.error('Renderer worker load/parse error (fallback):', ev); }
    });
    worker.addEventListener('messageerror', (ev) => {
        console.error('Renderer worker messageerror:', ev);
    });
    return worker;
}

export function isWorkerActive() {
    return !!worker;
}

// 初始化游戏场景：创建 worker 并把 canvas 转为 OffscreenCanvas
export function initGameScene(){
    light.on();
    const container = document.getElementById('game-container');
    const canvas = document.getElementById('game-canvas');
    canvasEl = canvas;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let w = null;
    try {
        w = ensureWorker(canvas);
    } catch (e) {
        console.error('Failed to create worker:', e);
    }

    let usedOffscreen = false;
    if (w) {
        try {
            const offscreen = canvas.transferControlToOffscreen();
            // send logical (CSS) size to worker; worker will multiply by DPR for drawing buffer
            const logicalW = container.clientWidth || container.offsetWidth;
            const logicalH = container.clientHeight || container.offsetHeight;
            // ensure canvas CSS matches container so getBoundingClientRect remains accurate
            try { canvas.style.width = logicalW + 'px'; canvas.style.height = logicalH + 'px'; } catch (e) {}
            w.postMessage({ type: 'init', canvas: offscreen, width: logicalW, height: logicalH, cameraFov: 70, devicePixelRatio: window.devicePixelRatio }, [offscreen]);
            usedOffscreen = true;
        } catch (e) {
            console.error('OffscreenCanvas not supported or transfer failed:', e);
            usedOffscreen = false;
        }
    }

    // If offscreen transfer failed, create a main-thread renderer as fallback
    let mainRenderer = null;
    if (!usedOffscreen) {
        try {
            mainRenderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
            // Use logical (CSS) size and set pixel ratio first to ensure drawing buffer scales correctly
            const logicalW = container.clientWidth || container.offsetWidth;
            const logicalH = container.clientHeight || container.offsetHeight;
            try { mainRenderer.setPixelRatio(window.devicePixelRatio || 1); } catch (e) {}
            try { mainRenderer.setSize(logicalW, logicalH, false); } catch (e) { mainRenderer.setSize(container.offsetWidth, container.offsetHeight); }
            try { mainRenderer.setClearColor(0x000000, 0); } catch (e) {}
            console.log('Using main-thread WebGLRenderer fallback');
        } catch (e) {
            console.error('Failed to create main-thread renderer fallback:', e);
        }
    }

    controls.addEventListener('change', () => {
        try { w.postMessage({ type: 'camera', matrix: camera.matrix.elements, target: controls.target && { x: controls.target.x, y: controls.target.y, z: controls.target.z } }); } catch (e) {}
    });

    // watch for devicePixelRatio changes (page zoom) and trigger resize
    function watchDPR() {
        try {
            if (_dprMql) {
                try { _dprMql.removeEventListener('change', watchDPR); } catch (e) {}
                _dprMql = null;
            }
            const dpr = window.devicePixelRatio || 1;
            // matchMedia for resolution in dppx
            _dprMql = window.matchMedia(`(resolution: ${dpr}dppx)`);
            _dprMql.addEventListener('change', () => {
                try { resizeRenderer(placeholder.renderer, placeholder.camera); } catch (e) {}
                // re-register for the new DPR after a short delay
                setTimeout(watchDPR, 50);
            });
        } catch (e) {}
    }
    watchDPR();

    // observe container size changes (works when DevTools open/close)
    try {
        if (_resizeObserver) {
            try { _resizeObserver.disconnect(); } catch (e) {}
            _resizeObserver = null;
        }
        _resizeObserver = new ResizeObserver(() => {
            try { resizeRenderer(placeholder.renderer, placeholder.camera); } catch (e) {}
        });
        _resizeObserver.observe(container);
    } catch (e) {}

    // visualViewport often changes when DevTools open/close (Chromium). Hook it to resize.
    try {
        if (window.visualViewport) {
            if (_visualViewportHandler) try { window.visualViewport.removeEventListener('resize', _visualViewportHandler); } catch (e) {}
            _visualViewportHandler = () => { try { resizeRenderer(placeholder.renderer, placeholder.camera); } catch (e) {} };
            window.visualViewport.addEventListener('resize', _visualViewportHandler);
        }
    } catch (e) {}

    placeholder = { scene, camera, renderer: mainRenderer || { domElement: canvas }, controls, raycaster, mouse };
    light.off(0);

    return placeholder;
}

// 启动 worker 端的渲染循环
export function renderLoop(renderer, scene, camera, controls) {
    if (worker) {
        try { worker.postMessage({ type: 'start' }); } catch (e) { console.error('Failed to start worker render loop', e); }
        return;
    }

    // no worker: run main-thread render loop using provided renderer
    if (!renderer || !renderer.render) {
        // if renderer isn't a THREE.WebGLRenderer instance, skip
        if (renderer && renderer.domElement && renderer.domElement.getContext) {
            try { renderer = new THREE.WebGLRenderer({ canvas: renderer.domElement, antialias: true, alpha: true }); renderer.setPixelRatio(window.devicePixelRatio || 1); } catch (e) {}
        }
    }

    let running = true;
    const loop = () => {
        if (!running) return;
        try { if (renderer && renderer.render) renderer.render(scene, camera); } catch (e) {}
        requestAnimationFrame(loop);
    };
    loop();
}

// 调整渲染器大小，通知 worker
export function resizeRenderer(renderer, camera) {
    light.on();
    const container = document.getElementById('game-container');
    if (!container) return;
    const logicalW = container.clientWidth || container.offsetWidth;
    const logicalH = container.clientHeight || container.offsetHeight;
    camera.aspect = (logicalW > 0 && logicalH > 0) ? (logicalW / logicalH) : camera.aspect;
    camera.updateProjectionMatrix();
    try {
        // keep the visible canvas element sized to container so DOM hit tests remain correct
        if (canvasEl) {
            try { canvasEl.style.width = logicalW + 'px'; canvasEl.style.height = logicalH + 'px'; } catch (e) {}
        }
        if (worker) {
            worker.postMessage({ type: 'resize', width: logicalW, height: logicalH, devicePixelRatio: window.devicePixelRatio });
        } else if (renderer && renderer.setSize) {
            // main-thread fallback: set renderer drawing buffer size using DPR
            const drawW = Math.max(1, Math.floor(logicalW * (window.devicePixelRatio || 1)));
            const drawH = Math.max(1, Math.floor(logicalH * (window.devicePixelRatio || 1)));
            try { renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(drawW, drawH, false); } catch (e) {}
        }
    } catch (e) {}
    light.off(0);
}

// helpers to sync meshes with worker
export function sendMeshesToWorker(meshes) {
    if (!worker) return;
    worker.postMessage({ type: 'setMeshes', meshes });
}

export function updateMeshInWorker(desc) {
    if (!worker) return;
    worker.postMessage({ type: 'updateMesh', ...desc });
}

// Generic post to worker (used by main app to send commands)
export function postToWorker(msg, transfers) {
    if (!worker) return;
    try { worker.postMessage(msg, transfers || []); } catch (e) { console.error('postToWorker failed', e); }
}

export function removeMeshInWorker(id) {
    if (!worker) return;
    worker.postMessage({ type: 'removeMesh', id });
}

export function queryPointer(clientX, clientY) {
    if (!worker || !canvasEl) {
        // fallback to main-thread raycast using placeholder
        try {
            const rect = canvasEl.getBoundingClientRect();
            const x = ((clientX - rect.left) / rect.width) * 2 - 1;
            const y = -((clientY - rect.top) / rect.height) * 2 + 1;
            const mouse = new THREE.Vector2(x, y);
            const rc = placeholder.raycaster;
            if (!rc || !placeholder.camera) return Promise.resolve({ hit: false });
            rc.setFromCamera(mouse, placeholder.camera);
            const intersects = rc.intersectObjects(placeholder.scene.children, false);
            if (intersects && intersects.length) {
                return Promise.resolve({ hit: true, object: intersects[0].object });
            }
            return Promise.resolve({ hit: false });
        } catch (e) {
            return Promise.resolve({ hit: false });
        }
    }
    return new Promise((resolve) => {
        const handler = (ev) => {
            const msg = ev.detail || ev.data || null;
            if (!msg) return;
            if (msg.type === 'pointer-result') {
                window.removeEventListener('renderer-worker-event', handler);
                try { window.removeEventListener('renderer-pointer-result', handler); } catch (e) {}
                resolve(msg);
            }
        };
        // listen for unified worker events
        window.addEventListener('renderer-worker-event', handler);
        // legacy event name (compat)
        window.addEventListener('renderer-pointer-result', handler);
        const rect = canvasEl.getBoundingClientRect();
        worker.postMessage({ type: 'pointer', clientX, clientY, rect });
    });
}
