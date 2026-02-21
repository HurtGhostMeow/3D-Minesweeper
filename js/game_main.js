// 导入模块
import { initialGame } from "./game_minesweeper.js";
import { updateUI, bindUIEvents } from "./game_ui.js";
import { initGameScene, renderLoop, resizeRenderer, sendMeshesToWorker, updateMeshInWorker, removeMeshInWorker, queryPointer, isWorkerActive, postToWorker } from "./game_renderer.js";
import { highlightModule } from "./show_module.js";
import * as THREE from 'https://esm.sh/three@0.180.0';

// 定义全局变量和常量
const lightMain = highlightModule('game-main-js');
const lightMinesweeper = highlightModule('game-minesweeper-js');
let colorFile = './blockColors.json';
const COLORSET_KEY = 'site-colorset';
const GAMESTATE_KEY = 'minesweeper-gamestate';

let colorData = [];

let a = null;

// runtime-configurable values updated from settings
let currentSpacing = 2.2;
let currentBlockOpacity = 0.3;

// 初始化场景和事件
const { scene, camera, renderer, raycaster, controls } = initGameScene();
// 简单的方块容器（存放描述符，不再是 THREE.Mesh）
const cubes = [];

// 初始化 UI 事件绑定
bindUIEvents(startGame);

// 游戏状态容器
let gameState;
let logicWorker = null;
function ensureLogicWorker() {
    if (logicWorker) return logicWorker;
    try {
        const url = new URL('./game_logic_worker.js', import.meta.url).href;
        logicWorker = new Worker(url, { type: 'module' });
        logicWorker.addEventListener('message', (ev) => {
            // handled per-request via promises below
            try { window.dispatchEvent(new CustomEvent('logic-worker-event', { detail: ev.data })); } catch (e) {}
        });
    } catch (e) { console.error('Failed to create logic worker', e); }
    return logicWorker;
}

function postToLogic(msg) {
    const lw = ensureLogicWorker();
    try { lw.postMessage(msg); } catch (e) { console.error('logic post failed', e); }
}

function requestLogic(msg) {
    return new Promise((resolve, reject) => {
        const lw = ensureLogicWorker();
        if (!lw) return reject(new Error('no logic worker'));
        const reqId = `${Date.now()}_${Math.random()}`;
        msg.reqId = reqId;
        function handler(ev) {
            const data = ev.detail;
            if (!data || data.reqId !== reqId) return;
            window.removeEventListener('logic-worker-event', handler);
            resolve(data);
        }
        window.addEventListener('logic-worker-event', handler);
        try { lw.postMessage(msg); } catch (e) { window.removeEventListener('logic-worker-event', handler); reject(e); }
    });
}

// 游戏内的计时器
function timerTick() {
    if (!gameState || gameState.gameOver) return;// 游戏结束停止计时
    gameState.timeElapsed = (gameState.timeElapsed || 0) + 1;
    document.getElementById('timer').textContent = gameState.timeElapsed;
}

// 获取颜色偏好数据
async function getColorData(source) {
    try {
        // 从文件或 URL 读取颜色数据
        if (source && (source instanceof File)) {
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(source, 'UTF-8');
            });
            let a = JSON.parse(text);
            if (a['hidden'] === undefined || a['mine'] === undefined || a['flag'] === undefined) {
                alert('Galgame里不是这样的，你应该先给我正确的颜色配置文件！🤣')
                return;
            };
            colorData = a;
            try { localStorage.setItem(COLORSET_KEY, JSON.stringify(colorData)); } catch (e) {}
        } else {
            const url = (typeof source === 'string') ? source : colorFile;
            const response = await fetch(url);
            colorData = await response.json();
            try { localStorage.setItem(COLORSET_KEY, JSON.stringify(colorData)); } catch (e) {}
        }
    } catch (error) {
        console.error('Error loading color data:', error);
    }

    applyColors();

    return { applyColors };
}

// 应用颜色数据到方块材质
function applyColors() {
    let a=[];
    for (const key in colorData) {
        if (typeof colorData[key] === 'string' && colorData[key].startsWith('0x')) {
            a[key] = parseInt(colorData[key], 16);
            switch(key) {
                case 'hidden':
                    tipColor('notRevealed', a[key]);
                    break;
                case 'mine':
                    tipColor('isMine', a[key]);
                    break;
                case 'flag':
                    tipColor('flagged', a[key]);
                    break;
                default:
                    if (!isNaN(parseInt(key))) {
                        tipColor(key, a[key]);
                    }
            }
        }
    }
    
    try {
        // 更新现有方块颜色（通过 worker）
        if (cubes && cubes.length && gameState && gameState.grid) {
            let updated = 0;
            for (const desc of cubes) {
                const d = desc.userData || {};
                const cell = gameState.grid?.[d.x]?.[d.y]?.[d.z];
                if (cell) {
                    const mat = getMaterialForCell(cell);
                    updateMeshInWorker({ id: desc.id, color: mat.color, opacity: mat.opacity });
                    updated++;
                }
            }
        }
    } catch (e) {}
}
    
