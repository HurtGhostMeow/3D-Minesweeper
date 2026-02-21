// Worker: compute neighbor auto-expansion (flood reveal) without touching DOM
self.addEventListener('message', (ev) => {
    const msg = ev.data;
    try {
        switch (msg.type) {
            case 'expand': {
                const { state, x, y, z, reqId } = msg;
                const res = expandCells(state, x, y, z);
                try { self.postMessage({ type: 'expanded', reqId, reveals: res.reveals, state: state }); } catch (e) {}
                break;
            }
            case 'toggleFlag': {
                const { state, x, y, z, reqId } = msg;
                let toggled = false;
                try {
                    const cell = state.grid[x][y][z];
                    if (!cell.isRealved) {
                        cell.isFlagged = !cell.isFlagged;
                        state.flagged = (state.flagged || 0) + (cell.isFlagged ? 1 : -1);
                        toggled = true;
                    }
                } catch (e) {}
                try { self.postMessage({ type: 'toggled', reqId, toggled, state }); } catch (e) {}
                break;
            }
            case 'revealOne': {
                const { state, x, y, z, reqId } = msg;
                const reveals = [];
                try {
                    const cell = state.grid?.[x]?.[y]?.[z];
                    if (cell && !cell.isRealved && !cell.isFlagged) {
                        cell.isRealved = true;
                        state.realved = (state.realved || 0) + 1;
                        reveals.push({ x, y, z });
                    }
                } catch (e) {}
                try { self.postMessage({ type: 'revealed', reqId, reveals, state }); } catch (e) {}
                break;
            }
        }
    } catch (e) {
        try { self.postMessage({ type: 'logic-error', message: String(e) }); } catch (e) {}
    }
});

function expandCells(state, sx, sy, sz) {
    const N = state.length || (state.grid && state.grid.length) || 0;
    const reveals = [];
    if (!state || !state.grid) return { reveals };
    if (sx < 0 || sy < 0 || sz < 0 || sx >= N || sy >= N || sz >= N) return { reveals };
    const stack = [[sx, sy, sz]];
    const visited = new Set();
    const key = (x,y,z) => `${x}_${y}_${z}`;
    while (stack.length) {
        const [x,y,z] = stack.pop();
        const k = key(x,y,z);
        if (visited.has(k)) continue;
        visited.add(k);
        const cell = state.grid?.[x]?.[y]?.[z];
        if (!cell) continue;
        if (cell.isRealved) continue;
        cell.isRealved = true;
        state.realved = (state.realved || 0) + 1;
        reveals.push({ x, y, z });
        if (!cell.isMine && cell.neighborMines === 0) {
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dy === 0 && dz === 0) continue;
                const nx = x + dx, ny = y + dy, nz = z + dz;
                if (nx>=0 && ny>=0 && nz>=0 && nx<N && ny<N && nz<N) {
                    const nk = key(nx,ny,nz);
                    if (!visited.has(nk)) stack.push([nx,ny,nz]);
                }
            }
        }
    }
    // basic win/lose not computed here; caller can decide
    return { reveals };
}
