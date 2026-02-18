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

// 创建遮罩和内容框
const overlay = document.createElement('div');
overlay.id = 'setting-overlay';

// 定义设置页面变量，稍后初始化
const SETTINGS_KEY = `site-settings`;
let settingsDiv = document.createElement('div');    // 设置页面容器
settingsDiv.id = 'settings-div';
settingsDiv.className = 'blur-box';
settingsDiv.style.display = 'none';    // 初始状态隐藏
let settingsInitialized = false; // 标记设置面板是否已完成初始化（防止重复注册事件）
let settings; // 用于存储当前设置状态的对象

function showSettings() {
    if (!settings) {
        const saved = localStorage.getItem(SETTINGS_KEY);
        settings = saved ? JSON.parse(saved) : null;
        if (!settings) {
            settings = {
                spacing: 2.2,
                blockOpacity: 0.3,
                introduceShow: true
                };
        }
    }

    console.log('showSettings called', {
        overlayInDOM: !!document.getElementById('setting-overlay'),
        settingsInDOM: document.body.contains(settingsDiv),
        settingsInitialized: settingsInitialized
    });
    // 关闭方法：添加退出动画类，等动画结束后移除元素并清理监听器
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
        overlay.classList.add('closing');
        settingsDiv.classList.add('closing');
        // 后备移除：如果没有动画事件触发，强制在一定时间后移除遮罩
        let fallbackRemove = setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            document.removeEventListener('keydown', onKey);
        }, 400);

        const onAnimEnd = (event) => {
            if (event.target === overlay) {
                overlay.removeEventListener('animationend', onAnimEnd);
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                document.removeEventListener('keydown', onKey);
                clearTimeout(fallbackRemove);
            }
        };

        overlay.addEventListener('animationend', onAnimEnd);
        // 在进入关闭动画同时关闭高亮
        light.off();
    }

    // 如果遮罩已在文档中，则执行关闭
    if (document.body.contains(document.getElementById('setting-overlay'))) {
        close();
        return;
    }

    // 显示面板
    document.body.appendChild(overlay);
    overlay.appendChild(settingsDiv);
    // 清理可能遗留的关闭类，确保能重复打开
    overlay.classList.remove('closing');
    settingsDiv.classList.remove('closing');
    settingsDiv.style.display = 'block';
    light.on();

    const initialOpacity = (settings && typeof settings.blockOpacity === 'number') ? settings.blockOpacity : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--blur-opacity') || 0.3);
    let opacitySettingDiv = document.createElement('div');
    opacitySettingDiv.id = 'opacity-setting-div';
    opacitySettingDiv.className = `blur-box`;
    opacitySettingDiv.innerHTML = `
        <h2>透明度设置</h2>
        <div class="setting-row">
            <input type="range" id="opacity-range" min="0" max="1" step="0.01" value="${initialOpacity}">
            <label for="opacity-range">当前值: <span id="opacity-value">${initialOpacity}</span></label>
            <button id="opacity-reset-button" class="small" title="恢复默认透明度" style="font-family: 'Noto Emoji'">🔄️</button>
        </div>
    `;

    let spacingSettingDiv = document.createElement('div');
    spacingSettingDiv.id = 'spacing-setting-div';
    spacingSettingDiv.className = `blur-box`;
    const initialSpacing = (settings && typeof settings.spacing === 'number') ? settings.spacing : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--block-spacing') || 2.2);
    spacingSettingDiv.innerHTML = `
        <h2>方块间距设置</h2>
        <div class="setting-row">
            <input type="range" id="spacing-range" min="2" max="5" step="0.1" value="${initialSpacing}">
            <label for="spacing-range">当前值: <span id="spacing-value">${initialSpacing}</span></label>
            <button id="spacing-reset-button" class="small" title="恢复默认间距" style="font-family: 'Noto Emoji'">🔄️</button>
        </div>
    `;

    let introduceShowDiv = document.createElement('div');
    introduceShowDiv.id = 'introduce-show-div';
    introduceShowDiv.className = `blur-box`;
    introduceShowDiv.innerHTML = `
        <h2>介绍模块开关</h2>
        <button id="introduce-toggle-button">${settings && settings.introduceShow ? '隐藏介绍模块' : '显示介绍模块'}</button>
    `;

    // 初始化面板内容和事件（只做一次）
    if (!settingsInitialized) {
        settingsDiv.appendChild(opacitySettingDiv);
        settingsDiv.appendChild(spacingSettingDiv);
        settingsDiv.appendChild(introduceShowDiv);

        // 防止点击内容区域触发遮罩关闭
        settingsDiv.addEventListener('click', (e) => e.stopPropagation());
        // 阻止菜单区域的点击冒泡
        menuButton.addEventListener('click', (e) => e.stopPropagation());
        menudiv.addEventListener('click', (e) => e.stopPropagation());

        // 点击遮罩（非内容）关闭
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // 按 Esc 关闭
        document.addEventListener('keydown', onKey);

        // 滑块行为：绑定事件，立即反映到 CSS 变量
        const opacityRange = settingsDiv.querySelector('#opacity-range');
        const opacityValue = settingsDiv.querySelector('#opacity-value');
        const spacingRange = settingsDiv.querySelector('#spacing-range');
        const spacingValue = settingsDiv.querySelector('#spacing-value');

        if (opacityRange && opacityValue) {
            opacityRange.addEventListener('input', (e) => {
                const v = String(parseFloat(e.target.value));
                document.documentElement.style.setProperty('--blur-opacity', v);
                opacityValue.textContent = v;
                try {
                    settings.blockOpacity = parseFloat(v);
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                    window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
                } catch (err) {}
            });
            const opacityReset = settingsDiv.querySelector('#opacity-reset-button');
            if (opacityReset) {
                opacityReset.addEventListener('click', () => {
                    const def = 0.3;
                    document.documentElement.style.setProperty('--blur-opacity', String(def));
                    opacityRange.value = def;
                    opacityValue.textContent = def;
                    try {
                        settings.blockOpacity = def;
                        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                        window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
                    } catch (err) {}
                });
            }
        }

        if (spacingRange && spacingValue) {
            spacingRange.addEventListener('input', (e) => {
                const v = String(parseFloat(e.target.value));
                document.documentElement.style.setProperty('--block-spacing', v);
                spacingValue.textContent = v;
                try {
                    settings.spacing = parseFloat(v);
                    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                    window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
                } catch (err) {}
            });
            const spacingReset = settingsDiv.querySelector('#spacing-reset-button');
            if (spacingReset) {
                spacingReset.addEventListener('click', () => {
                    const def = 2.2;
                    document.documentElement.style.setProperty('--block-spacing', String(def));
                    spacingRange.value = def;
                    spacingValue.textContent = def;
                    try {
                        settings.spacing = def;
                        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                        window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
                    } catch (err) {}
                });
            }
        }

        const introBtn = document.getElementById('introduce-toggle-button');
        introBtn.addEventListener('click', () => {
            settings.introduceShow = !settings.introduceShow;
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
                window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
            } catch (err) {}
            introBtn.innerText = settings.introduceShow ? '隐藏介绍模块' : '显示介绍模块';
        });

        settingsInitialized = true;
        console.log('settings initialized: sliders and handlers bound');
    }

    // Ensure settings reflect current UI/CSS variables
    settings.spacing = (settings && typeof settings.spacing === 'number') ? settings.spacing : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--block-spacing'));
    settings.blockOpacity = (settings && typeof settings.blockOpacity === 'number') ? settings.blockOpacity : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--blur-opacity'));

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // 通知同窗口内的模块（game_main）设置已更改
    try {
        window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }));
    } catch (e) {}

    // 轮询检查设置面板是否被意外移除（例如通过开发者工具），如果是则清理事件监听器
    let pollingInterval = setInterval(() => {
        if (!document.body.contains(overlay)) {
            document.removeEventListener('keydown', onKey);
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }, 1000);
    // 每次打开都把 UI 控件与 settings 同步（以防已初始化但 settings 已在别处改变）
    const opacityRangeNow = settingsDiv.querySelector('#opacity-range');
    const opacityValueNow = settingsDiv.querySelector('#opacity-value');
    const spacingRangeNow = settingsDiv.querySelector('#spacing-range');
    const spacingValueNow = settingsDiv.querySelector('#spacing-value');
    const introBtnNow = settingsDiv.querySelector('#introduce-toggle-button');
    if (opacityRangeNow) { opacityRangeNow.value = settings.blockOpacity; if (opacityValueNow) opacityValueNow.textContent = settings.blockOpacity; }
    if (spacingRangeNow) { spacingRangeNow.value = settings.spacing; if (spacingValueNow) spacingValueNow.textContent = settings.spacing; }
    if (introBtnNow) introBtnNow.innerText = settings.introduceShow ? '隐藏介绍模块' : '显示介绍模块';
    
}

