import { highlightModule } from './show_module.js';

const music = document.getElementById('background-music');
const music_button = document.getElementById('music-control');
let isPlaying = false;
const light = highlightModule('music-js');


// 音乐音量变化，以实现淡出淡入效果🥰
function fade_in(){
    music.volume = 0.0;

    let fade=setInterval(function(){
        music.play();
        console.log(music.volume);

        if(music.volume<0.3){
            music.volume+=0.01;
        }else{
            if(music.volume<0.7){
                music.volume+=0.02;
            }else{
                if(music.volume>0.7 && music.volume<1.0){
                    music.volume = 1.0;
                }else{
                    clearInterval(fade);
                }
            }
        }},10);
}

function fade_out(){
    let fade=setInterval(function(){
        console.log(music.volume);
        if(music.volume>0.7){
            music.volume-=0.01;
        }else{
            if(music.volume>0.3){
                music.volume-=0.02;
            }else{
                if(music.volume<0.3 && music.volume>0.0){
                    music.volume = 0.0;

                    music.pause();
                }else{
                    clearInterval(fade);
                }
            }
        }},10);
}

// 按下按钮后的处理函数
function toggleMusic() {
    light.on();
    if (isPlaying) {
        fade_out();
        isPlaying = false;
        music_button.innerText = "背景音乐播放";
    } else {
        fade_in();
        isPlaying = true;
        music_button.innerText = "背景音乐暂停";
    }
    light.off();
}


// 监听按钮点击
music_button.addEventListener('click', toggleMusic);