// 在页面上显示颜色图例
function tipColor(name, color) {
    if (!name) return;
    if (!document.getElementById('color-legend')) return

    // 如果页面上已存在同名元素，则只更新颜色并退出
    const existing = document.getElementById(name);
    if (existing) {
        if (name === 'isMine' || name === 'notRevealed' || name === 'flagged') {
            existing.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
            return;
        }else{
            existing.remove();
        }
    }

    if (document.getElementById('revealed' + name.toString())) return;

    let colorDiv = document.getElementById('color-legend');

    const span = document.createElement('span');
    span.id = 'revealed' + name.toString();
    span.className = 'mineColors';
    span.style.backgroundColor = `#${color.toString(16).padStart(6, '0')}`;
    span.innerText = (colorData[(parseInt(name) + 1).toString()] !== undefined)
        ? '周围有' + name + '颗雷'
        : '周围有' + name + '或以上颗雷';

    // 根据颜色亮度调整文字颜色，避免无法阅读
    try {
        const num = color;
        span.style.color = (num <= 0x808080) ? '#f1f1f1' : '#090909';
    } catch (e) {}

    colorDiv.appendChild(span);
}

// 监听介绍页点击，尝试应用颜色（在AI帮助下解决了首次加载时 legend 未显示的问题）
document.getElementById('introduction').addEventListener('click', async () => {
    console.log('introduction changed');

    let a = 0;
    const span = document.getElementById('flagged');
    setInterval(() => {
        a++;
        try{
            if (span) {
                applyColors();
                clearInterval(this);
            }else if (a > 10) {
                clearInterval(this);
            }
        }catch(e){};
    }, 100);
})


// 游戏开始
async function startGame(difficulty = 'easy', gridSize = 3, mineCount = 5) {
    const doStart = async () => {
        // 获取扫雷参数
        // 预设难度参数
        const gridConfig = {
            easy: { size: 3, mines: 3 },
            medium: { size: 6, mines: 26 },
            hard: { size: 12, mines: 238 }
        };

        const config = difficulty === 'custom' ? { size: gridSize, mines: mineCount } : gridConfig[difficulty];//配置难度参数

        // 参数合法性检查
        if ((config.size ** 3 < config.mines) || config.mines > 5000) {
            alert('放那么多雷干嘛😡');
            return;
        } else if (config.size > 20) {
            alert('等会别把你电脑卡炸了🤣，不行，重新设一个');
            return;
        } else if (config.size < 2) {
            alert('格子太少了吧🤔');
        } else if (config.mines < 1) {
            alert('没有雷还玩个锤子🤨，不行，重新设一个');
            return;
        }

        // 如果 worker 可用，则在 worker 中创建游戏并渲染
        if (isWorkerActive()) {
            // prefer: main thread keeps authoritative gameState and uses logic worker for expand
            gameState = initialGame(config.size, config.mines);
            if (!colorData || Object.keys(colorData).length === 0) {
                await getColorData();
            } else {
                applyColors();
            }

            // build mesh descriptors and send to renderer worker
            const size = config.size;
            const spacing = currentSpacing;
            const offset = (size - 1) * spacing / 2;
            const meshesToSend = [];
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    for (let z = 0; z < size; z++) {
                        const cell = gameState.grid[x][y][z];
                        if (cell && cell.isRealved && !cell.isMine && cell.neighborMines === 0) continue;
                        const id = `${x}_${y}_${z}`;
                        meshesToSend.push({ id, posX: (x * spacing) - offset, posY: (y * spacing) - offset, posZ: (z * spacing) - offset, color: getMaterialForCell(cell).color, opacity: getMaterialForCell(cell).opacity, userData: { x, y, z } });
                    }
                }
            }
            try { sendMeshesToWorker(meshesToSend); } catch (e) {}
            // remember descriptors locally so we can map ids -> userData
            cubes.length = 0;
            for (const d of meshesToSend) cubes.push(d);

            // Ensure camera and controls are centered on the grid for a pleasant default view
            try {
                const spacing = 2.2;
                const camDist = Math.max(10, size * spacing);
                if (controls && controls.target) {
                    controls.target.set(0, 0, 0);
                    controls.update && controls.update();
                }
                if (camera) {
                    camera.position.set(camDist, camDist, camDist);
                    // send camera state to worker so worker camera matches main-thread view
                    try { postToWorker({ type: 'camera', position: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, lookAt: { x: 0, y: 0, z: 0 } }); } catch (e) {}
                }
            } catch (e) { console.error('Failed to center camera after startGame:', e); }

            // update UI and timers
            updateUI(gameState);
            clearInterval(window.gameTimer);
            localStorage.removeItem(GAMESTATE_KEY);
            document.getElementById('timer').textContent = '0';
            gameState.timeElapsed = 0;
            window.gameTimer = setInterval(timerTick, 1000);

            // ensure logic worker available
            ensureLogicWorker();
        } else {
            gameState = initialGame(config.size, config.mines);
            // 如果已经从 localStorage 或上传加载了配色，避免再次 fetch 覆盖
            if (!colorData || Object.keys(colorData).length === 0) {
                await getColorData();
            } else {
                applyColors();
            }

            // Three.js 场景中渲染方块
            resetGameGrid(scene, cubes, gameState.grid, config.size);

            // 更新 UI
            updateUI(gameState);
            // 重置计时器
            clearInterval(window.gameTimer);
            localStorage.removeItem( GAMESTATE_KEY );   // 新游戏开始，移除旧存档
            document.getElementById('timer').textContent = '0';
            gameState.timeElapsed = 0;
            window.gameTimer = setInterval(timerTick, 1000);
        }
    };

    return doStart();
}