class MenuItem {
    constructor(id, emoji, title, onClick = null) {
        this.button = document.createElement('button');
        this.button.id = id;
        this.button.innerText = emoji;
        this.button.title = title;
        this.button.onclick = onClick;
        this.button.style.fontFamily = 'Noto Emoji, sans-serif';
    }
}

let themeSwitch = new MenuItem('theme-switch', '🌗', '切换自动/浅色/深色主题模式', toggleLightDark).button; //创建主题切换按钮

let colorSwitcher = document.createElement('input');    // 创建颜色配置文件上传输入
colorSwitcher.type = 'file';
colorSwitcher.id = 'color-switcher';
colorSwitcher.accept = '.json, application/json';
colorSwitcher.acceptCharset = 'UTF-8';
colorSwitcher.title = '上传自定义方块颜色配置文件（JSON格式）';
colorSwitcher.style.display = 'none';

let colorSwitcherButton = new MenuItem('color-switcher-button', '🎨', '上传自定义方块颜色配置文件', () => light.lightWithToggle(() => colorSwitcher.click())).button; // 创建颜色配置上传按钮

let colorDefault = new MenuItem('color-default-button', '🔃', '恢复默认方块颜色配置', () => light.lightWithToggle(() => window.dispatchEvent(new CustomEvent('color-file-selected', { detail: "./blockColors.json" })))).button; // 创建恢复默认颜色配置按钮

