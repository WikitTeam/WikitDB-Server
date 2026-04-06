import React, { useEffect, useRef, useState } from 'react';
// 核心修复：直接使用 auto 全自动注册，彻底解决漏引组件导致的致命闪退
import Chart from 'chart.js/auto';

export default function AuthorActivityChart({ data = [] }) {
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);
  const [chartError, setChartError] = useState(null);

  useEffect(() => {
    setChartError(null);
    if (!canvasRef.current || !data || data.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    try {
      // 格式必须为 { date: "YYYY-MM", pages: num, rating: num }
      const sortedData = [...data].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      
      const minDateStr = sortedData[0].date;
      const maxDateStr = sortedData[sortedData.length - 1].date;

      let [minY, minM] = minDateStr.split('-').map(Number);
      let [maxY, maxM] = maxDateStr.split('-').map(Number);

      const labels = [];
      const pagesData = [];
      const ratingData = [];

      let currY = minY;
      let currM = minM;

      // 自动补齐中间断更的月份
      while (currY < maxY || (currY === maxY && currM <= maxM)) {
        const monthStr = `${currY}-${String(currM).padStart(2, '0')}`;
        labels.push(monthStr);

        const match = sortedData.find(d => d.date === monthStr);
        if (match) {
          pagesData.push(match.pages);
          ratingData.push(match.rating);
        } else {
          pagesData.push(0);
          ratingData.push(0);
        }

        currM++;
        if (currM > 12) {
          currM = 1;
          currY++;
        }
      }

      const ctx = canvasRef.current.getContext('2d');

      chartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: '发布页面数',
              data: pagesData,
              backgroundColor: 'rgba(99, 102, 241, 0.85)',
              borderColor: 'rgb(99, 102, 241)',
              borderWidth: 1,
              barPercentage: 0.9,
              categoryPercentage: 1.0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(23,23,23,0.96)',
              titleColor: '#fff',
              bodyColor: 'rgb(200,200,200)',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              callbacks: {
                label: function(context) {
                  const idx = context.dataIndex;
                  const p = pagesData[idx];
                  const r = ratingData[idx];
                  return [
                    `发布页面: ${p} 篇`,
                    `当月总分: ${r > 0 ? '+' : ''}${r}`
                  ];
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: 'rgb(110, 118, 129)', maxRotation: 45 }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: 'rgb(110, 118, 129)', stepSize: 1 }
            }
          }
        }
      });
    } catch (err) {
      console.error("图表引擎渲染异常:", err);
      setChartError(err.message);
    }

  }, [data]);

  return (
    <div className="w-full h-full relative min-h-[260px]">
      {chartError && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 bg-gray-900/50 rounded-lg">
          图表渲染失败: {chartError}
        </div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"></canvas>
    </div>
  );
}