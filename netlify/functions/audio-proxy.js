/**
 * 网易云音乐音频代理 - Netlify Functions 版本
 * 
 * 部署：将此文件放在 netlify/functions/ 目录
 * 访问：https://your-site.netlify.app/.netlify/functions/audio-proxy?song_id=xxx&quality=standard
 * 或配置重写后：https://your-site.netlify.app/audio/xxx?quality=standard
 * 
 * 作用：代理网易云音频URL，让Telegram直接从Netlify下载，减少Render出站流量
 * Netlify免费版：10秒超时，12.5万请求/月，100GB流量/月
 */

const crypto = require('crypto');

// ============================================================
// Upstash Redis 配置（从环境变量读取，未配置则使用默认值）
// ============================================================
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://normal-sawfly-40098.upstash.io';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AZyiAAIgcDEzM2UyZTZkM2Y2ODY0ZDY5YmM0MjFiYmUxYzEzODM0OA';

// 内存缓存（减少 Upstash 查询次数，缓存 60 秒）
let cachedCookie = '';
let cachedCookieTime = 0;
const CACHE_TTL = 60 * 1000; // 60秒

// 从 Upstash 读取最新的 cookie
async function getLatestCookie() {
  const now = Date.now();
  // 如果缓存未过期，直接返回缓存
  if (cachedCookie && now - cachedCookieTime < CACHE_TTL) {
    return cachedCookie;
  }
  
  try {
    const response = await fetch(`${UPSTASH_URL}/get/bot:cookie`, {
      headers: {
        'Authorization': `Bearer ${UPSTASH_TOKEN}`
      }
    });
    const data = await response.json();
    if (data && data.result) {
      cachedCookie = data.result;
      cachedCookieTime = now;
      console.log('[Upstash] 成功读取最新 cookie，长度:', cachedCookie.length);
      return cachedCookie;
    }
  } catch (e) {
    console.error('[Upstash] 读取 cookie 失败，使用默认 cookie:', e.message);
  }
  
  // 读取失败，返回默认 cookie
  return process.env.NETEASE_COOKIE || '00051F8B50B031D47D75138C419DF7B832B7454FEC68CE11935A6FF17E33543308BE6C3EA6689BAD40FFFB5F83B9F73030B0CE8EAB90EEDBE8A7362751F354AB290B5F2FF8C0DAD1FE3675FFCE7FD0C481A0A86A0A61DC5926ED9EA8D896C9330A2A59B281E880AD3066C5E5027695D2F2DD220636C9FE1186CFD84B1E3FBF6FD4D5C77FF8F533E7B2E6B5B3E3E6DCC7957BDA90BE2CDCBEAB4964499330D9C4FDD4E9EC548A8550EA9287E1613E9683B3A8CE3133A48B48D304E4146B4C10C898C7E6CC7539A623D99A823FEBCC8DE5CCFCAB9A75869500602A3B0DF793A7F776CA40AE6C7050A31806F1AC5CE816BC4E950A0DA1DE1EAA136CFDF3C6BAFB45EE58C3BCEE3D997D3764B7BBFD38EE07C562AB9057FCCBAC9749C56A010913A077B941E3A77BB46F39658FD90A7DFB6B3AC57E4C7C6480B1A57150A5E5D4995B2290F57E35CA9B48FFAD2572130007161047CCC5D582BEEBC83E313D296261A32C600D1398A21157C0B9E22F8046B51ADBA6582AA6B28EA505A3017EF7D70DD2EB61CB52C23E087085DC6FD5C0FD50A5594ACFE26B3F094FC3B30402BBA5938DC2';
}

// 生成随机 NMTID
function genNmtid() {
  return crypto.randomBytes(16).toString('hex');
}
const NMTID = genNmtid();

// 构建 Cookie 头（从 Upstash 读取最新 cookie）
async function getCookieHeader() {
  const cookie = await getLatestCookie();
  const cookies = [];
  if (cookie) {
    cookies.push(`MUSIC_U=${cookie}`);
  }
  cookies.push('__remember_me=true');
  cookies.push(`NMTID=${NMTID}`);
  return cookies.join('; ');
}

