import { highlightModule } from "./show_module.js"; //导入模块以实现模块高亮😊


// 定义有关菜单的变量和元素
let isOpen = false;
const menuButton = document.querySelector('#menu');
let setTheme = 'auto';
const THEME_KEY = 'site-theme'; // 本地存储主题的键名
const root = document.documentElement;
const light = highlightModule('menu-js');   // 高亮模块

let menudiv = document.createElement('div');    // 创建菜单容器
menudiv.className = 'blur-box';
menudiv.id = 'menu-div';

let themeSwitch = document.createElement('button'); // 创建主题切换按钮
themeSwitch.id = 'theme-switch';
themeSwitch.style.fontFamily = 'Noto Emoji, sans-serif';
themeSwitch.innerText = '🌗';
themeSwitch.title = '切换自动/浅色/深色主题模式';

let colorSwitcher = document.createElement('input');    // 创建颜色配置文件上传输入
colorSwitcher.type = 'file';
colorSwitcher.id = 'color-switcher';
colorSwitcher.accept = '.json, application/json';
colorSwitcher.acceptCharset = 'UTF-8';
colorSwitcher.title = '上传自定义方块颜色配置文件（JSON格式）';
colorSwitcher.style.display = 'none';

let colorSwitcherButton = document.createElement('button'); // 创建颜色配置上传按钮
colorSwitcherButton.id = 'color-switcher-button';
colorSwitcherButton.style.fontFamily = 'Noto Emoji, sans-serif';
colorSwitcherButton.innerText = '🎨';
colorSwitcherButton.title = '上传自定义方块颜色配置文件';
colorSwitcherButton.addEventListener('click', () => {
    light.on();
    colorSwitcher.click();
    light.off();
})

let colorDefault = document.createElement('button'); // 创建恢复默认颜色按钮
colorDefault.id = 'color-default-button';
colorDefault.style.fontFamily = 'Noto Emoji, sans-serif';
colorDefault.innerText = '🔃';
colorDefault.title = '恢复默认方块颜色配置';
colorDefault.onclick = ()=> {
    window.dispatchEvent(new CustomEvent('color-file-selected', { detail: "./blockColors.json" }));
}

let colorToolHTML = document.createElement('button');   // 创建打开颜色配置工具页面按钮
colorToolHTML.id = 'color-tool-button';
colorToolHTML.style.fontFamily = '"Noto Emoji", "Segoe UI Symbol", sans-serif';
colorToolHTML.style.fontVariantEmoji = 'text';
colorToolHTML.innerText = '🛠️';
colorToolHTML.title = '打开方块颜色配置工具页面';
colorToolHTML.onclick = ()=> {
    window.open('./colorSet.html', '_blank');
};

let uploadInput = document.createElement('input');  // 创建游戏存档上传输入
uploadInput.type = 'file';
uploadInput.id = 'upload-input';
uploadInput.accept = '.json, application/json';
uploadInput.acceptCharset = 'UTF-8';
uploadInput.style.display = 'none';

let uploadButton = document.createElement('button');    // 创建游戏存档上传按钮
uploadButton.id = 'upload-button';
uploadButton.style.fontFamily = 'Noto Emoji, sans-serif';
uploadButton.innerText = '⏫';
uploadButton.title = '上传游戏存档';
uploadButton.addEventListener('click', () => {
    light.on();
    uploadInput.click();
    light.off();
});

let saveButton = document.createElement('button');  // 创建游戏存档保存按钮
saveButton.id = 'save-button';
saveButton.style.fontFamily = 'Noto Emoji, sans-serif';
saveButton.innerText = '💾';
saveButton.title = '保存游戏存档';
saveButton.addEventListener('click', () => {
    light.on();
    window.dispatchEvent(new CustomEvent('request-game-state', {
        detail: (gameState) => {
            let saveOutput = document.createElement('a');
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(gameState, null, 4));
            saveOutput.setAttribute("href", dataStr);
            saveOutput.setAttribute("download", "minesweeper_save.json");
            saveOutput.click();
        }
    }));
    
    light.off();
});

const backButton = document.createElement('button');
backButton.id = 'back-button';
backButton.style.fontFamily = 'Noto Emoji, sans-serif';
backButton.innerText = '🏠';
backButton.title = '返回游戏主页面';
backButton.onclick = () => {
    window.location.href = './index.html';
}


// 读取用户上传的颜色 JSON 文件并通过事件传给主模块
colorSwitcher.addEventListener('change', (event) => {
    if (!event.target.files || event.target.files.length === 0) {
        alert('你咋啥也不选啊😶‍🌫️');
        console.log('No file selected');
        return;
    }

    const file = event.target.files[0];
    
    window.dispatchEvent(new CustomEvent('color-file-selected', { detail: file })); // 定义新事件以传输文件
    console.log('Dispatched color-file-selected for file', file.name);
    event.target.value = '';    // 清空输入以允许重复上传同一文件
});