// 框架逻辑
// 简单的鼠标相交辅助
function getIntersects(event, objects, camera) {
    // 已迁移到 worker，主线程不再直接进行三维射线拾取；保留兼容签名返回空
    return [];
}

// 游戏逻辑处理
async function gameLogic(event) {
    try {
        if (isWorkerActive()) {
            // use logic worker to compute reveals, then instruct renderer worker to update scene
            try {
                const rect = renderer && renderer.domElement ? renderer.domElement.getBoundingClientRect() : null;
                const res = await queryPointer(event.clientX, event.clientY);
                if (!res || !res.hit) return;
                let clicked = null;
                if (res.object) clicked = res.object.userData;
                else if (res.id) clicked = (cubes.find(c => c.id === res.id) || {}).userData;
                if (!clicked) return;

                if (event.type === 'contextmenu') {
                    // toggle flag via logic worker
                    const resp = await requestLogic({ type: 'toggleFlag', state: gameState, x: clicked.x, y: clicked.y, z: clicked.z });
                    if (resp && resp.toggled) {
                        gameState = resp.state;
                        updateUI(gameState);
                        try { localStorage.setItem(GAMESTATE_KEY, JSON.stringify(gameState)); } catch (e) {}
                        const id = `${clicked.x}_${clicked.y}_${clicked.z}`;
                        const mat = getMaterialForCell(gameState.grid[clicked.x][clicked.y][clicked.z]);
                        updateMeshInWorker({ id, color: mat.color, opacity: mat.opacity });
                    }
                } else if (event.type === 'click') {
                    // Single click: only show neighboring mine count (do not reveal)
                    if (event.detail !== 2) {
                        // lookup cell and update neighborMines display
                        const id = `${clicked.x}_${clicked.y}_${clicked.z}`;
                        const cell = gameState.grid?.[clicked.x]?.[clicked.y]?.[clicked.z];
                        if (cell) {
                            const el = document.getElementById('neighborMines');
                            if (el) {
                                if (cell.isRealved) el.innerText = cell.neighborMines;
                                else el.innerText = '翻开它，得到它的秘密吧！=￣ω￣=';
                            }
                        }
                    } else {
                        // Double-click: expand/flood-reveal
                        const resp = await requestLogic({ type: 'expand', state: gameState, x: clicked.x, y: clicked.y, z: clicked.z });
                        if (resp && resp.reveals && resp.reveals.length) {
                            console.log('Logic worker expanded', resp.reveals.length, 'cells');
                            gameState = resp.state;
                            // apply visual updates: remove empty cubes, update non-empty materials
                            let revealedMine = false;
                            for (const rc of resp.reveals) {
                                const id = `${rc.x}_${rc.y}_${rc.z}`;
                                const cell = gameState.grid?.[rc.x]?.[rc.y]?.[rc.z];
                                const idx = cubes.findIndex(c => c.id === id);
                                if (cell && cell.isMine && cell.isRealved) revealedMine = true;
                                    if (cell && !cell.isMine && cell.neighborMines === 0) {
                                        if (idx !== -1) { removeMeshInWorker(id); cubes.splice(idx, 1); }
                                    } else {
                                    const mat = getMaterialForCell(cell);
                                    updateMeshInWorker({ id, color: mat.color, opacity: mat.opacity });
                                }
                            }
                            // if a mine was revealed, reveal all mines visually and mark game over
                                if (revealedMine) {
                                    gameState.gameOver = true;
                                    revealAllCells(gameState);
                                }
                            updateUI(gameState);
                            try { localStorage.setItem(GAMESTATE_KEY, JSON.stringify(gameState)); } catch (e) {}
                        }
                    }
                }
            } catch (e) {
                console.error('logic worker handling failed', e);
            }
            return;
        }

        const res = await queryPointer(event.clientX, event.clientY);
        if (!res || !res.hit) return;

        let meshDesc = null;
        let meshObj = null;
        if (res.object) {
            meshObj = res.object; // THREE.Mesh from main-thread fallback
            meshDesc = meshObj;   // pass through
        } else if (res.id) {
            meshDesc = cubes.find(c => c.id === res.id);
        }
        if (!meshDesc) return;
        const { x, y, z } = (meshDesc.userData || {});

        if (event.type === 'click') {
            if (event.detail === 2) {
                lightMinesweeper.lightWithToggle(() => {
                    revealCell(gameState, meshDesc, x, y, z);
                });
            } else {
                lightMinesweeper.lightWithToggle(() => {
                    if (gameState.grid[x][y][z].isRealved) {
                        document.getElementById('neighborMines').innerText = gameState.grid[x][y][z].neighborMines;
                    } else {
                        document.getElementById('neighborMines').innerText = '翻开它，得到它的秘密吧！=￣ω￣=';
                    }
                });
            }
        } else if (event.type === 'contextmenu') {
            toggleFlag(gameState, meshDesc, x, y, z);
        }

        updateUI(gameState);
    } catch (e) {
        console.error('gameLogic error', e);
    }
}

