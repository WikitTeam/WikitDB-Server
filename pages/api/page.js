import * as cheerio from 'cheerio';
import prisma from '../../lib/prisma';
const config = require('../../wikitdb.config.js');

export default async function handler(req, res) {
    const { site, page, hpage = 1 } = req.query;

    if (!site || !page || page === 'undefined') {
        return res.status(400).json({ error: '缺少有效的 site 或 page 参数' });
    }

    let rawPage = page.split('|')[0].split('#')[0].trim().toLowerCase();
    const pageName = rawPage.replace(/\/$/, '').split('/').pop();

    const wikiConfig = config.SUPPORT_WIKI.find(w => w.PARAM === site);
    if (!wikiConfig) {
        return res.status(404).json({ error: '未找到该站点配置' });
    }

    const actualWikiName = wikiConfig.URL.replace(/^https?:\/\//i, '').split('.')[0];
    const baseUrl = wikiConfig.URL.replace(/\/$/, '');
    const secureUrl = `${baseUrl}/${pageName}`;

    try {
        const fetchHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        };

        const [gqlResponse, htmlResponse] = await Promise.allSettled([
            fetch('https://wikit.unitreaty.org/apiv1/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `query($wiki: String!, $page: String!) { article(wiki: $wiki, page: $page) { title rating upvotes downvotes comments author tags created_at lastmod page_id } }`,
                    variables: { wiki: actualWikiName, page: pageName }
                }),
                cache: 'no-store'
            }),
            fetch(secureUrl, { 
                headers: fetchHeaders,
                cache: 'no-store'
            })
        ]);

        let gqlData = null;
        if (gqlResponse.status === 'fulfilled' && gqlResponse.value.ok) {
            try {
                const gqlJson = await gqlResponse.value.json();
                if (gqlJson.data && gqlJson.data.article) {
                    gqlData = gqlJson.data.article;
                }
            } catch (e) {}
        }

        if (htmlResponse.status === 'fulfilled' && htmlResponse.value.status === 404) {
            throw new Error(`404: 原站点中该页面不存在 (可能是死链或已被原作者删除)`);
        }
        if (htmlResponse.status === 'rejected' || !htmlResponse.value.ok) {
            throw new Error(`HTTP 状态码异常: ${htmlResponse.value?.status || '网络请求失败'}`);
        }
        
        const html = await htmlResponse.value.text();
        const $ = cheerio.load(html);

        let title = gqlData?.title;
        if (!title) {
            title = $('#page-title').text().trim() || $('title').text().trim() || decodeURIComponent(pageName).replace(/-/g, ' ');
            if (title.includes(' - ')) title = title.split(' - ')[0].trim();
        }

        let tags = gqlData?.tags;
        if (!tags || tags.length === 0) {
            tags = [];
            $('.page-tags a').each((i, el) => {
                const t = $(el).text().trim();
                if(t && !t.startsWith('_')) tags.push(t);
            });
        }

        let creatorName = gqlData?.author || $('.printuser').first().text().trim() || '未知';
        let creatorAvatar = null;
        const printusers = $('.printuser');
        if (printusers.length > 0) {
            creatorAvatar = printusers.first().find('img').attr('src');
        }
        if (creatorAvatar && !creatorAvatar.startsWith('http')) {
            creatorAvatar = `https://www.wikidot.com${creatorAvatar.startsWith('/') ? '' : '/'}${creatorAvatar}`;
        }
        
        let rating = 'N/A';
        if (gqlData && gqlData.rating !== undefined) {
            rating = gqlData.rating > 0 ? `+${gqlData.rating}` : gqlData.rating.toString();
        } else {
            rating = $('.rate-points').first().text().trim() || 'N/A';
        }

        let currentScoreNum = 0;
        if (typeof rating === 'string' && rating !== 'N/A') {
            currentScoreNum = parseInt(rating.replace('+', ''), 10);
        } else if (typeof rating === 'number') {
            currentScoreNum = rating;
        }

        let scoreHistory = [];
        try {
            const pageKey = `rating_history_${actualWikiName}_${pageName}`;
            const historyRecord = await prisma.setting.findUnique({ where: { key: pageKey } });
            
            let historyData = {};
            if (historyRecord && historyRecord.value) {
                try { historyData = JSON.parse(historyRecord.value); } catch(e) {}
            }
            
            const now = new Date();
            const cstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
            const today = cstTime.toISOString().split('T')[0];
            
            historyData[today] = currentScoreNum;
            
            await prisma.setting.upsert({
                where: { key: pageKey },
                update: { value: JSON.stringify(historyData) },
                create: { key: pageKey, value: JSON.stringify(historyData) }
            });
            
            scoreHistory = Object.keys(historyData).sort().map(date => ({
                date: date,
                score: historyData[date]
            }));
        } catch (e) {
            console.error('记录评分历史失败:', e);
        }

        let lastUpdated = gqlData?.lastmod;
        if (!lastUpdated) {
            lastUpdated = $('#page-info .odate').first().text().trim() || $('.odate').first().text().trim() || '未知';
        } else {
            lastUpdated = new Date(lastUpdated).toLocaleString('zh-CN', { hour12: false });
        }

        let historyHtml = '';
        let wikitHistoryFailed = false; 
        let wikitRawJson = null;

        if (hpage == 1) {
            try {
                const wikitHistUrl = `https://wikit.unitreaty.org/wikidot/pagehistory?wiki=${actualWikiName}&page=${encodeURIComponent(secureUrl)}`;
                const histRes = await fetch(wikitHistUrl, {
                    method: 'GET',
                    headers: { 'User-Agent': fetchHeaders['User-Agent'] },
                    cache: 'no-store'
                });
                
                if (histRes.ok) {
                    const histText = await histRes.text();
                    try {
                        const histJson = JSON.parse(histText);
                        if (histJson.error || Array.isArray(histJson)) {
                            wikitHistoryFailed = true;
                        } else if (histJson.body || histJson.html) {
                            historyHtml = histJson.body || histJson.html;
                        } else {
                            wikitHistoryFailed = true;
                            wikitRawJson = histJson;
                        }
                    } catch (e) {
                        if (histText.includes('<html') || histText.includes('<table')) {
                            const $hist = cheerio.load(histText);
                            historyHtml = $hist('table.page-history').length ? $hist('table.page-history').parent().html() : $hist('body').html() || histText;
                        } else {
                            historyHtml = histText;
                        }
                    }
                } else {
                    wikitHistoryFailed = true;
                }
            } catch (e) {
                wikitHistoryFailed = true;
            }
        } else {
            wikitHistoryFailed = true;
        }

        let pageId = gqlData?.page_id || null;
        if (!pageId) {
            const idMatch = html.match(/pageId\s*[:=]\s*['"]?(\d+)['"]?/i) || html.match(/page_id\s*[:=]\s*['"]?(\d+)['"]?/i);
            if (idMatch && idMatch[1]) {
                pageId = idMatch[1];
            }
        }

        let sourceCode = '源码抓取失败：未能在原站网页中解析到 pageId。';
        let ratingTable = [];

        if (pageId) {
            const origin = new URL(secureUrl).origin;
            const ajaxUrl = `${origin}/ajax-module-connector.php`;
            
            const ajaxHeaders = {
                'User-Agent': fetchHeaders['User-Agent'],
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': origin,
                'Referer': secureUrl,
                'Cookie': 'wikidot_token7=123456;'
            };

            const fetchPromises = [
                fetch(ajaxUrl, {
                    method: 'POST',
                    headers: ajaxHeaders,
                    body: `page_id=${pageId}&moduleName=viewsource/ViewSourceModule&wikidot_token7=123456`,
                    cache: 'no-store'
                }),
                fetch(ajaxUrl, {
                    method: 'POST',
                    headers: ajaxHeaders,
                    body: `pageId=${pageId}&page_id=${pageId}&moduleName=pagerate/WhoRatedPageModule&wikidot_token7=123456`,
                    cache: 'no-store'
                })
            ];

            if (wikitHistoryFailed) {
                fetchPromises.push(
                    fetch(ajaxUrl, {
                        method: 'POST',
                        headers: ajaxHeaders,
                        body: `page_id=${pageId}&moduleName=history/PageRevisionListModule&page=${hpage}&perpage=50&wikidot_token7=123456`,
                        cache: 'no-store'
                    })
                );
            }

            const results = await Promise.allSettled(fetchPromises);

            const srcRes = results[0];
            if (srcRes.status === 'fulfilled' && srcRes.value.ok) {
                try {
                    const data = await srcRes.value.json();
                    if (data.status === 'ok') {
                        const $src = cheerio.load(data.body);
                        let rawHtml = $src('.page-source').html() || data.body || '';
                        rawHtml = rawHtml.replace(/<br\s*\/?>/gi, '\n');
                        sourceCode = rawHtml.replace(/^(?:[ \t\u00a0\u3000]|&nbsp;)+/gm, '').trim();
                    } else {
                        sourceCode = `请求源码失败，原站返回: ${data.status}`;
                    }
                } catch(e) {
                    sourceCode = `解析源码数据异常: ${e.message}`;
                }
            } else {
                sourceCode = `请求源码网络错误，可能被原站拦截`;
            }

            const rateRes = results[1];
            if (rateRes && rateRes.status === 'fulfilled' && rateRes.value.ok) {
                try {
                    const data = await rateRes.value.json();
                    if (data.status === 'ok' && data.body) {
                        const $rate = cheerio.load(data.body);
                        $rate('.printuser').each((i, el) => {
                            const user = $rate(el).text().trim();
                            let vote = '+1';
                            
                            // 核心修复：精准捕获紧跟在当前用户节点之后的文本，不被其他用户干扰
                            let textAfter = '';
                            let curr = el.next;
                            while (curr) {
                                // 遇到换行或下一个用户时停止捕获
                                if (curr.type === 'tag' && (curr.tagName === 'br' || (curr.attribs && curr.attribs.class && curr.attribs.class.includes('printuser')))) {
                                    break;
                                }
                                if (curr.type === 'text') {
                                    textAfter += curr.data;
                                } else if (curr.type === 'tag') {
                                    textAfter += $rate(curr).text();
                                }
                                curr = curr.next;
                            }

                            if (textAfter.includes('-')) vote = '-1';
                            else if (textAfter.includes('+')) vote = '+1';

                            const imgTag = $rate(el).find('img').attr('src');
                            let avatar = '';
                            if (imgTag) {
                                avatar = imgTag.startsWith('http') ? imgTag : `https://www.wikidot.com${imgTag}`;
                            } else {
                                const accountStr = user.toLowerCase().replace(/_/g, '-').replace(/ /g, '-');
                                avatar = `https://www.wikidot.com/avatar.php?account=${accountStr}`;
                            }
                            
                            if (avatar && avatar.includes('default')) {
                                avatar = 'https://www.wikidot.com/avatar.php?account=default';
                            }
                            
                            ratingTable.push({ user, avatar, vote });
                        });
                        ratingTable = ratingTable.filter((v, i, a) => a.findIndex(t => (t.user === v.user)) === i);
                    }
                } catch (e) {}
            }

            let nativeHistorySuccess = false;
            const histResIndex = 2;
            if (wikitHistoryFailed && results[histResIndex] && results[histResIndex].status === 'fulfilled' && results[histResIndex].value.ok) {
                try {
                    const data = await results[histResIndex].value.json();
                    if (data.status === 'ok') {
                        historyHtml = data.body;
                        nativeHistorySuccess = true;
                    }
                } catch(e) {}
            }

            if (wikitHistoryFailed && !nativeHistorySuccess) {
                if (wikitRawJson) {
                    let rows = [];
                    for (const key in wikitRawJson) {
                        if (key.startsWith('rev')) rows.push(wikitRawJson[key]);
                    }
                    rows.sort((a, b) => parseInt(b.revRow || 0) - parseInt(a.revRow || 0));
                    let tableHtml = '<table class="page-history"><tbody>';
                    for (const row of rows) {
                        const dateStr = row.changeTime ? new Date(parseInt(row.changeTime) * 1000).toLocaleString('zh-CN', { hour12: false }) : '';
                        tableHtml += `<tr><td>${row.revRow || ''}.</td><td>${row.flag || ''}</td><td><span class="printuser">${row.username || '未知'}</span></td><td>${dateStr}</td><td>${row.comment || ''}</td></tr>`;
                    }
                    tableHtml += '</tbody></table>';
                    historyHtml = tableHtml;
                } else {
                    historyHtml = `<div class="text-gray-500">Wikit 历史为空，且原生历史请求被拦截。</div>`;
                }
            }

        } else if (wikitHistoryFailed) {
            if (wikitRawJson) {
                let rows = [];
                for (const key in wikitRawJson) {
                    if (key.startsWith('rev')) rows.push(wikitRawJson[key]);
                }
                rows.sort((a, b) => parseInt(b.revRow || 0) - parseInt(a.revRow || 0));
                let tableHtml = '<table class="page-history"><tbody>';
                for (const row of rows) {
                    const dateStr = row.changeTime ? new Date(parseInt(row.changeTime) * 1000).toLocaleString('zh-CN', { hour12: false }) : '';
                    tableHtml += `<tr><td>${row.revRow || ''}.</td><td>${row.flag || ''}</td><td><span class="printuser">${row.username || '未知'}</span></td><td>${dateStr}</td><td>${row.comment || ''}</td></tr>`;
                }
                tableHtml += '</tbody></table>';
                historyHtml = tableHtml;
            } else {
                historyHtml = '<div class="text-gray-500">历史记录抓取失败：Wikit 接口无数据，且未能在原站网页中解析到 pageId 进行兜底。</div>';
            }
        }

        let maxHistoryPage = 1;

        if (historyHtml && !historyHtml.startsWith('{')) {
            const $hist = cheerio.load(historyHtml, null, false);
            
            const pagerText = $hist('.pager .pager-no').text();
            const match = pagerText.match(/of\s+(\d+)|共\s*(\d+)\s*页|\/\s*(\d+)/i);
            if (match) {
                maxHistoryPage = parseInt(match[1] || match[2] || match[3], 10);
            } else {
                $hist('.pager .target a').each((i, el) => {
                    const pageNum = parseInt($hist(el).text(), 10);
                    if (!isNaN(pageNum) && pageNum > maxHistoryPage) {
                        maxHistoryPage = pageNum;
                    }
                });
            }

            $hist('.pager').remove();
            
            const lastRow = $hist('table.page-history tr').last();
            if (lastRow.length > 0) {
                const firstEditor = lastRow.find('.printuser').first();
                if (firstEditor.length > 0) {
                    creatorName = firstEditor.text().trim();
                    const avatarImg = firstEditor.find('img').attr('src');
                    if (avatarImg) {
                        creatorAvatar = avatarImg.startsWith('http') ? avatarImg : `https://www.wikidot.com${avatarImg.startsWith('/') ? '' : '/'}${avatarImg}`;
                    }
                }
            }

            let colsToRemove = new Set();

            $hist('table.page-history tr').first().find('th, td').each((j, cell) => {
                const text = $hist(cell).text().toLowerCase().replace(/\s+/g, '');
                if (text.includes('actions') || text.includes('操作')) {
                    colsToRemove.add(j);
                }
            });

            $hist('table.page-history tr').eq(1).find('td').each((j, cell) => {
                const $cell = $hist(cell);
                if ($cell.find('input[type="radio"]').length > 0) {
                    colsToRemove.add(j);
                }
                const hasVSR = $cell.find('a').filter((_, a) => {
                    const aText = $hist(a).text().trim().toUpperCase();
                    return aText === 'V' || aText === 'S' || aText === 'R';
                }).length > 0;
                if (hasVSR) {
                    colsToRemove.add(j);
                }
            });

            const colsArray = Array.from(colsToRemove).sort((a, b) => b - a);
            
            if (colsArray.length > 0) {
                $hist('table.page-history tr').each((i, row) => {
                    const cells = $hist(row).find('th, td');
                    colsArray.forEach(colIdx => {
                        cells.eq(colIdx).remove();
                    });
                });
            }
            
            $hist('.buttons, .options, .page-history-options').remove();

            $hist('img').each((i, el) => {
                const $img = $hist(el);
                $img.removeAttr('style').removeAttr('width').removeAttr('height').removeAttr('class');
                $img.attr('style', 'width: 20px; height: 20px; border-radius: 50%; display: inline-block; object-fit: cover; margin-right: 6px; vertical-align: middle;');
            });
            historyHtml = $hist.html();
        }

        let finalUpvotes = gqlData?.upvotes;
        let finalDownvotes = gqlData?.downvotes;

        if (ratingTable.length > 0) {
            const upCount = ratingTable.filter(r => r.vote === '+1').length;
            const downCount = ratingTable.filter(r => r.vote === '-1').length;
            if (!finalUpvotes) finalUpvotes = upCount;
            if (!finalDownvotes) finalDownvotes = downCount;
        }

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.status(200).json({
            siteName: wikiConfig.NAME,
            siteImg: wikiConfig.ImgURL,
            originalUrl: secureUrl,
            title: title,
            tags: tags,
            creatorName: creatorName,
            creatorAvatar: creatorAvatar,
            rating: rating,
            upvotes: finalUpvotes,
            downvotes: finalDownvotes,
            comments: gqlData?.comments,
            lastUpdated: lastUpdated,
            sourceCode: sourceCode,
            historyHtml: historyHtml,
            maxHistoryPage: maxHistoryPage,
            pageId: pageId,
            ratingTable: ratingTable,
            scoreHistory: scoreHistory
        });
    } catch (error) {
        res.status(500).json({ error: '详情页抓取失败', details: error.message });
    }
}