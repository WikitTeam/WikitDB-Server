// components/HeroAsciiCanvas.js
import React, { useEffect, useRef } from 'react';

/**
 * Hero 算法艺术背景（双层渲染管线）：
 *
 *  1. 粒子层：紫色光尘从右侧生成、向左漂移，附正弦扰动，
 *     生命周期内淡入淡出，用 additive 混合叠加出亮度层次；
 *  2. ASCII 后处理：粒子被绘制进「一格 = 一像素」的低分辨率离屏画布，
 *     逐格读取 alpha 亮度 -> 映射为字符密度 + 紫色色阶，
 *     通过预渲染字符图集 drawImage 输出（避免每帧上万次 fillText 光栅化）。
 *
 * 性能策略：
 *  - 输出画布 DPR 上限 1.5（ASCII 本身是像素风，高 DPR 无收益）；
 *  - 固定 ~32fps 节流（颗粒漂移动画对帧率不敏感）；
 *  - 亮度低于阈值的单元格直接跳过，实际 drawImage 次数远小于格子总数；
 *  - 固定粒子池复用、零 GC 压力；scene getImageData 仅 cols×rows 像素；
 *  - 滚出视口 / 页面切后台自动停帧；respects prefers-reduced-motion。
 */

// 字符密度阶梯：由疏到密（索引随亮度增大）
const GLYPHS = '.,:;-=+*x#%@';
// 紫色色阶：暗 -> 亮，与亮度区间对应
const SHADES = [
    'rgba(91,33,182,0.55)',
    'rgba(124,58,237,0.75)',
    'rgba(139,92,246,0.90)',
    'rgba(167,139,250,1)',
    'rgba(237,233,254,1)'
];
const LUM_MIN = 0.09;          // 低于此亮度的格子不绘制
const FRAME_MS = 1000 / 32;    // ~32fps