// 创建或重置网格方块到场景中
function resetGameGrid(scene, cubesArr, grid, size) {
    // 清理已有方块，避免重复渲染
    while (cubesArr.length) {
        const m = cubesArr.pop();
        try {
            if (isWorkerActive()) removeMeshInWorker(m.id);
            else if (m.parent) m.parent.remove(m);
        } catch (e) {}
    }

    const spacing = currentSpacing;    // 方块间距
    const offset = (size - 1) * spacing / 2;    // 居中偏移量，使网格居中显示

    if (isWorkerActive()) {
        const meshesToSend = [];
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const cell = grid[x][y][z];
                    if (cell && cell.isRealved && !cell.isMine && cell.neighborMines === 0) continue;

                    const id = `${x}_${y}_${z}`;
                    const posX = (x * spacing) - offset;
                    const posY = (y * spacing) - offset;
                    const posZ = (z * spacing) - offset;
                    const mat = getMaterialForCell(cell);
                    const desc = { id, posX, posY, posZ, color: mat.color, opacity: mat.opacity, userData: { x, y, z } };
                    cubesArr.push(desc);
                    meshesToSend.push(desc);
                }
            }
        }
        try { sendMeshesToWorker(meshesToSend); } catch (e) {}
    } else {
        const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
        for (let x = 0; x < size; x++) {
            for (let y = 0; y < size; y++) {
                for (let z = 0; z < size; z++) {
                    const cell = grid[x][y][z];
                    if (cell && cell.isRealved && cell.neighborMines === 0) continue;

                    const mesh = new THREE.Mesh(boxGeo, getMaterialForCell(cell));
                    mesh.position.set((x * spacing) - offset, (y * spacing) - offset, (z * spacing) - offset);
                    mesh.userData = { x, y, z };
                    scene.add(mesh);
                    cubesArr.push(mesh);
                }
            }
        }
    }
    try { console.log('resetGameGrid created meshes:', cubesArr.length); } catch (e) {}
}

