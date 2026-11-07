// توليد ملفات صوت الرفيق والأسئلة من Azure AI Speech بصوت عُماني، مرة واحدة، لتعمل المنصة دون اتصال
// التشغيل من جذر المستودع:  npx tsx tools/audio/generate.ts [--dry] [--force] [--only=<بادئة>] [--voice=<اسم>]
// المفتاح والمنطقة في tools/audio/.env (مُتجاهَل من git) بالشكل في .env.example؛ لا يُطلب المفتاح في المحادثة أبدًا
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allLines, totalChars, type AudioLine } from '../../apps/web/src/audio/lines';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', '..', 'apps', 'web', 'public', 'audio');
const manifestPath = join(outDir, 'audio-manifest.json');
const logPath = join(here, 'generate.log');

interface Env {
  AZURE_SPEECH_KEY: string;
  AZURE_SPEECH_REGION: string;
  AZURE_SPEECH_VOICE?: string;
  CHILD_NAME?: string;
}

function readEnv(): Partial<Env> {
  const p = join(here, '.env');
  if (!existsSync(p)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out as Partial<Env>;
}

function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** SSML لسطر واحد: الأعداد تُقرأ كأعداد ترتيبية صحيحة، والجمل بسرعة أبطأ قليلًا للطفل */
function ssml(line: AudioLine, voice: string): string {
  const body = line.numberValue !== undefined ? `<say-as interpret-as="cardinal">${line.numberValue}</say-as>` : escapeXml(line.textAr);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-OM"><voice name="${voice}"><prosody rate="0.9">${body}</prosody></voice></speak>`;
}

async function synthesize(env: Env, voice: string, line: AudioLine): Promise<Buffer> {
  const url = `https://${env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      'User-Agent': 'ghaith-platform-audio',
    },
    body: ssml(line, voice),
  });
  if (!res.ok) throw new Error(`فشل التوليد (${res.status}) للمعرّف ${line.id}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function log(msg: string): void {
  const stamp = new Date().toISOString();
  console.log(msg);
  writeFileSync(logPath, `${stamp} ${msg}\n`, { flag: 'a' });
}

async function main(): Promise<void> {
  const env = readEnv();
  const voice = arg('voice') ?? env.AZURE_SPEECH_VOICE ?? 'ar-OM-AbdullahNeural';
  const only = arg('only');
  const dry = flag('dry');
  const force = flag('force');
  const lines = allLines(env.CHILD_NAME ?? 'غيث').filter((l) => !only || l.id.startsWith(only));
  mkdirSync(outDir, { recursive: true });
  const manifest: { files: string[] } = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { files: string[] }) : { files: [] };
  const have = new Set(manifest.files);
  const todo = lines.filter((l) => force || !have.has(l.id) || !existsSync(join(outDir, `${l.id}.mp3`)));
  log(`السطور: ${lines.length} (${totalChars(lines)} حرفًا)؛ المطلوب توليده: ${todo.length}؛ الصوت: ${voice}${dry ? '؛ تجربة بلا توليد' : ''}`);
  if (dry) {
    for (const l of todo.slice(0, 15)) console.log(`  ${l.id}: ${l.textAr}`);
    return;
  }
  if (!env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) {
    log('لا يوجد مفتاح أو منطقة في tools/audio/.env؛ انسخ .env.example إلى .env واملأه.');
    process.exitCode = 2;
    return;
  }
  let chars = 0;
  for (const l of todo) {
    const mp3 = await synthesize(env as Env, voice, l);
    writeFileSync(join(outDir, `${l.id}.mp3`), mp3);
    have.add(l.id);
    chars += l.textAr.length;
    writeFileSync(manifestPath, JSON.stringify({ files: [...have].sort() }, null, 2));
    // مهلة قصيرة احترامًا لحدود الطبقة المجانية
    await new Promise((r) => setTimeout(r, 120));
  }
  log(`اكتمل: ${todo.length} ملفًا، ${chars} حرفًا مستهلكًا في هذا التشغيل، والقائمة فيها ${have.size} ملفًا.`);
}

main().catch((e) => {
  log(`خطأ: ${(e as Error).message}`);
  process.exitCode = 1;
});
