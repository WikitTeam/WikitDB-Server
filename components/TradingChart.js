import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';

export default function TradingChart({ data, markers = [], isCandle = false }) {
    const chartContainerRef = useRef();
    const chartRef = useRef();

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 完美适配暗黑模式的配置
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#9ca3af', // text-gray-400
                fontSize: 12,
                fontFamily: 'sans-serif',
            },
            grid: {
                // 暗黑模式下的幽灵网格线
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
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
                vertLine: { color: '#6b7280' },
                horzLine: { color: '#6b7280' }
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
        } else {
            mainSeries = chart.addAreaSeries({
                lineColor: '#3b82f6', // 蓝色的折线
                topColor: 'rgba(59, 130, 246, 0.3)', // 顶部的蓝色渐变
                bottomColor: 'rgba(59, 130, 246, 0.0)', // 到底部透明
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

        const handleResize = () => {
            chart.applyOptions({
                width: chartContainerRef.current.clientWidth,
                height: chartContainerRef.current.clientHeight,
            });
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [data, markers, isCandle]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}
