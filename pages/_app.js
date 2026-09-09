// 自托管展示字体（Anton / Archivo）。
// 原先与 Noto Sans SC 合并为一个 Google Fonts 请求，该组合会触发 502，
// 导致整张样式表失效、所有字体都不生效；改为本地打包以彻底摆脱外部依赖。
// 只取 latin 子集，体积最小；字重按实际使用引入（Anton 仅 400，Archivo 见下方）。
import '@fontsource/anton/latin-400.css';
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-900.css';
import '../styles/globals.css';
import Layout from '../components/Layout';
import ErrorBoundary from '../components/ErrorBoundary';

function MyApp({ Component, pageProps }) {
    return (
        <Layout fullWidth={Component.fullWidth}>
            <ErrorBoundary>
                <Component {...pageProps} />
            </ErrorBoundary>
        </Layout>
    );
}

export default MyApp;
