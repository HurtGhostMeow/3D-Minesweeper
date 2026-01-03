import { highlightModule } from "./show_module.js";

// 获取致谢按钮元素
const thanksDiv = document.getElementById('thanks');
const light = highlightModule('thanks-js');

// 异步获取致谢内容的函数
async function loadThanksText(path = 'thanks.txt') {
    try {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.text();
    } catch (error) {
        console.error('获取致谢内容时出错：', error);
        return '无法加载致谢内容。';
    }
}

// 点击时再异步读取并展示
thanksDiv.addEventListener('click', async () => {
    light.on();
    console.log('点击致谢按钮');
    const content = await loadThanksText();
    console.log(content);

    // 创建遮罩和内容框
    const overlay = document.createElement('div');
    overlay.id = 'overlay';

    // 创建内容框
    const box = document.createElement('div');
    box.id = 'thanksBox';
    box.className = 'blur-box';
    box.innerHTML = "<h1> 致谢 </h1>";

    // 添加thanks.txt的内容
    const div1 = document.createElement('div');
    div1.style.color = "white";
    div1.style.textAlign = "center";
    div1.innerText = content;

    // 添加logo
    const div2 = document.createElement('div');
    div2.style.height = "10vh";
    div2.style.width = "30vw";
    div2.style.margin = "8vh auto";
    div2.style.position = "relative";
    div2.style.bottom = "0";
    div2.style.display = "flex";
    div2.style.alignItems = "center";

    div2.innerHTML = "<img src=\"img/logo.svg\" alt=\"Logo\" style=\"width: 100%; height: auto;\">";

    // 添加联系邮箱
    const div3 = document.createElement('div');
    div3.style.textAlign = "center";
    div3.style.position = "relative";
    div3.style.bottom = "0px";
    div3.innerText = "联系邮箱：HurtGhostMeow1@outlook.com";

    box.appendChild(div1);
    box.appendChild(div2);
    box.appendChild(div3);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // 防止点击内容区域触发遮罩关闭
    box.addEventListener('click', (e) => e.stopPropagation());
        // 关闭方法：添加退出动画类，等动画结束后移除元素并清理监听器
        const close = () => {
            overlay.classList.add('closing');
            box.classList.add('closing');

            const onAnimEnd = (event) => {
                if (event.target === overlay) {
                    overlay.removeEventListener('animationend', onAnimEnd);
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    document.removeEventListener('keydown', onKey);
                }
            };

            overlay.addEventListener('animationend', onAnimEnd);
            light.off();
        };

        // 点击遮罩（非内容）关闭
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // 按 Esc 关闭
        function onKey(e) {
            if (e.key === 'Escape') close();
        }
        document.addEventListener('keydown', onKey);
    });