// 翻开方块的最简逻辑：改变颜色并更新状态
function revealCell(gameState, meshDesc, x, y, z) {
    const cell = gameState.grid[x][y][z];
    if (cell.isRealved || cell.isFlagged) return;
    cell.isRealved = true;
    localStorage.setItem( GAMESTATE_KEY, JSON.stringify(gameState) );

    gameState.realved = (gameState.realved || 0) + 1;
    if (cell.isMine) {
        gameState.gameOver = true;
        if (meshDesc) {
            const mat = getMaterialForCell(cell);
            if (isWorkerActive()) {
                updateMeshInWorker({ id: meshDesc.id, color: mat.color, opacity: mat.opacity });
            } else {
                // meshDesc is actual THREE.Mesh in fallback
                try {
                    if (cell.isMine) {
                        meshDesc.material = new THREE.MeshStandardMaterial({ color: mat.color || 0xff4444 });
                    } else if (!cell.isRealved) {
                        meshDesc.material = new THREE.MeshStandardMaterial({ color: mat.color || 0x999999 });
                    } else {
                        meshDesc.material = new THREE.MeshPhongMaterial({ color: mat.color, opacity: mat.opacity, transparent: mat.opacity < 1, side: THREE.DoubleSide });
                    }
                } catch (e) {}
            }
        }

        // reveal all mines visually
        revealAllMines(gameState);

        return;
    }
    gameWonCheck(gameState);

    if (cell.neighborMines === 0) {
        if (meshDesc) {
            const mat = getMaterialForCell(cell);
            if (isWorkerActive()) {
                updateMeshInWorker({ id: meshDesc.id, color: mat.color, opacity: mat.opacity });
            } else {
                try { meshDesc.material = new THREE.MeshPhongMaterial({ color: mat.color, opacity: mat.opacity, transparent: mat.opacity < 1, side: THREE.DoubleSide }); } catch (e) {}
            }
        }

        const directions = [-1, 0, 1];
        for (let dx of directions) {
            for (let dy of directions) {
                for (let dz of directions) {
                    const [nx, ny, nz] = [x + dx, y + dy, z + dz];
                    if (nx >= 0 && ny >= 0 && nz >= 0 && nx < gameState.grid.length && ny < gameState.grid.length && nz < gameState.grid.length) {
                        const neighborDesc = cubes.find(m => {
                            const d = m.userData || {};
                            return d.x === nx && d.y === ny && d.z === nz;
                        });
                        revealCell(gameState, neighborDesc, nx, ny, nz);
                    }
                }
            }
        }

        if (meshDesc) {
            try { console.log('revealCell: removing mesh', { x, y, z }); } catch (e) {}
            if (isWorkerActive()) {
                try { removeMeshInWorker(meshDesc.id); } catch (e) {}
            } else {
                try { if (meshDesc.parent) meshDesc.parent.remove(meshDesc); } catch (e) {}
            }
            const idx = cubes.indexOf(meshDesc);
            if (idx !== -1) cubes.splice(idx, 1);
        }
        return;
    }

    if (meshDesc) {
        const mat = getMaterialForCell(cell);
        updateMeshInWorker({ id: meshDesc.id, color: mat.color, opacity: mat.opacity });
    }
}

// 根据格子状态获取对应材质
function getMaterialForCell(cell) {
    // 辅助函数：根据颜色数据获取颜色值
    const getColor = (key) => {
        const val = colorData[key];
        if (typeof val === 'string' && val.startsWith('0x')) {
            return parseInt(val, 16);
        }else{
            for (let k = 26; k > 0; k--) {
                const altval = colorData[k.toString()];
                if (typeof altval === 'string' && altval.startsWith('0x')) {
                    return parseInt(altval, 16);
                }
            }
        }
        return val;
    };

    // 返回简化材质描述（颜色与不透明度），由 worker 使用该信息创建/更新材质
    if (!cell.isRealved) {
        if (cell.isFlagged) {
            return { color: getColor('flag') || 0x4444ff, opacity: 1 };
        }
        return { color: getColor('hidden') || 0x999999, opacity: 1 };
    }

    if (cell.isMine) {
        return { color: getColor('mine') || 0xff4444, opacity: 1 };
    }

    const color = getColor(cell.neighborMines.toString()) || getColor();
    return { color: color, opacity: (cell.neighborMines === 0 ? 0.0 : currentBlockOpacity) };
}

// 切换标记
function toggleFlag(gameState, meshDesc, x, y, z) {
    const cell = gameState.grid[x][y][z];
    if (cell.isRealved) return;
    cell.isFlagged = !cell.isFlagged;
    const mat = getMaterialForCell(cell);
    if (meshDesc) {
        if (isWorkerActive()) {
            try { updateMeshInWorker({ id: meshDesc.id, color: mat.color, opacity: mat.opacity }); } catch (e) {}
        } else {
            try { meshDesc.material = new THREE.MeshPhongMaterial({ color: mat.color, opacity: mat.opacity, transparent: mat.opacity < 1, side: THREE.DoubleSide }); } catch (e) {}
        }
    }
    if (cell.isFlagged) {
        gameState.flagged = (gameState.flagged || 0) + 1;
    } else {
        gameState.flagged = Math.max(0, (gameState.flagged || 0) - 1);
    }
}

