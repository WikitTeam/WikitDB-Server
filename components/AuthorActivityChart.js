import React, { useEffect, useRef, useState } from 'react';
// 核心修复：直接使用 auto 全自动注册，彻底解决漏引组件导致的致命闪退
import Chart from 'chart.js/auto';

/**
 * 把「单页面」数组（每篇一页，含 created_at + rating）按月聚合成
 * 组件绘图所需的 { date: YYYY-MM, pages: 发布数, rating: 当月评分和 } 结构。
 */
function aggregateByMonth(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return [];
  const bucket = new Map(); // YYYY-MM -> { pages, rating }
  for (const p of pages) {
    const rawDate = p && (p.created_at || p.createdAt || p.date);
    let d;
    if (!rawDate) continue;
    // created_at 可能是 "YYYY-MM-DDTHH:mm:ss" 或 "YYYY-MM-DD"
    const s = String(rawDate);
    const first = s.split(/[T\s]/)[0]; // YYYY-MM-DD
    const parts = first.split('-');
    if (parts.length < 2) {
      // 尝试 Date 兜底解析
      d = new Date(s);
      if (isNaN(d.getTime())) continue;
      parts = [d.getFullYear(), d.getMonth() + 1];
    }
    const yyyy = Number(parts[0]);
    const mm = Number(parts[1]);
    if (!yyyy || !mm) continue;
    const key = `${yyyy}-${String(mm).padStart(2, '0')}`;
    if (!bucket.has(key)) bucket.set(key, { pages: 0, rating: 0 });
    const b = bucket.get(key);
    b.pages += 1;
    const r = Number(p && p.rating != null ? p.rating : 0) || 0;
    b.rating += r;
  }
  const arr = Array.from(bucket.entries()).map(([date, v]) => ({
    date,
    pages: v.pages,
    rating: Math.round(v.rating * 100) / 100
  }));
  arr.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return arr;
}

export default function AuthorActivityChart({ pages = [], data /* 兼容老调用 */ }) {
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);
  const [chartError, setChartError] = useState(null);

  // 优先使用 pages（调用方 pages/authors.js 传 pages={data.pages}），
  // 若外部传了已聚合好的 data 则直接用（向前兼容）
  const rawInput = Array.isArray(pages) && pages.length > 0 ? pages : (data || []);

  useEffect(() => {
    setChartError(null);
    if (!canvasRef.current) return;
    if (!rawInput || rawInput.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    try {
      // 先判断输入是否已经是「按月聚合」的 {date, pages, rating}，
      // 还是「单页列表」（需要聚合）
      const firstItem = rawInput[0] || {};
      const alreadyAggregated =
        typeof firstItem === 'object' &&
        firstItem !== null &&
        typeof (firstItem.date || firstItem.month) === 'string' &&
        /\d{4}-\d{2}/.test(firstItem.date || firstItem.month) &&
        ('pages' in firstItem || 'pageCount' in firstItem || 'rating' in firstItem);

      // 格式要求：{ date: "YYYY-MM", pages: num, rating: num }
      const monthly = alreadyAggregated
        ? rawInput.map(x => ({
            date: String(x.date || x.month).slice(0, 7),
            pages: Number(x.pages != null ? x.pages : x.pageCount) || 0,
            rating: Number(x.rating != null ? x.rating : 0) || 0
          }))
        : aggregateByMonth(rawInput);

      if (!monthly.length) return;

      const sortedData = [...monthly].sort((a, b) => String(a.date).localeCompare(String(b.date)));

      const minDateStr = sortedData[0].date;
      const maxDateStr = sortedData[sortedData.length - 1].date;

      let [minY, minM] = (minDateStr || '').split('-').map(Number);
      let [maxY, maxM] = (maxDateStr || '').split('-').map(Number);
      if (!minY || !minM || !maxY || !maxM) return;

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
              ticks: {
                color: 'rgb(110, 118, 129)',
                stepSize: (() => {
                  const maxP = Math.max(1, ...pagesData);
                  return maxP <= 10 ? 1 : undefined;
                })()
              }
            }
          }
        }
      });
    } catch (err) {
      console.error("图表引擎渲染异常:", err);
      setChartError(err.message);
    }

  }, [rawInput]);

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