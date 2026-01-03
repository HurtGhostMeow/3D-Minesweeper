import * as THREE from 'https://esm.sh/three@0.180.0'; // 导入 ThreeJS
import { OrbitControls } from 'https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js'; // 导入轨道控制器
import { highlightModule } from "./show_module.js";

const light = highlightModule('game-renderer-js');

// 初始化游戏场景（这部分AI帮助较多，因为刚学ThreeJS的时候不会用）
export function initGameScene(){
    light.on();
    const container = document.getElementById('game-container');    //获取游戏画布容器

    const scene = new THREE.Scene();//创建场景

    const camera = new THREE.PerspectiveCamera(70, container.clientWidth / container.clientHeight, 0.1, 1000);    //创建透视相机
    camera.position.set(10, 10, 10);    //设置相机位置

    const canvas = document.getElementById('game-canvas');
    const renderer = new THREE.WebGLRenderer({  // 创建透明背景渲染器
        canvas,
        antialias: true,
        alpha: true
    });

    renderer.setSize(container.offsetWidth, container.offsetHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);// 创建渲染器

    const controls = new OrbitControls(camera, renderer.domElement);    // 轨道控制器（旋转、缩放、平移均于内部实现）
    controls.enableDamping = true;  // 启用阻尼（惯性）
    controls.dampingFactor = 0.1;   // 阻尼系数

    // 灯光设置
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 环境光
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // 平行光
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const raycaster = new THREE.Raycaster(); // 鼠标射线
    const mouse = new THREE.Vector2(); // 鼠标位置

    light.off(0);

    return { scene, camera, renderer, controls, raycaster, mouse };
}

// 渲染循环
export function renderLoop(renderer, scene, camera, controls) {
    function animate() {
        light.on();
        requestAnimationFrame(animate); // 请求下一帧
        controls.update(); // 控制器更新
        renderer.render(scene, camera); // 渲染帧
        light.off(0);
    }
    animate();
}

// 调整渲染器大小
export function resizeRenderer(renderer, camera) {
    light.on();
    const container = document.getElementById('game-container');
    if (!container) return;
    camera.aspect = container.offsetWidth / container.offsetHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    light.off(0);
}