// 检查游戏胜利条件
function gameWonCheck(gameState) {
    let condition1 = (gameState.realved === (gameState.length ** 3 - gameState.mineCount)) && (gameState.gameOver === false);
    //let condition2 = (gameState.flagged === gameState.mineCount) && (gameState.gameOver === false);//作弊模式

    if (condition1) {
        gameState.gameOver = true;
        gameState.gameWon = true;
        clearInterval(window.gameTimer);
        document.getElementById('timer').textContent = gameState.timeElapsed;
        localStorage.removeItem( GAMESTATE_KEY );
    }
}

// Reveal every cell on the board (used when a mine is triggered)
function revealAllCells(state) {
    try {
        const N = state.length || (state.grid && state.grid.length) || 0;
        // only mark mines as revealed; do not reveal non-mine cells
        for (let ax = 0; ax < N; ax++) for (let ay = 0; ay < N; ay++) for (let az = 0; az < N; az++) {
            const c = state.grid?.[ax]?.[ay]?.[az];
            if (c && c.isMine) c.isRealved = true;
        }

        const spacing = 2.2;
        const offset = (N - 1) * spacing / 2;
        const meshesToSend = [];
        for (let ax = 0; ax < N; ax++) {
            for (let ay = 0; ay < N; ay++) {
                for (let az = 0; az < N; az++) {
                    const c = state.grid?.[ax]?.[ay]?.[az];
                    if (!c) continue;
                    // show everything except empty non-mine that should be visually removed
                    if (c.isRealved && !c.isMine && c.neighborMines === 0) continue;
                    const id = `${ax}_${ay}_${az}`;
                    const mat = getMaterialForCell(c);
                    meshesToSend.push({ id, posX: (ax * spacing) - offset, posY: (ay * spacing) - offset, posZ: (az * spacing) - offset, color: mat.color, opacity: mat.opacity, userData: { x: ax, y: ay, z: az } });
                }
            }
        }

        if (isWorkerActive()) {
            try { sendMeshesToWorker(meshesToSend); } catch (e) { console.error('sendMeshesToWorker failed in revealAllCells', e); }
            cubes.length = 0;
            for (const d of meshesToSend) cubes.push(d);
        } else {
            try { resetGameGrid(scene, cubes, state.grid, N); } catch (e) { console.error('resetGameGrid failed in revealAllCells', e); }
        }
    } catch (e) { console.error('revealAllCells failed', e); }
}

console.info("%c别作弊我跟你说，源代码都在控制台里呢~", "background: linear-gradient(90deg, #a9ddf5 50%, #7a8be8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: transparent; font-weight: bold;","🤣");

// 主渲染循环
renderLoop(renderer, scene, camera, controls);

// 绑定鼠标事件到渲染画布
if (renderer && renderer.domElement) {
    renderer.domElement.addEventListener('click', gameLogic);
    renderer.domElement.addEventListener('contextmenu', (e) => {    // 右键菜单事件
        e.preventDefault(); // 阻止默认菜单弹出
        gameLogic(e);   // 处理右键逻辑
    });
}

// 初始化和启动
if (lightMain) {
    lightMain.on();
}

// 尝试从 localStorage 加载颜色配置
try {
    const savedColors = localStorage.getItem(COLORSET_KEY);
        if (savedColors) {
            colorData = JSON.parse(savedColors);
        };
} catch (e) {}

// 接收来自菜单的文件选择事件，交由 getColorData 读取并应用
window.addEventListener('color-file-selected', async (ev) => {
    try {
        const file = ev && ev.detail ? ev.detail : null;
        if (!file) return;
        if (typeof file !== 'string') {
            if (!file.name.endsWith('.json') || !file.type.includes('application/json')) {
                alert('Galgame里不是这样的，你应该先给我正确的颜色配置文件！🤣')
                return;
            };
        };
        await getColorData(file);
        console.log('Applied custom color set from uploaded file');
    } catch (e) {
        console.error('Failed to apply custom colors from file:', e);
    }
});

