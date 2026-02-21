export function highlightModule(moduleId) {
    // 参数检查
    if (typeof moduleId !== 'string') throw new TypeError('highlightModule expects a string id');

    // 高亮状态标志
    let shouldHighlight = false;
    let observer = null;
    let pollingInterval = null;

    //查询元素
    function findElement() {
        return document.getElementById(moduleId);
    }

    // 添加高亮
    const add = (element) => {
        if (element && !element.classList.contains('light')) {
            element.classList.add('light');
        }
    }

    // 移除高亮
    const remove = (element) => {
        if (element && element.classList.contains('light')) {
            element.classList.remove('light');
        }
    }

    // 检查并应用高亮状态
    function checkAndApply() {
        const element = findElement();
        if (element) {
            if (shouldHighlight) {
                add(element);
            } else {
                remove(element);
            }
        }
    }

    function startObserver() {
        // 启动 MutationObserver
        if (!observer && typeof MutationObserver !== 'undefined') {
            observer = new MutationObserver(() => {
                checkAndApply();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        // 增加轮询作为双重保险,以防某些情况下 MutationObserver 无法捕捉到变化
        if (!pollingInterval) {
            pollingInterval = setInterval(checkAndApply, 300);
        }
    }

    // 开启高亮
    function on() {
        shouldHighlight = true;
        checkAndApply();
        startObserver();
    }

    // 延时关闭高亮
    function off( t = 1000 ) {
        setTimeout(() => {
            shouldHighlight = false;
            checkAndApply();
        
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        
            if (pollingInterval) {
                clearInterval(pollingInterval);
                pollingInterval = null;
            }
        }, t);
    }

    // 无参数傻瓜式切换高亮状态
    function toggle() {
        if (shouldHighlight) {
            off();
        } else {
            on();
        }
    }

    // 带有回调函数的高亮切换
    async function lightWithToggle(func){
        if (typeof func !== 'function') throw new TypeError('lightWithToggle expects a function');
        on();
        try{
            const result = func();
            if (result && (typeof result.then === 'function')) return await result;
            return result;
        } finally {
            off();
        }
    }

    return { on, off, toggle, lightWithToggle };
}

// 自动点亮 show_module.js 自身的逻辑
(function setupSelfHighlight() {
    const selfLight = highlightModule('show-module-js');
    let isHandling = false;

    // 使用 MutationObserver 监听 show-module 类的变化
    const observer = new MutationObserver((mutations) => {
        if (isHandling) return;

        const hasModuleChange = mutations.some(mutation => {
            const target = mutation.target;
            // 检查是否是 show-module 类的元素发生了 class 变动
            // 排除掉 show-module-js 自身，防止死循环
            return target.classList && 
                   target.classList.contains('show-module') && 
                   target.id !== 'show-module-js' &&
                   mutation.attributeName === 'class';
        });

        if (hasModuleChange) {
            isHandling = true;
            selfLight.on();
            selfLight.off(0);
            isHandling = false;
        }
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class']
    });
})();   // 立即执行函数，设置对 show-module 类的监听