// ============================================================
// weapi 加密（网易云API加密）
// ============================================================

const AES_KEY = '0CoJUm6Qyw8W8jud';
const AES_IV = Buffer.from('0102030405060708', 'utf8');
const RSA_PUB_KEY = BigInt('0x' +
  'e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725' +
  '152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312' +
  'ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424' +
  'd813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
);
const RSA_EXP = 65537n;

function randStr(length = 16) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function aesEncrypt(text, key) {
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key, 'utf8'), AES_IV);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function rsaEncrypt(text) {
  // 反转文本
  const reversed = text.split('').reverse().join('');
  // 转十六进制
  const hex = Buffer.from(reversed, 'utf8').toString('hex');
  // 模幂运算
  const num = BigInt('0x' + hex);
  const result = num ** RSA_EXP % RSA_PUB_KEY;
  // 转256位十六进制字符串
  return result.toString(16).padStart(256, '0');
}

function weapi(data) {
  const text = JSON.stringify(data);
  const secret = randStr(16);
  const params = aesEncrypt(aesEncrypt(text, AES_KEY), secret);
  const encSecKey = rsaEncrypt(secret);
  return { params, encSecKey };
}

// ============================================================
// 网易云 API 调用
// ============================================================

async function getSongUrl(songId, quality = 'standard') {
  const url = 'https://music.163.com/weapi/song/enhance/player/url/v1';
  const data = weapi({
    ids: JSON.stringify([songId]),
    level: quality,
    encodeType: 'mp3'
  });
  
  const params = new URLSearchParams();
  params.append('params', data.params);
  params.append('encSecKey', data.encSecKey);
  
  const cookieHeader = await getCookieHeader();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://music.163.com/',
      'Cookie': cookieHeader,
      'Origin': 'https://music.163.com'
    },
    body: params.toString()
  });
  
  const result = await response.json();
  
  if (result.data && result.data[0] && result.data[0].url) {
    return result.data[0].url;
  }
  return null;
}

// ============================================================
// Netlify Functions Handler
// ============================================================

exports.handler = async (event, context) => {
  // CORS 头
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };
  
  // 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders
    };
  }
  
  // 健壮的 song_id 提取逻辑
  let songId = event.queryStringParameters?.song_id;
  
  // 从原始路径提取（Netlify 重写后 event.path 是函数路径，rawPath 可能是原始路径）
  if (!songId) {
    const rawPath = event.rawPath || event.path || '';
    const pathMatch = rawPath.match(/\/audio\/(\d+)/);
    if (pathMatch) {
      songId = pathMatch[1];
    }
  }
  
  // 从 multiValueQueryStringParameters 提取（备用）
  if (!songId && event.multiValueQueryStringParameters?.song_id) {
    songId = event.multiValueQueryStringParameters.song_id[0];
  }
  
  // 健康检查（无 song_id 时返回状态）
  if (!songId) {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'ok', 
        message: '网易云音乐音频代理服务运行中',
        usage: '/audio/{song_id}?quality=standard&name=xxx&artist=xxx'
      })
    };
  }
  
  const quality = event.queryStringParameters?.quality || 'standard';
  const name = event.queryStringParameters?.name || `song_${songId}`;
  const artist = event.queryStringParameters?.artist || '';
  
  if (!songId) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '缺少 song_id 参数', code: 400 })
    };
  }
  
  try {
    // 获取音频直链
    const audioUrl = await getSongUrl(songId, quality);
    
    if (!audioUrl) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '无法获取音频地址，歌曲可能需要VIP或已下架', code: 404 })
      };
    }
    
    // 下载音频并流式返回
    const audioResponse = await fetch(audioUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/'
      }
    });
    
    if (!audioResponse.ok) {
      return {
        statusCode: audioResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: '音频下载失败', code: audioResponse.status })
      };
    }
    
    // 获取音频数据
    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const filename = `${name}${artist ? ' - ' + artist : ''}.mp3`;
    
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=86400', // 缓存24小时
        'Accept-Ranges': 'bytes'
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
    
  } catch (error) {
    console.error('音频代理错误:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '服务器内部错误', message: error.message, code: 500 })
    };
  }
};
