import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineType } from 'lightweight-charts';

export default function TradingChart({ data, markers = [], isCandle = false, stepLine = false }) {
    const chartContainerRef = useRef();
    const chartRef = useRef();

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#6b7280',
                fontSize: 12,
                fontFamily: 'sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(0, 0, 0, 0.04)' },
                horzLines: { color: 'rgba(0, 0, 0, 0.04)' },
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
                lineColor: '#3b82f6',
                topColor: 'rgba(59, 130, 246, 0.3)',
                bottomColor: 'rgba(59, 130, 246, 0.0)',
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
    }, [data, markers, isCandle, stepLine]);

    return <div ref={chartContainerRef} className="w-full h-full" />;
}
