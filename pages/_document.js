import { Html, Head, Main, NextScript } from 'next/document';
const config = require('../wikitdb.config.js');

export default function Document() {
  return (
    <Html lang="zh-CN">
      <Head>
        <title>{config.SITE_NAME}</title>
        <link rel="icon" href="/img/logo.png" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.0.0/css/all.min.css" rel="stylesheet"></link>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