const HeroAsciiCanvas = () => {
    const ref = useRef(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || !canvas.parentElement) return undefined;

        const ctx = canvas.getContext('2d');
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let raf = 0;
        let running = false;
        let inView = true;
        let W = 0;            // 逻辑宽（css px）
        let H = 0;            // 逻辑高
        let dpr = 1;
        let cols = 0;         // ASCII 列数
        let rows = 0;         // ASCII 行数
        let cellW = 8;        // 单元格宽（css px）
        let cellH = 13;       // 单元格高
        let acw = 0;          // 图集单元宽（物理 px）
        let ach = 0;          // 图集单元高
        let scene = null;     // 低分辨率离屏画布（1 cell = 1 px）
        let sctx = null;
        let atlas = null;     // 预渲染字符图集
        let particles = [];
        let lastT = 0;

        const rand = (a, b) => a + Math.random() * (b - a);

        // 生成粒子：glow 为少量大颗亮尘，其余为细尘
        const makeParticle = (scatter) => {
            const glow = Math.random() < 0.07;
            return {
                x: scatter ? rand(0, W) : W + rand(4, 90),
                y: rand(-24, H + 24),
                vx: -rand(26, 78),
                r: glow ? rand(3.2, 6) : rand(0.8, 2.2),
                glow,
                amp: rand(4, 26),               // 正弦漂移振幅
                wf: rand(0.0004, 0.0013),       // 漂移频率
                ph: rand(0, Math.PI * 2),       // 漂移相位
                life: scatter ? rand(0.25, 1) : 1,
                decay: rand(0.05, 0.14)         // 每秒衰减（决定寿命 7~20s）
            };
        };

        const seedParticles = () => {
            const target = Math.round((W * H) / 8200);
            const count = Math.max(90, Math.min(420, W < 640 ? Math.round(target * 0.6) : target));
            particles = Array.from({ length: count }, () => makeParticle(true));
        };

        const buildAtlas = () => {
            const n = GLYPHS.length;
            const m = SHADES.length;
            acw = Math.ceil(cellW * dpr);
            ach = Math.ceil(cellH * dpr);
            atlas = document.createElement('canvas');
            atlas.width = n * acw;
            atlas.height = m * ach;
            const a = atlas.getContext('2d');
            a.font = `700 ${Math.round(ach * 0.78)}px ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace`;
            a.textAlign = 'center';
            a.textBaseline = 'middle';
            for (let y = 0; y < m; y++) {
                a.fillStyle = SHADES[y];
                for (let x = 0; x < n; x++) {
                    a.fillText(GLYPHS[x], x * acw + acw / 2, y * ach + ach * 0.54);
                }
            }
        };

        const resize = () => {
            const rect = canvas.parentElement.getBoundingClientRect();
            W = Math.max(320, Math.round(rect.width));
            H = Math.max(240, Math.round(rect.height));
            dpr = Math.min(window.devicePixelRatio || 1, 1.5);

            const small = W < 640;
            cellW = small ? 9 : 8;
            cellH = small ? 15 : 13;

            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            cols = Math.ceil(W / cellW);
            rows = Math.ceil(H / cellH);
            scene = document.createElement('canvas');
            scene.width = cols;
            scene.height = rows;
            sctx = scene.getContext('2d', { willReadFrequently: true });

            buildAtlas();
            seedParticles();
        };

        // 单帧：更新粒子 -> 低分辨率场景 -> ASCII 后处理输出
        const step = (t) => {
            const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
            lastT = t;

            // --- 粒子模拟 + 绘制到 1 cell = 1 px 的场景 ---
            sctx.clearRect(0, 0, cols, rows);
            sctx.globalCompositeOperation = 'lighter';
            sctx.fillStyle = '#fff';
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.life -= p.decay * dt;
                p.x += p.vx * dt;
                if (p.life <= 0 || p.x < -30) {
                    particles[i] = makeParticle(false);
                    continue;
                }
                const age = 1 - p.life;
                // 两端各 ~20% 生命周期做淡入 / 淡出
                const fade = Math.min(1, age * 5) * Math.min(1, p.life * 5);
                if (fade <= 0.01) continue;
                const yy = p.y + Math.sin(t * p.wf + p.ph) * p.amp;
                const size = Math.max(1, (p.r * 2 * (p.glow ? 1.5 : 1)) / cellW);
                sctx.globalAlpha = Math.min(1, fade * (p.glow ? 1 : 0.72));
                sctx.fillRect(p.x / cellW, yy / cellH, size, size);
            }
            sctx.globalAlpha = 1;
            sctx.globalCompositeOperation = 'source-over';

            // --- ASCII 后处理 ---
            const data = sctx.getImageData(0, 0, cols, rows).data;
            ctx.clearRect(0, 0, W, H);
            const n = GLYPHS.length;
            const m = SHADES.length;
            for (let y = 0; y < rows; y++) {
                const dy = y * cellH;
                const rowOff = y * cols * 4;
                for (let x = 0; x < cols; x++) {
                    const lum = data[rowOff + x * 4 + 3] / 255; // additive 白色粒子：alpha 即亮度
                    if (lum < LUM_MIN) continue;
                    const g = Math.min(n - 1, Math.floor(lum * n));
                    const s = Math.min(m - 1, Math.floor(lum * m));
                    ctx.drawImage(atlas, g * acw, s * ach, acw, ach, x * cellW, dy, cellW, cellH);
                }
            }
        };

        const loop = (t) => {
            raf = requestAnimationFrame(loop);
            if (t - lastT < FRAME_MS) return;
            step(t);
        };

        const start = () => {
            if (running || reduced || document.hidden || !inView) return;
            running = true;
            lastT = performance.now();
            raf = requestAnimationFrame(loop);
        };

        const stop = () => {
            running = false;
            cancelAnimationFrame(raf);
        };

        resize();
        step(performance.now()); // 先出一帧静态画面，避免挂载初期空白

        let resizeTimer = 0;
        const onResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                resize();
                step(performance.now());
            }, 150);
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(canvas.parentElement);

        const io = new IntersectionObserver(
            (entries) => {
                inView = entries[0]?.isIntersecting ?? true;
                if (inView) start();
                else stop();
            },
            { threshold: 0 }
        );
        io.observe(canvas);

        const onVis = () => {
            if (document.hidden) stop();
            else start();
        };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            stop();
            clearTimeout(resizeTimer);
            ro.disconnect();
            io.disconnect();
            document.removeEventListener('visibilitychange', onVis);
        };
    }, []);

    return (
        <canvas
            ref={ref}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
        />
    );
};

export default HeroAsciiCanvas;
