import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildContentBrief } from "./content-brief";
import type { TopicCandidate, TrendSignal } from "./domain";
import { withFetchTimeout } from "./fetch-timeout";
import { getCpaConfigFile } from "./paths";

export interface LocalCpaConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface LocalCpaConfigPatch {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export interface CpaGenerationOptions extends LocalCpaConfig {
  fetchImpl?: typeof fetch;
  trendContext?: TrendSignal;
}

interface WritingProfile {
  perspective: string;
  tone: string;
  rhythm: string;
  closing: string;
}

const WRITING_PROFILES: WritingProfile[] = [
  {
    perspective: "旁观者分析，允许直接说出自己的判断，但不冒充亲历者",
    tone: "冷静克制，中段可以有一处明确质疑",
    rhythm: "具体场景开头，长短句明显交替，分析段后留一个短段落",
    closing: "硬切：最后一个判断说完就停，不复述全文"
  },
  {
    perspective: "自问自答，从读者最纠结的问题切入",
    tone: "口语但不油滑，带一点不耐烦，避免端水",
    rhythm: "开头短促，中间放慢解释，后半段再加速",
    closing: "未答之问：留下一个真正有分歧的问题，不给标准答案"
  },
  {
    perspective: "编辑观察手记，用第一人称表达判断，不编造朋友或个人经历",
    tone: "温和但有棱角，承认信息边界",
    rhythm: "慢场景、快判断，段落长度呈波浪变化",
    closing: "场景回扣：回到开头的动作或画面，不做升华"
  },
  {
    perspective: "反面假设，先拆掉最诱人的结论，再给有限建议",
    tone: "审慎、略带反讽，不使用夸张情绪词",
    rhythm: "观点与反例交错，允许一次自我修正或保留",
    closing: "反结论：明确拒绝万能答案，用边界收尾"
  }
];

function writingProfileFor(topic: TopicCandidate): WritingProfile {
  const hash = [...topic.id].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 7);
  return WRITING_PROFILES[hash % WRITING_PROFILES.length];
}

const allowedCpaHosts = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function normalizeLocalCpaBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/$/, "");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("CPA baseURL must be a valid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol) || !allowedCpaHosts.has(parsed.hostname)) {
    throw new Error("CPA baseURL must use http(s) on localhost or a loopback address");
  }
  if (parsed.username || parsed.password) {
    throw new Error("CPA baseURL must not contain credentials");
  }

  return normalized;
}

export function parseEnvFile(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim()];
      })
  );
}

export function getLocalCpaConfig(): LocalCpaConfig | null {
  const envFromFile = existsSync(getCpaConfigFile())
    ? parseEnvFile(readFileSync(getCpaConfigFile(), "utf8"))
    : {};

  const baseUrl = process.env.CPA_BASE_URL ?? envFromFile.CPA_BASE_URL;
  const apiKey = process.env.CPA_API_KEY ?? envFromFile.CPA_API_KEY;
  const model = process.env.CPA_MODEL ?? envFromFile.CPA_MODEL ?? "gpt-5.4-mini";

  if (!baseUrl || !apiKey) {
    return null;
  }

  return {
    baseUrl: normalizeLocalCpaBaseUrl(baseUrl),
    apiKey,
    model
  };
}

export function mergeCpaConfig(
  current: LocalCpaConfig | null,
  patch: LocalCpaConfigPatch
): LocalCpaConfig {
  const rawBaseUrl = (patch.baseUrl ?? current?.baseUrl ?? "").trim();
  const apiKey = (patch.apiKey ?? current?.apiKey ?? "").trim();
  const model = (patch.model ?? current?.model ?? "gpt-5.4-mini").trim();

  if (!rawBaseUrl) {
    throw new Error("CPA baseURL cannot be empty");
  }
  const baseUrl = normalizeLocalCpaBaseUrl(rawBaseUrl);

  if (!apiKey) {
    throw new Error("CPA key cannot be empty");
  }

  if (!model) {
    throw new Error("CPA model cannot be empty");
  }

  return {
    baseUrl,
    apiKey,
    model
  };
}

export function buildCpaEnvFile(config: LocalCpaConfig): string {
  return [
    `CPA_BASE_URL=${config.baseUrl}`,
    `CPA_MODEL=${config.model}`,
    `CPA_API_KEY=${config.apiKey}`,
    ""
  ].join("\n");
}

export function updateLocalCpaConfig(patch: LocalCpaConfigPatch): LocalCpaConfig {
  const updated = mergeCpaConfig(getLocalCpaConfig(), patch);
  const configFile = getCpaConfigFile();
  mkdirSync(dirname(configFile), { recursive: true });
  writeFileSync(configFile, buildCpaEnvFile(updated), "utf8");
  return updated;
}

