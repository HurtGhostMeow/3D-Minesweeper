// 初始化游戏函数（随机加雷，所以第一个就炸也很正常😜）
export function initialGame(length, mineCount) {
    // 创建三维网格数据结构
    const grid = Array.from({ length: length }, () => 
        Array.from({ length: length }, () => 
            Array.from({ length: length }, () => ({
                isMine: false,
                isRealved: false,
                isFlagged: false,
                neighborMines: 0
            }))
        )
    );

    // 随机放置地雷
    let placedMines = 0;
    while (placedMines < mineCount) {
        const x = Math.floor(Math.random() * length);
        const y = Math.floor(Math.random() * length);
        const z = Math.floor(Math.random() * length);

        if (!grid[x][y][z].isMine) {
            grid[x][y][z].isMine = true;
            placedMines++;
        };
    }

    countNeighborMines(grid, length);

    return { grid, length, mineCount, flagged : 0, realved : 0, gameOver : false, gameWon : false };
}

// 计算每个格子周围的地雷数量
function countNeighborMines(grid, length){
    const directions = [-1, 0, 1];

    for (let x = 0; x < length; x++) {
        for (let y = 0; y < length; y++) {
            for (let z = 0; z < length; z++) {
                if (grid[x][y][z].isMine) {
                    grid[x][y][z].neighborMines = 0;    // 地雷格子不计算邻居地雷数，以避免混淆
                    continue;
                }

                // 遍历所有26个邻居
                let count = 0;
                for (let dx of directions) {
                    for (let dy of directions) {
                        for (let dz of directions) {
                            if (dx === 0 && dy === 0 && dz === 0) continue;
                            const nx = x + dx, ny = y + dy, nz = z + dz;
                            if (nx >= 0 && nx < length && ny >= 0 && ny < length && nz >= 0 && nz < length) {
                                if (grid[nx][ny][nz].isMine) count++;
                            }
                        }
                    }
                }

                grid[x][y][z].neighborMines = count;
            }
        }
    }
}