// 检测本地存档
try{
    const savedState = localStorage.getItem(GAMESTATE_KEY);
    if (savedState) {
        const overlay = document.createElement('div');
        overlay.id = 'load-overlay';

        const box = document.createElement('div');
        box.id = 'load-box';
        box.className = 'blur-box';
        box.style.textAlign = 'center';
        box.innerHTML = "<h2>有本地存档，是否加载存档？</h2>";

        const loadButton = document.createElement('button');
        loadButton.id = 'load-button';
        loadButton.innerText = '加载存档';

        const cancelButton = document.createElement('button');
        cancelButton.id = 'cancel-load-button';
        cancelButton.innerText = '不加载';

        box.appendChild(loadButton);
        box.appendChild(cancelButton);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const close = () => {
            overlay.classList.add('closing');
            box.classList.add('closing');

            const onAnimEnd = (event) => {
                if (event.target === overlay) {
                    overlay.removeEventListener('animationend', onAnimEnd); // 清理监听器
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);    // 移除遮罩
                }
            };

            overlay.addEventListener('animationend', onAnimEnd);
            // 如果没有动画或动画事件未触发，短延时后强制移除，避免遮挡场景
            setTimeout(() => {
                try {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                } catch (e) {}
            }, 150);
        };

        // 等待用户选择（基于 Promise），避免同步判断导致立即加载/不加载
        const shouldLoad = await new Promise((resolve) => {
            loadButton.onclick = () => { resolve(true); close(); };
            cancelButton.onclick = () => { resolve(false); close(); };
        });

        if (shouldLoad) {
            try {
                let a = JSON.parse(savedState);

                if (a.length === undefined || a.mineCount === undefined || a.grid === undefined) {
                    alert('本地存档数据格式不正确，这不是存档吧😨');
                    console.log('Invalid game state format in localStorage');
                    localStorage.removeItem(GAMESTATE_KEY); 
                    await startGame();
                }
                gameState = a;

                // 确保颜色数据已加载（如果已从 localStorage 或上传加载过则不要覆盖）
                if (!colorData || Object.keys(colorData).length === 0) {
                    await getColorData();
                } else {
                    applyColors();
                }

                // 重新渲染场景并更新 UI，使存档真正恢复到画面上
                const gridSize = gameState.length || (gameState.grid && gameState.grid.length) || 0;
                resetGameGrid(scene, cubes, gameState.grid, gridSize);
                // center camera on restored grid
                try {
                    const spacing = 2.2;
                    const camDist = Math.max(10, gridSize * spacing);
                    if (controls && controls.target) { controls.target.set(0,0,0); controls.update && controls.update(); }
                    if (camera) { camera.position.set(camDist, camDist, camDist); try { postToWorker({ type: 'camera', position: { x: camera.position.x, y: camera.position.y, z: camera.position.z }, lookAt: { x:0,y:0,z:0 } }); } catch(e){} }
                } catch(e) {}
                updateUI(gameState);

                // 恢复计时器显示与运行
                clearInterval(window.gameTimer);
                const timerEl = document.getElementById('timer');
                if (timerEl) timerEl.textContent = (gameState.timeElapsed || 0).toString();
                if (!gameState.gameOver) {
                    window.gameTimer = setInterval(timerTick, 1000);
                }
            } catch (e) {
                console.error('Failed to parse or restore saved game state:', e);
            }
        }else{
            localStorage.removeItem(GAMESTATE_KEY); 
            startGame();
        }
    }else{
        await startGame();
    }
}catch(e){};

applyColors();  // 应用颜色数据
resizeRenderer(renderer, camera);   // 初始调整渲染器大小
window.addEventListener('resize', () => resizeRenderer(renderer, camera));  // 监听窗口大小变化调整渲染器

// Apply settings changes at runtime
window.addEventListener('settings-changed', (ev) => {
    try {
        const s = ev && ev.detail ? ev.detail : {};
        if (typeof s.spacing === 'number') currentSpacing = s.spacing;
        if (typeof s.blockOpacity === 'number') currentBlockOpacity = s.blockOpacity;
        // Rebuild or update visuals to reflect new spacing/opacity
        if (gameState) {
            try { resetGameGrid(scene, cubes, gameState.grid, gameState.length || (gameState.grid && gameState.grid.length) || 0); } catch (e) {}
            updateUI(gameState);
        }
    } catch (e) { console.error('Failed to apply settings-changed in game_main', e); }
});

//自动存档
setInterval(() => {
    if (gameState && !gameState.gameOver) {
        try {
            localStorage.setItem( GAMESTATE_KEY, JSON.stringify(gameState) );
            console.log('Game state auto-saved.');
        }catch(e){
            console.error('Failed to auto-save game state:', e);
        }
    }else{
        localStorage.removeItem( GAMESTATE_KEY );
    }
}, 30000);//每30秒存档一次

