/* ======================== 三维扫雷方块调色器脚本 ======================== */
// 颜色设置存储键与默认值
const COLORSET_KEY = 'site-colorset';
let  colorSets = {
    "hidden": "0x999999",
    "mine": "0xff4444",
    "flag": "0x4444ff",
};
const defaultColorSets = colorSets;

// 设置获取页面元素
const blockSelect = document.getElementById('block-type-select');
const colorPicker = document.getElementById('color-picker');
const colorLegend = document.getElementById('color-legend');
const applyButton = document.getElementById('apply-colors-button');
const resetButton = document.getElementById('reset-colors-button');
const outputButton = document.getElementById('output-colors-button');
const importButton = document.getElementById('import-colors-button');
const importInput = document.getElementById('import-colors-input');
const resetDefaultButton = document.getElementById('reset-default-button');
const getColorsButton = document.getElementById('get-colors-button');
const candyColorButton = document.getElementById('candy-color-set');

// 辅助函数：将 0xRRGGBB 转换为 #RRGGBB
function toHexStr(val) {
    if (typeof val === 'string' && val.startsWith('0x')) {
        return '#' + val.slice(2).padStart(6, '0');
    }
    return val;
}

// 辅助函数：将 #RRGGBB 转换为 0xRRGGBB
function to0xStr(val) {
    if (typeof val === 'string' && val.startsWith('#')) {
        return '0x' + val.slice(1).toLowerCase();
    }
    return val;
}
function updateUI() {
    const selectedType = blockSelect.value;
    colorPicker.value = toHexStr(colorSets[selectedType] || '#999999');
    renderLegend();
}

function renderLegend() {
    colorLegend.innerHTML = '';
    // 排序键：hidden, mine, flag, 然后是数字
    const keys = Object.keys(colorSets).sort((a, b) => {
        const special = { 'hidden': 1, 'mine': 2, 'flag': 3 };
        if (special[a] && special[b]) return special[a] - special[b];
        if (special[a]) return -1;
        if (special[b]) return 1;
        return parseInt(a) - parseInt(b);
    });

    keys.forEach(key => {
        const span = document.createElement('span');
        span.className = 'mineColors';
        const color = toHexStr(colorSets[key]);
        span.style.backgroundColor = color;
        span.style.color = (parseInt(color.slice(1), 16) <= 0x808080) ? '#f1f1f1' : '#090909';
        span.style.display = 'inline-block';
        
        let text = '';
        if (key === 'hidden') text = '未打开';
        else if (key === 'mine') text = '地雷';
        else if (key === 'flag') text = '已标记';
        else {
            // 检查是否是当前设置的最大数字
            const num = parseInt(key);
            let isMax = true;
            for (const k in colorSets) {
                if (!isNaN(parseInt(k)) && parseInt(k) > num) {
                    isMax = false;
                    break;
                }
            }
            text = isMax ? `雷数 ${key}+` : `雷数 ${key}`;
        }
        span.innerText = text;
        colorLegend.appendChild(span);
    });
}

blockSelect.addEventListener('change', () => {
    colorPicker.value = toHexStr(colorSets[blockSelect.value] || '#999999');
});

colorPicker.addEventListener('input', () => {
    const selectedType = blockSelect.value;
    colorSets[selectedType] = to0xStr(colorPicker.value);
    renderLegend();
});

applyButton.addEventListener('click', () => {
    localStorage.setItem(COLORSET_KEY, JSON.stringify(colorSets));
    alert('颜色设置已保存并应用到游戏！');
});

resetButton.addEventListener('click', async () => {
    colorSets = defaultColorSets;
    updateUI();
});

outputButton.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(colorSets, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "customColors.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
});

function importColorsFromFile(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedColors = JSON.parse(event.target.result);
            if (importedColors['hidden'] === undefined || importedColors['mine'] === undefined || importedColors['flag'] === undefined) {
                alert('导入的颜色设置文件格式不正确，缺少必要的颜色项（hidden, mine, flag），不要乱导😡');
                return;
            }
            colorSets = importedColors;
            updateUI();
            alert('颜色设置已导入并应用到游戏！');
        } catch (e) {}
    };
    reader.readAsText(file);
}

importButton.addEventListener('click', () => {
    importInput.click();
});

importInput.addEventListener('change', (event) => {
    if (event.target.files && event.target.files.length > 0) {
        importColorsFromFile(event.target.files[0]);
    }
    event.target.value = '';    // 清空输入以允许重复上传同一文件
});

resetDefaultButton.addEventListener('click', async () => {
    try {
        const res = await fetch('./blockColors.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        let text = await res.text();
        colorSets = JSON.parse(text);
        updateUI();
    } catch (error) {}
});

getColorsButton.addEventListener('click', () => {
    let gameColors = JSON.parse(localStorage.getItem(COLORSET_KEY));
    if (gameColors) colorSets = gameColors;
    updateUI();
});

updateUI();

candyColorButton.addEventListener('click', async () => {
    try {
        await fetch('./candyColor.json').then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        }).then(text => {
            colorSets = JSON.parse(text);
            updateUI();
        });
    } catch (error) {}
});