export async function generateCpaDraftMarkdown(
  topic: TopicCandidate,
  options: CpaGenerationOptions
): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const brief = buildContentBrief(topic);
  const writingProfile = writingProfileFor(topic);
  const verifiedFacts = (topic.factPack ?? []).filter((fact) => fact.verificationStatus === "verified");
  const factLines = verifiedFacts.length > 0
    ? verifiedFacts.map((fact, index) => [
        `${index + 1}. ${fact.claim}`,
        `   来源：${fact.sourceName}`,
        fact.sourceUrl ? `   链接：${fact.sourceUrl}` : null,
        fact.publishedAt ? `   日期：${fact.publishedAt}` : null,
        fact.applicableRegion ? `   适用地区：${fact.applicableRegion}` : null
      ].filter(Boolean).join("\n")).join("\n")
    : "无已核验事实。不要补写具体数字、政策结论、调查结果、录取结论或就业结论；把文章收窄为有边界的作者判断或低风险行动建议，不要写成面面俱到的百科答案。";
  const trendContext = options.trendContext
    ? [
        `热榜线索：${options.trendContext.title}`,
        `观察来源：${options.trendContext.source}`,
        `观察时间：${options.trendContext.observedAt}`,
        options.trendContext.url ? `线索链接：${options.trendContext.url}` : null,
        "这组信息只证明该话题进入采集到的热榜，不证明热榜标题中的具体说法。"
      ].filter(Boolean).join("\n")
    : "没有单独的热榜上下文。";
  const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/chat/completions`, withFetchTimeout({
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        {
          role: "system",
          content: [
            "你是面向大众读者的微信公众号内容写手，只输出可直接给读者看的 Markdown 正文。" ,
            "你不是中立客服，也不是知识百科。你是有判断、有取舍、知道什么时候不把话说满的真人编辑。" ,
            "目标不是写最完整、最正确的标准答案，而是写普通人愿意读完、能感到作者在场的公众号文章。" ,
            "写作方法采用热点价值翻译：不要搬运新闻，要解释话题与普通人的钱、工作、选择和机会有什么关系。" ,
            "文章要有具体场景、明确判断、真实素材、节奏变化和必要留白。清单只在真正有用时出现，不得把每个观点都编号。" ,
            "先在内部比较 3 种提纲，选择最适合目标读者和文章类型的一种；只输出最终文章，不展示提纲比较过程。" ,
            "写完后在内部做一次编辑重写：删掉标准连接词、重复总结、对称段落和任何可以套到别的主题上的万能句。" ,
            "事实只能来自用户提供的已核验事实素材包。素材包没有提供的信息，不得补数字、补来源、补政策或编造真实案例。" ,
            "第一人称只能用于观点和判断，不得编造作者亲历、朋友故事、采访或群聊细节。" ,
            "内容必须适合真实公众号草稿箱：不要输出收益假设、审阅提示、内部评分、风险分、成本、模型说明或运营系统字段。" ,
            "根据选题策略写作：追热点要交代受影响人群和行动窗口；造热点要公开样本、方法和可复核证据；转化内容要比较适用条件、总成本和替代方案。" ,
            "避开政治、公共事件、灾难、刑事、医疗、金融投资、法律结论和未经核实的事实。不要承诺收益，不要编造案例、数据来源或具体事实。"
          ].join("\n")
        },
        {
          role: "user",
          content: [
            "请基于下面选题生成一篇可直接进入微信公众号草稿箱的文章。准备给真实大众读者看，不是给内部审阅者或技术圈小范围读者看。" ,
            `标题：${topic.title}`,
            `分类：${topic.category}`,
            `文章类型：${brief.articleType}`,
            `主要目标：${brief.primaryGoal}`,
            `内容策略：${topic.contentStrategy ?? topic.opportunityProfile?.strategy ?? "常规"}`,
            `主要变现路径：${topic.primaryMonetizationChannel ?? "未指定"}`,
            `目标读者：${brief.audience}`,
            `读者问题：${brief.readerProblem}`,
            `核心承诺：${brief.corePromise}`,
            `写作角度：${brief.angle}`,
            `结尾行动：${brief.callToAction}`,
            `禁止事项：${brief.mustAvoid.join("；")}`,
            "",
            "本篇声音配置：",
            `- 叙事视角：${writingProfile.perspective}`,
            `- 情绪质地：${writingProfile.tone}`,
            `- 段落节奏：${writingProfile.rhythm}`,
            `- 收尾方式：${writingProfile.closing}`,
            "",
            "当天热榜上下文：",
            trendContext,
            "",
            "已核验事实素材包：",
            factLines,
            "",
            "硬性要求：",
            "1. 使用 Markdown，包含 1 个中文 # 标题和 2-4 个 ## 小节。小节数量服从内容，不要为了完整硬凑结构。" ,
            "2. 开头 120 字内进入一个可感知的动作、冲突或疑问。只能使用已给素材或通用场景，不得伪造具体人物经历。" ,
            "3. 至少写出一处明确作者判断和一处保留、自我修正或反面情况；不要每句话都四平八稳。" ,
            "4. 长短句和段落长度要明显变化。允许一个 4-10 字的短段落，也允许一个 60-120 字的完整分析段。" ,
            "5. 整篇最多使用一个主清单。不同 H2 不得重复‘观点→解释→例子→小结’的同一结构。" ,
            "6. 有已核验事实时，把来源自然写入对应 H2；没有事实时主动缩小论断，不写虚假的数据感和故事感。" ,
            "7. 禁止使用：首先、其次、综上所述、总的来说、值得注意的是、不可否认、由此可见、在此基础上、与此同时。" ,
            "8. 结尾执行本篇声音配置，不回顾全文，不写‘真正重要的不是A而是B’，不强行升华。" ,
            "9. 不要输出 Markdown 注释、编辑建议、配图占位符或任何内部说明。" ,
            "10. 不要写收益假设、内部实验、系统、模型、质量分或风险分；不要碰政治、灾难、刑事等高风险热点。"
          ].join("\n")
        }
      ],
      temperature: 0.72,
      max_tokens: 2200
    })
  }, 120_000));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`CPA generation failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("CPA generation returned empty content");
  }

  return content;
}

export async function listCpaModels(options: CpaGenerationOptions): Promise<string[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${options.baseUrl.replace(/\/$/, "")}/models`, withFetchTimeout({
    method: "GET",
    headers: {
      Authorization: `Bearer ${options.apiKey}`
    }
  }, 30_000));

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`CPA models request failed: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ id?: string }>;
  };

  return (data.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
}
