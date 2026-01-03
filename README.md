# 三维扫雷 - 模块化思维 🧩

本游戏体现了计算机科学导论中的多个知识点，包括模块化思维、比特精准、无缝衔接等。✨

This project demonstrates several CS concepts taught in introductory courses, including modular design, bit-level precision, and seamless integration. ✨

## 主要内容 🎮

使用 Three.js 实现的三维扫雷，可以选择不同难度，也可以自定义难度，并且可以自定义方块颜色。

A 3D Minesweeper built with Three.js. Players can choose preset difficulties or customize difficulty and block colors. 

主页面 Home

<img width="1836" height="1083" alt="image" src="https://github.com/user-attachments/assets/ccfd2cbc-ee55-4df4-a789-5a712ecf4cf6" />

<img width="1844" height="1083" alt="image" src="https://github.com/user-attachments/assets/b47956fb-3d9a-432d-be14-09451170886b" />

## 文件结构 📁

- `index.html`：游戏主页
- `js/`：主要交互与游戏逻辑文件，如 `game_main.js`、`game_minesweeper.js`、`game_renderer.js` 等
- `img/`、`font/`、`music/`：图片、字体与音频资源（彩蛋和 BGM 可能未包含以避免版权问题）
- `colorSet.html`、`blockColors.json`、`candyColor.json`：颜色选择相关页面与数据

- `index.html` is the entry page 
- `js/` contains game logic (e.g., `game_main.js`, `game_minesweeper.js`, `game_renderer.js`)
- `img/`, `font/`, and `music/` store assets (some audio easter eggs/BGM might be excluded due to copyright)
- color-related pages and data are under `colorSet.html`, `blockColors.json`, and `candyColor.json`

## 如何本地运行 🛠️

1. 在文件管理器中打开此文件夹。

Open the folder in your file manager.

2. 推荐使用一个简单的本地服务器：

   - Python 3.x:

     ```bash
     cd 期末作业网页
     python -m http.server 8000
     ```

   - 然后在浏览器访问 `http://localhost:8000`🔗

   或者Fork此仓库，在设置中打开Github Pages

Serve the folder locally (example using Python 3) and visit `http://localhost:8000`, or fork this repository and open the Github Pages. 

## 作者与致谢 🙏

- 作者：HurtGhostMeow
- 致谢：徐志伟老师、黄英豪老师的鼓励与指导
- 特别感谢在项目中使用的开源素材与参考实现
- 感谢 Copilot 等 AI 在学习与编写过程中的帮助

Author: HurtGhostMeow. 

Thanks to instructors Zhiwei Xu and Yinghao Huang for encouragement and guidance. 

Gratitude to open-source resources and tools (including AI assistants like Copilot) used during development.

## 许可证 📝
本项目采用 [BSD-3-Clause License](./LICENSE) 许可证