let colorToolHTML = new MenuItem('color-tool-button', '🛠️', '打开方块颜色配置工具页面', () => light.lightWithToggle(() => window.open('./colorSet.html', '_blank'))).button;   // 创建打开颜色配置工具页面按钮

let uploadInput = document.createElement('input');  // 创建游戏存档上传输入
uploadInput.type = 'file';
uploadInput.id = 'upload-input';
uploadInput.accept = '.json, application/json';
uploadInput.acceptCharset = 'UTF-8';
uploadInput.style.display = 'none';

let uploadButton = new MenuItem('upload-button', '⏫', '上传游戏存档', () => { light.lightWithToggle(() => uploadInput.click()); }).button;    // 创建游戏存档上传按钮

let saveButton = new MenuItem('save-button', '💾', '保存游戏存档', () => { light.on();
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
}).button;  // 创建游戏存档保存按钮

const backButton = new MenuItem('back-button', '🏠', '返回游戏主页面', () => {light.lightWithToggle(() => window.location.href = './index.html');}).button;  // 创建返回主页面按钮

const settingsButton = new MenuItem('settings-button', '⚙️', '打开设置页面', () => {light.lightWithToggle(() => showSettings());}).button;  // 创建打开设置页面按钮

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
            if (!menudiv.contains(settingsButton)) menudiv.appendChild(settingsButton);
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
        const intervalId = setInterval(() => { // 每500毫秒轮询检查一次加载框状态
            if (!document.getElementById('load-box')) {
                light.on();
                disabledButtonsDuringLoad();
                light.off();
                clearInterval(intervalId);
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