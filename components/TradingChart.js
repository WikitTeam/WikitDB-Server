import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineType } from 'lightweight-charts';

const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

// canvas 无法读取 CSS 变量，按当前主题返回具体色值
const getThemeColors = () => isDark()
    ? { grid: 'rgba(255, 255, 255, 0.06)', text: '#a1a1aa' }
    : { grid: 'rgba(0, 0, 0, 0.06)', text: '#52525b' };

export default function TradingChart({ data, markers = [], isCandle = false, stepLine = false }) {
    const chartContainerRef = useRef();
    const chartRef = useRef();

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const theme = getThemeColors();

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: theme.text,
                fontSize: 12,
                fontFamily: 'sans-serif',
            },
            grid: {
                vertLines: { color: theme.grid },
                horzLines: { color: theme.grid },
            },
            rightPriceScale: {
                borderVisible: false,
            },
            timeScale: {
                borderVisible: false,
                timeVisible: true,
                rightOffset: 2,
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: '#9ca3af' },
                horzLine: { color: '#9ca3af' }
            },
            handleScroll: { mouseWheel: true, pressedMouseMove: true },
            handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
        });

        chartRef.current = chart;

        let mainSeries;
        if (isCandle) {
            mainSeries = chart.addCandlestickSeries({
                upColor: '#16a34a',
                downColor: '#e11d48',
                borderVisible: false,
                wickUpColor: '#16a34a',
                wickDownColor: '#e11d48',
            });
        } else if (stepLine) {
            mainSeries = chart.addAreaSeries({
                lineColor: '#16a34a',
                topColor: 'rgba(22, 163, 74, 0.28)',
                bottomColor: 'rgba(22, 163, 74, 0.02)',
                lineWidth: 2,
                lineType: LineType.Simple,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 3,
            });
        } else {
            mainSeries = chart.addAreaSeries({
                lineColor: '#8b5cf6',
                topColor: 'rgba(139, 92, 246, 0.28)',
                bottomColor: 'rgba(139, 92, 246, 0.05)',
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
            });
        }

        mainSeries.setData(data);

        if (markers.length > 0) {
            mainSeries.setMarkers(markers);
        }

        chart.timeScale().fitContent();

        // 亮暗主题切换时更新网格/标签配色（canvas 不支持 CSS 变量，需 JS 侧感知）
        const applyTheme = () => {
            const t = getThemeColors();
            chart.applyOptions({
                layout: { textColor: t.text },
                grid: {
                    vertLines: { color: t.grid },
                    horzLines: { color: t.grid },
                },
            });
        };
        const themeObserver = new MutationObserver(applyTheme);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        const handleResize = () => {
            chart.applyOptions({
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
            });
        };
        window.addEventListener('resize', handleResize);

        return () => {
            themeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, markers, isCandle, stepLine]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}
