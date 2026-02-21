import { highlightModule } from "./show_module.js";

const light = highlightModule('game-ui-js');

// 更新 UI 显示
export function updateUI(gameState) {
    light.on();
    document.getElementById('mineCount').textContent = gameState.mineCount - gameState.flagged;
    document.getElementById('flagCount').textContent = gameState.flagged;

    let status = '进行中';
    if (gameState.gameOver) {
        status = gameState.gameWon ? '哇塞！你赢啦🎉' : '没事的，失败是成功之母🤗';
        light.off();
    }
    document.getElementById('gameStatus').textContent = status;
    light.off()
}

// 绑定 UI 事件
export function bindUIEvents(startGame) {
    const difficultySelector = document.getElementById('difficulty');
    const restartButton = document.getElementById('restart-button');
    const resetButton = document.getElementById('reset-button');
    const customGrid = document.getElementById('gridSize');
    const customMines = document.getElementById('mineCountInput');

    // 自定义设置显示控制函数
    function customSettings() {
        light.on();
        const difficultySelect = document.getElementById("difficulty");
        const customSettingsDiv = document.getElementById("custom-settings");
        if (!difficultySelect || !customSettingsDiv) return;
        if (difficultySelect.value === "custom") {
            console.log("Custom settings selected");
            customSettingsDiv.style.display = "block";
        } else {
            customSettingsDiv.style.display = "none";
        }
        light.off();
    }

    // 难度选择变化事件
    difficultySelector.addEventListener('change', () => {
        light.on();
        if (difficultySelector.value === 'custom')  customSettings();
        customSettings();
        light.off();
    });

    // 重新开始按钮点击事件
    restartButton.addEventListener('click', () => {
        light.on();
        const difficulty = difficultySelector.value;
        const gridSize = parseInt(customGrid.value);
        const mineCount = parseInt(customMines.value);

        startGame(difficulty, gridSize, mineCount);
        light.off();
    });

    // 复盘本关按钮点击事件
    resetButton.addEventListener('click', () => {
        light.on();
        window.dispatchEvent(new CustomEvent('request-reset-game'));
        light.off();
    });
}
