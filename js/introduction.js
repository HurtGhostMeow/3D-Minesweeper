import { highlightModule } from "./show_module.js";

// 获取介绍区域和对应的模块高亮控制器
const intro = document.getElementById('introduction');
const light = highlightModule('introduction-js');

// 保存正反两面的内容
let isFront = true;
const frontContent = intro.innerHTML;
const backContent = `
<h2 style="text-align: center;">算法说明</h2>
<p>本游戏利用模块化思维，将3D部分的渲染器独立成单独的模块，将UI读取独立成单独的模块，将经典扫雷的函数独立到单独的模块，再整合成完整的游戏系统</p>
<p>在其他js文件中，只能利用模块暴露出来的函数和变量，不能直接操作模块内部的实现细节，从而实现代码的高内聚和低耦合</p>
<p>扫雷的雷区生成算法采用随机放置地雷，然后计算每个格子周围地雷数量的经典方法</p>
<p>无缝衔接、连通性：在游戏主循环中，渲染器模块和UI模块交替调用，确保3D渲染和UI显示的同步更新；同时，颜色自定义工具会将设置好的颜色无缝衔接地应用在游戏中</p>
<p>比特精准：每一个游戏状态和用户操作都被精确地记录和处理，确保游戏逻辑的正确性和响应速度</p>
<h2 style="text-align: center;">模块说明</h2>
<p>本游戏由多个js模块组成，每个模块负责不同的功能</p>
<p>模块之间通过暴露的接口进行通信，确保代码的高内聚和低耦合</p>
<br />
<p>当下面的js文件被调用时，对应的文字会被点亮（持续点亮代表该模块正在持续被使用）</p>
<div class="show-module" id="menu-js"> menu.js </div>
<br />
<div class="show-module" id="introduction-js"> introduction.js </div>
<br />
<div class="show-module" id="music-js"> music.js </div>
<br />
<div class="show-module" id="thanks-js"> thanks.js </div>
<br />
<div class="show-module" id="game-main-js"> game_main.js </div>
<br />
<div class="show-module" id="game-renderer-js"> game_renderer.js </div>
<br />
<div class="show-module" id="game-minesweeper-js"> game_minesweeper.js </div>
<br />
<div class="show-module" id="game-ui-js"> game_ui.js </div>
<br />
<div class="show-module" id="show-module-js"> show_module.js </div>`;

async function rotateIntro() {
    light.on();
    
    // 防止重复触发
    if (intro._animating) return;
    intro._animating = true;

    // 使用 Web Animations API 做一个简短的 Y 轴翻转：0 -> 90deg，交换内容，再 90deg -> 0
    try {
        // 出场动画（翻起）
        await intro.animate(
            [ { transform: 'rotateY(0deg)' }, { transform: 'rotateY(90deg)' } ],
            { duration: 300, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'forwards' }
        ).finished;

        // 交换内容
        if (isFront) {
            intro.innerHTML = backContent;
            isFront = false;
        } else {
            intro.innerHTML = frontContent;
            isFront = true;
        }

        // 进场动画（翻回）
        await intro.animate(
            [ { transform: 'rotateY(90deg)' }, { transform: 'rotateY(0deg)' } ],
            { duration: 300, easing: 'cubic-bezier(.3,0,.7,1)', fill: 'forwards' }
        ).finished;

    } catch (err) {
        // 如果浏览器不支持 Web Animations API，回退到直接切换内容
        if (isFront) {
            intro.innerHTML = backContent;
            isFront = false;
        } else {
            intro.innerHTML = frontContent;
            isFront = true;
        }
    } finally {
        intro.style.transform = '';
        intro._animating = false;
    }

    light.off();
}

// 绑定点击事件以触发翻转
intro.addEventListener('click', rotateIntro);
