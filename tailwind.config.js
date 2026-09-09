/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.js",
    "./styles/**/*.css"
  ],
  theme: {
    extend: {
      colors: {
        // Layer 1 Primitive：完整 violet 色阶，组件不直接用，经语义 token 引用
        primary: {
          50: 'var(--w-primary-50)',
          100: 'var(--w-primary-100)',
          200: 'var(--w-primary-200)',
          300: 'var(--w-primary-300)',
          400: 'var(--w-primary-400)',
          500: 'var(--w-primary-500)',
          600: 'var(--w-primary-600)',
          700: 'var(--w-primary-700)',
          800: 'var(--w-primary-800)',
          900: 'var(--w-primary-900)',
          950: 'var(--w-primary-950)',
        },
        // Layer 2 Semantic：新代码只使用这套，随明暗主题自动翻转
        canvas: 'var(--w-canvas)',
        panel: 'var(--w-panel)',
        raised: 'var(--w-raised)',
        sunken: 'var(--w-sunken)',
        line: {
          DEFAULT: 'var(--w-line)',
          strong: 'var(--w-line-strong)',
        },
        fg: {
          DEFAULT: 'var(--w-fg)',
          2: 'var(--w-fg-2)',
          3: 'var(--w-fg-3)',
        },
        accent: {
          DEFAULT: 'var(--w-accent)',
          hover: 'var(--w-accent-hover)',
          solid: 'var(--w-accent-solid)',
          'solid-hover': 'var(--w-accent-solid-hover)',
          fg: 'var(--w-accent-fg)',
          soft: 'var(--w-accent-soft)',
          line: 'var(--w-accent-line)',
        },
      },
      // 全局收紧圆角：覆盖默认刻度，历史 class（rounded-lg 等）自动获得收紧值
      borderRadius: {
        sm: 'var(--w-radius-1)',      // 2px：徽章、小标签
        DEFAULT: 'var(--w-radius-2)', // 4px：按钮、输入框
        md: 'var(--w-radius-2)',      // 4px
        lg: 'var(--w-radius-3)',      // 6px：面板
        xl: '8px',                    // 仅过渡期内兼容旧代码，新代码禁用
        '2xl': '10px',                // 同上
        '3xl': '12px',                // 同上
      },
      boxShadow: {
        // 唯一允许的阴影：浮层（下拉菜单、弹窗、tooltip）
        pop: 'var(--w-shadow-pop)',
      },
    },
  },
  plugins: [],
}