// 读取用户上传的存档 JSON 文件并通过事件传给主模块
uploadInput.addEventListener('change', (event) => {
    if (!event.target.files || event.target.files.length === 0) {
        alert('你咋啥也不选啊😶‍🌫️');
        console.log('No file selected');
        return;
    }

    const file = event.target.files[0];

    window.dispatchEvent(new CustomEvent('upload-file-selected', { detail: file }));
    console.log('Dispatched upload-file-selected for file', file.name);
    event.target.value = '';  // 清空输入以允许重复上传同一文件
});

// 定义菜单切换函数
function toggleMenu() {
    light.on();
    if(isOpen) {
        const closeMenu = () => {
            menudiv.classList.add('closing');

            const onAnimEnd = (event) => {
                if (event.target === menudiv) {
                    menudiv.removeEventListener('animationend', onAnimEnd);
                    menudiv.classList.remove('closing');
                    if (document.body.contains(menudiv)) document.body.removeChild(menudiv);
                }
            };
            menudiv.addEventListener('animationend', onAnimEnd);
        }
        if (document.body.contains(menudiv)) closeMenu();
        isOpen = false;
    }//关闭菜单
    else {
        // 如果之前关闭时添加了 `closing` 类，打开前先移除，避免刚附加时立即播放关闭动画
        menudiv.classList.remove('closing');
        document.body.appendChild(menudiv);

        // 添加菜单元素
        if (!menudiv.contains(themeSwitch)) menudiv.appendChild(themeSwitch);
        if (document.getElementById('game-box')) {
            if (!menudiv.contains(colorSwitcher)) menudiv.appendChild(colorSwitcher);
            if (!menudiv.contains(colorSwitcherButton)) menudiv.appendChild(colorSwitcherButton);
            if (!menudiv.contains(colorDefault)) menudiv.appendChild(colorDefault);
            if (!menudiv.contains(colorToolHTML)) menudiv.appendChild(colorToolHTML);
            if (!menudiv.contains(uploadInput)) menudiv.appendChild(uploadInput);
            if (!menudiv.contains(uploadButton)) menudiv.appendChild(uploadButton);
            if (!menudiv.contains(saveButton)) menudiv.appendChild(saveButton);
        } else if (document.getElementById('color-set-box')) {
            if (!menudiv.contains(backButton)) menudiv.appendChild(backButton);
        }
        isOpen = true;
    }//打开菜单
    light.off();
}

// 定义主题切换函数
function toggleLightDark() {
    light.on();
    // 循环：auto -> light -> dark -> auto
    if (setTheme === 'auto') setTheme = 'light';
    else if (setTheme === 'light') setTheme = 'dark';
    else setTheme = 'auto';
    updateThemeAttribute();
    light.off();
}

// 定义更新主题属性函数
function updateThemeAttribute() {
    if (setTheme === 'auto') {
        root.style.setProperty('color-scheme', 'light dark');
        themeSwitch.innerText = '🌗';
    } else {
        root.style.setProperty('color-scheme', setTheme);
        themeSwitch.innerText = setTheme === 'light' ? '🌞' : '🌜';
    }
    try {
        localStorage.setItem(THEME_KEY, setTheme);
    } catch (e) {}
}

if (menuButton) menuButton.addEventListener('click', toggleMenu);
themeSwitch.addEventListener('click', toggleLightDark);

// 加载本地持久化的主题（若存在且合法）
try {
    light.on();
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') {
        setTheme = saved;
    }
    light.off();
} catch (e) {
    console.warn('Failed to load theme from localStorage:', e);
}

// 初始化页面主题状态
updateThemeAttribute();

// 在加载时根据加载框状态禁用或启用保存和上传按钮,以防止在加载过程中进行这些操作而导致游戏崩溃
function disabledButtonsDuringLoad() {
    if (document.getElementById('load-box')){
        light.on();
        saveButton.disabled = true;
        uploadButton.disabled = true;
        setInterval(() => { // 每500毫秒轮询检查一次加载框状态
            if (!document.getElementById('load-box')) {
                light.on();
                disabledButtonsDuringLoad();
                light.off();
                clearInterval(this);
            }
        }, 500);
        light.off();
    } else {
        light.on();
        saveButton.disabled = false;
        uploadButton.disabled = false;
        light.off();
    }
}

window.addEventListener('load', disabledButtonsDuringLoad)