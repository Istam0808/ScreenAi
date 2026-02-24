import { GoogleGenAI } from '@google/genai';

export async function POST(request) {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return Response.json(
      { error: 'API-ключ не задан. Создайте файл .env.local в корне проекта и укажите: GOOGLE_GENAI_API_KEY=ваш_ключ' },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Неверное тело запроса' }, { status: 400 });
  }

  const rawImage = body.image;
  if (!rawImage) {
    return Response.json({ error: 'Нет поля image' }, { status: 400 });
  }

  const base64 = rawImage.replace(/^data:image\/\w+;base64,/, '');

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: 60000 },
  });
  const systemPrompt = `Ты анализируешь скриншот экрана. Твоя главная задача — РЕШАТЬ задания, а не только описывать картинку.

Если на скриншоте есть:
- вопрос теста, викторины, экзамена;
- задача по математике, физике, логике и т.п.;
- задание «выбери правильный ответ» или «напиши ответ»;
- любой другой чётко сформулированный вопрос или задачу —

то ОБЯЗАТЕЛЬНО реши задание пошагово и в конце чётко напиши ответ. Например: «Правильный ответ: …» или «Ответ: …». Не ограничивайся описанием вариантов — укажи, какой вариант верный и почему.

Если на скриншоте нет явного задания (просто интерфейс, страница, форма без конкретного вопроса) — кратко опиши, что изображено, и дай анализ.`;

  const contents = [
    {
      inlineData: {
        mimeType: 'image/png',
        data: base64,
      },
    },
    systemPrompt,
  ];

  async function callGemini() {
    return ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });
  }

  function is429Error(err) {
    const msg = String(err?.message || '');
    const status = err?.status ?? err?.code;
    return status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
  }

  function getRetryDelaySec(err) {
    let retryDelaySec = 30;
    try {
      const msg = String(err?.message || '');
      const match = msg.match(/retry.*?(\d+(?:\.\d+)?)\s*s/i) || msg.match(/(\d+(?:\.\d+)?)\s*sec/i);
      if (match) retryDelaySec = Math.min(Math.ceil(Number(match[1]) || 30), 60);
      if (err?.details && Array.isArray(err.details)) {
        const retryInfo = err.details.find((d) => d?.retryDelay);
        if (retryInfo?.retryDelay) retryDelaySec = Math.min(Math.ceil(Number(String(retryInfo.retryDelay).replace('s', '')) || 30), 60);
      }
    } catch (_) {}
    return retryDelaySec;
  }

  try {
    let response = await callGemini();
    let text = response?.text ?? '';
    if (text) return Response.json({ text });

    const err = new Error('Пустой ответ от модели');
    err.status = 502;
    throw err;
  } catch (err) {
    if (is429Error(err)) {
      const retryDelaySec = getRetryDelaySec(err);
      await new Promise((r) => setTimeout(r, retryDelaySec * 1000));
      try {
        const retryResponse = await callGemini();
        const text = retryResponse?.text ?? '';
        if (text) return Response.json({ text });
      } catch (retryErr) {
        if (is429Error(retryErr)) {
          return Response.json(
            {
              error: `Превышен лимит запросов бесплатного тарифа Gemini (до 5 в минуту). Подождите около ${getRetryDelaySec(retryErr)} сек и попробуйте снова. Подробнее: https://ai.google.dev/gemini-api/docs/rate-limits`,
            },
            { status: 429 }
          );
        }
        throw retryErr;
      }
    }

    const status = err?.status ?? err?.code ?? 502;
    const cause = err?.cause;
    const msg = String(err?.message || '');
    const isTimeout =
      cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
      String(cause?.message || '').includes('Connect Timeout') ||
      msg.includes('fetch failed');
    const isLeakedKey =
      status === 403 ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('leaked') ||
      msg.includes('API key was reported');
    const userMessage = isLeakedKey
      ? 'Этот API-ключ заблокирован Google (считается скомпрометированным). Создайте новый ключ в Google AI Studio и укажите его в .env.local как GOOGLE_GENAI_API_KEY.'
      : isTimeout
        ? 'Нет связи с серверами Google (таймаут). Проверьте интернет, VPN, антивирус и файрвол. Если вы за прокси — настройте его для Node.js.'
        : err?.message || 'Ошибка при обращении к Google AI';
    console.error('Gemini API error:', err);
    return Response.json({ error: userMessage }, { status: status >= 400 ? status : 502 });
  }
}
