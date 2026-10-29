import { withAuth } from '../../../utils/withAuth';
import { execSync } from 'child_process';
import fs from 'fs';

const BOT_DIR = '/opt/wikit-delete-bot';
const CONFIG_PATH = `${BOT_DIR}/config.yaml`;
const LOG_DIR = `${BOT_DIR}/logs`;
const SERVICE = 'wikit-delete-bot';

// config.yaml 可编辑的标量字段
const SCALAR_KEYS = ['username', 'password', 'session_cookie', 'siteUnixName', 'scan_interval_minutes'];

function readConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const text = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = {};
    for (const key of SCALAR_KEYS) {
        const m = text.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, 'm'));
        cfg[key] = m ? m[1] : '';
    }
    // staffs 列表
    const staffs = [];
    const sm = text.match(/^staffs:([\s\S]*?)^\S/m);
    if (sm) {
        for (const line of sm[1].split('\n')) {
            const mm = line.match(/-\s*"?([^"\s]+)"?\s*$/);
            if (mm) staffs.push(mm[1]);
        }
    }
    cfg.staffs = staffs;
    return cfg;
}

function writeConfig(updates) {
    if (!fs.existsSync(CONFIG_PATH)) return false;
    let text = fs.readFileSync(CONFIG_PATH, 'utf8');
    for (const [key, value] of Object.entries(updates || {})) {
        if (!SCALAR_KEYS.includes(key)) continue;
        const esc = String(value ?? '').replace(/"/g, '\\"');
        // 数字字段（扫描间隔）不带引号，其余带引号
        const newVal = key === 'scan_interval_minutes' ? esc : `"${esc}"`;
        if (text.includes(`${key}:`)) {
            text = text.replace(new RegExp(`^(${key}:\\s*)"?[^"\\n]*"?`, 'm'), `$1${newVal}`);
        } else {
            text += `\n${key}: ${newVal}`;
        }
    }
    fs.writeFileSync(CONFIG_PATH, text);
    return true;
}

function run(cmd) {
    try {
        return execSync(cmd, { timeout: 15000, encoding: 'utf8' }).trim();
    } catch (e) {
        return String(e.stdout || e.message || '').trim();
    }
}

function readLatestLog(lines = 40) {
    try {
        const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith('.txt')).sort();
        if (files.length === 0) return '';
        const latest = `${LOG_DIR}/${files[files.length - 1]}`;
        const all = fs.readFileSync(latest, 'utf8');
        return all.split('\n').slice(-lines).join('\n');
    } catch (e) {
        return '';
    }
}

async function handler(req, res) {
    // GET：状态 + 配置 + 日志
    if (req.method === 'GET') {
        const active = run(`systemctl is-active ${SERVICE}`).toLowerCase() === 'active';
        const config = readConfig();
        return res.status(200).json({
            success: true,
            active,
            config,
            log: readLatestLog(),
            botDir: BOT_DIR
        });
    }

    if (req.method === 'POST') {
        const { action, config } = req.body || {};

        // 更新配置
        if (action === 'updateConfig') {
            if (!config || typeof config !== 'object') return res.status(400).json({ error: '配置无效' });
            const ok = writeConfig(config);
            return res.status(ok ? 200 : 400).json({ success: ok, message: ok ? '配置已保存' : '配置文件不存在' });
        }

        // 控制服务
        if (action === 'restart' || action === 'start' || action === 'stop' || action === 'run') {
            const cmd = action === 'run' || action === 'restart'
                ? `systemctl restart ${SERVICE}`
                : `systemctl ${action} ${SERVICE}`;
            run(cmd);
            await new Promise((r) => setTimeout(r, 1500));
            const active = run(`systemctl is-active ${SERVICE}`).toLowerCase() === 'active';
            return res.status(200).json({
                success: true,
                action,
                active,
                message: action === 'run' ? '已触发一轮扫描（服务已重启）' : `服务已${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}`
            });
        }

        return res.status(400).json({ error: '未知操作' });
    }

    return res.status(405).json({ error: '方法不支持' });
}

export default withAuth(handler);