// 接收来自菜单的存档文件选择事件，读取并应用存档数据
window.addEventListener('upload-file-selected', async (ev) => {
    try {
        const file = ev && ev.detail ? ev.detail : null;
        if (!file) return;
        if (!file.name.endsWith('.json') || !file.type.includes('application/json')) {
            alert('上传的存档文件格式不正确，这不是存档吧😨');
            console.log('Invalid file type for uploaded game state file');
            return;
        };

        let text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file, 'UTF-8');
        })
        let a = JSON.parse(text);

        if (a.length === undefined || a.mineCount === undefined || a.grid === undefined) {
            alert('上传的存档文件格式不正确，这不是存档吧😨');
            console.log('Invalid game state format in uploaded file');
            return;
        }

        gameState = a;
        // 重新渲染场景并更新 UI，使存档真正恢复到画面上
        const gridSize = gameState.length || (gameState.grid && gameState.grid.length) || 0;
        resetGameGrid(scene, cubes, gameState.grid, gridSize);
        updateUI(gameState);
        // 恢复计时器显示与运行
        clearInterval(window.gameTimer);
        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.textContent = (gameState.timeElapsed || 0).toString();
        if (!gameState.gameOver) {
            window.gameTimer = setInterval(timerTick, 1000);
        }

        console.log('Applied game state from uploaded file');
    } catch (e) {}
});

// 提供接口供菜单获取当前游戏状态
window.addEventListener('request-game-state', (event) => {
    try {
        if (gameState && typeof event.detail === 'function') {
            event.detail(gameState);
        }
    } catch (e) {}
});

// 监听复盘请求
window.addEventListener('request-reset-game', () => {
    gameState.gameOver = false;
    gameState.gameWon = false;
    gameState.realved = 0;
    gameState.flagged = 0;

    for (let x = 0; x < gameState.length; x++) {
        for (let y = 0; y < gameState.length; y++) {
            for (let z = 0; z < gameState.length; z++) {
                const cell = gameState.grid[x][y][z];
                cell.isRealved = false;
                cell.isFlagged = false;
            }
        }
    }

    clearInterval(window.gameTimer);
    document.getElementById('timer').textContent = '0';
    gameState.timeElapsed = 0;
    window.gameTimer = setInterval(timerTick, 1000);
    
    const gridSize = gameState.length || (gameState.grid && gameState.grid.length) || 0;
    resetGameGrid(scene, cubes, gameState.grid, gridSize);
    updateUI(gameState);
});

// 监听颜色设置更新
window.addEventListener('storage', (event) => {
    if (event.key === COLORSET_KEY) {
        try {
            const newColors = event.newValue ? JSON.parse(event.newValue) : null;
            if (newColors) {
                colorData = newColors;
                applyColors();
                console.log('Color set updated from another tab/window');
            }
        } catch (e) {
            console.error('Failed to parse updated color set from storage event:', e);
        }
    }
});


//彩蛋
const mainDiv = document.getElementById('game-box');
let isEggActive = false;
let isEggHasActivated = false;
let clickCount = 0;
const clickTime = 1000;

function egg() {
    document.body.style.backgroundImage = 'url("img/image.png")';
    document.body.style.backgroundPosition = 'center center';
    document.body.style.backgroundRepeat = 'no-repeat';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundSize = 'cover';
    for (const sheet of document.styleSheets){
        for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('.blur-box')) {
                rule.style.backdropFilter = 'none';
            }
        }
    }
    
    if( clickCount > 5 && isEggHasActivated === false){
        alert('彩蛋已经激活，无需重复点击\n题外话：因为主人公印象色很符合我设置的主题色，而且两位都是天才俱乐部的成员，再加上图中有点《No Game No Life》的元素，特别符合游戏主题，于是选择了这张图');
        isEggHasActivated = true;
        return;
    }
}

function countClick() {
    if (isEggActive) return;

    // 增加点击计数
    clickCount++;

    // 第一次点击启动一个延时定时器，在超时时间后重置计数
    if (clickCount === 1) {
        setTimeout(() => {
            clickCount = 0;
        }, clickTime);
    }

    if (clickCount >= 5) {
        egg();
    }
}

mainDiv.addEventListener('click', countClick);

// 页面焦点监听，更新标题（不完全算彩蛋🤗）
function updateTitleByFocus() {
    if (document.hasFocus()) {
        console.log("页面已获得焦点");
        document.title = "欢迎来玩三维扫雷喵=￣ω￣=";
    } else if (document.visibilityState === 'hidden') {
        // 页面不可见（切换标签或最小化）
        console.log("页面不可见或切换了标签页");
        document.title = "不要走啊，人＞﹏＜";
    } else {
        console.log("页面未获得焦点");
        document.title = "不要走啊，人＞﹏＜";
    }
}

window.addEventListener('focus', updateTitleByFocus);
window.addEventListener('blur', updateTitleByFocus);
document.addEventListener('visibilitychange', updateTitleByFocus);