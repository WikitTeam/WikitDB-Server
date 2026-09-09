import React, { useEffect, useRef, useState } from 'react';
// 核心修复：直接使用 auto 全自动注册，彻底解决漏引组件导致的致命闪退
import Chart from 'chart.js/auto';

const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

// canvas 无法读取 CSS 变量，按当前主题返回具体色值
const getChartColors = () => {
  if (isDark()) {
    return {
      bar: 'rgba(139, 92, 246, 0.85)',
      barBorder: 'rgb(139, 92, 246)',
      tooltipBg: 'rgba(24, 24, 27, 0.96)',
      tooltipTitle: '#f4f4f5',
      tooltipBody: '#a1a1aa',
      tooltipBorder: 'rgba(63, 63, 70, 1)',
      grid: 'rgba(255, 255, 255, 0.05)',
      ticks: '#a1a1aa',
    };
  }
  return {
    bar: 'rgba(139, 92, 246, 0.85)',
    barBorder: 'rgb(139, 92, 246)',
    tooltipBg: 'rgba(255, 255, 255, 0.96)',
    tooltipTitle: '#18181b',
    tooltipBody: '#52525b',
    tooltipBorder: 'rgba(228, 228, 231, 1)',
    grid: 'rgba(0, 0, 0, 0.06)',
    ticks: '#52525b',
  };
};

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

      const colors = getChartColors();

      chartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: '发布页面数',
              data: pagesData,
              backgroundColor: colors.bar,
              borderColor: colors.barBorder,
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
              backgroundColor: colors.tooltipBg,
              titleColor: colors.tooltipTitle,
              bodyColor: colors.tooltipBody,
              borderColor: colors.tooltipBorder,
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
              ticks: { color: colors.ticks, maxRotation: 45 }
            },
            y: {
              beginAtZero: true,
              grid: { color: colors.grid },
              ticks: { color: colors.ticks, stepSize: 1 }
            }
          }
        }
      });

      // 亮暗主题切换时重设 canvas 配色（canvas 不支持 CSS 变量，需 JS 侧感知）
      const applyThemeColors = () => {
        const chart = chartInstance.current;
        if (!chart) return;
        const c = getChartColors();
        chart.data.datasets[0].backgroundColor = c.bar;
        chart.data.datasets[0].borderColor = c.barBorder;
        chart.options.plugins.tooltip.backgroundColor = c.tooltipBg;
        chart.options.plugins.tooltip.titleColor = c.tooltipTitle;
        chart.options.plugins.tooltip.bodyColor = c.tooltipBody;
        chart.options.plugins.tooltip.borderColor = c.tooltipBorder;
        chart.options.scales.x.ticks.color = c.ticks;
        chart.options.scales.y.ticks.color = c.ticks;
        chart.options.scales.y.grid.color = c.grid;
        chart.update('none');
      };

      const themeObserver = new MutationObserver(applyThemeColors);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      return () => themeObserver.disconnect();
    } catch (err) {
      console.error("图表引擎渲染异常:", err);
      setChartError(err.message);
    }

  }, [data]);

  return (
    <div className="w-full h-full relative min-h-[260px]">
      {chartError && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-red-400 bg-sunken rounded-lg">
          图表渲染失败: {chartError}
        </div>
      )}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full"></canvas>
    </div>
  );
}