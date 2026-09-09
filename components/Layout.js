// components/Layout.js
import React from 'react';
import Header from './Header';
import Footer from './Footer';

// fullWidth: 页面通过静态属性启用全宽布局（如首页的全宽色块），去掉 main 的宽度与内边距限制
const Layout = ({ children, fullWidth = false }) => {
    return (
        <div className="min-h-screen flex flex-col bg-canvas text-fg transition-colors duration-300">
            <Header />
            <main
                className={
                    fullWidth
                        ? 'flex-grow w-full'
                        : 'flex-grow mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8 w-full'
                }
            >
                {children}
            </main>
            <Footer />
        </div>
    );
};

export default Layout;
