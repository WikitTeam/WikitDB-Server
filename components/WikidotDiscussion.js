import React, { useState, useEffect } from 'react';

// 递归渲染每一条回复的子组件
const PostItem = ({ post }) => {
    return (
        <div className="mt-4 first:mt-0">
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3 border-b border-gray-700/50 pb-2">
                    <img 
                        src={`https://www.wikidot.com/avatar.php?account=${post.author}`} 
                        alt="avatar" 
                        className="w-8 h-8 rounded border border-gray-600"
                        onError={(e) => e.target.src = 'https://www.wikidot.com/avatar.php?account=default'}
                    />
                    <div>
                        <div className="text-sm font-bold text-gray-200">{post.author}</div>
                        <div className="text-xs text-gray-500">{post.timestamp}</div>
                    </div>
                </div>
                
                <div 
                    className="text-gray-300 text-sm leading-relaxed prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: post.contentHtml }}
                ></div>
            </div>

            {/* 如果有楼中楼回复，在这里进行缩进渲染 */}
            {post.children && post.children.length > 0 && (
                <div className="pl-4 sm:pl-8 mt-2 border-l-2 border-gray-700/50">
                    {post.children.map(child => (
                        <PostItem key={child.postId} post={child} />
                    ))}
                </div>
            )}
        </div>
    );
};

// 接收 wiki 和 pageId 两个参数
const WikidotDiscussion = ({ wiki, pageId }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!wiki || !pageId) return;

        const fetchDiscussion = async () => {
            try {
                // 请求我们自己的本地接口
                const res = await fetch(`/api/wikidot-forum?wiki=${wiki}&pageId=${pageId}`);
                const json = await res.json();
                
                if (!res.ok) throw new Error(json.error || '请求失败');
                setData(json);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDiscussion();
    }, [wiki, pageId]);

    if (!wiki || !pageId) return null;

    return (
        <div className="w-full mt-12 pt-8 border-t border-gray-800">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <i className="fa-brands fa-wikipedia-w text-gray-400"></i> 原站讨论区
                    {data && <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-1 rounded-full border border-indigo-700/50">{data.total} 条记录</span>}
                </h3>
                {data && (
                    <a 
                        href={data.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                        去原站查看 <i className="fa-solid fa-arrow-up-right-from-square ml-1"></i>
                    </a>
                )}
            </div>

            {loading && <div className="text-center py-10 text-gray-500 animate-pulse">正在从本地数据库加载讨论数据...</div>}
            
            {error && (
                <div className="text-center py-8 bg-red-900/20 text-red-400 border border-red-900/50 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {data && data.threads.length === 0 && (
                <div className="text-center py-10 text-gray-600 bg-gray-900/30 rounded-xl border border-dashed border-gray-800">
                    这篇文档目前在原站没有任何人评论。
                </div>
            )}

            {data && data.threads.length > 0 && (
                <div className="space-y-4">
                    {data.threads.map(post => (
                        <PostItem key={post.postId} post={post} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default WikidotDiscussion;