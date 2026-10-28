const fs = require('node:fs');

(async () => {
  const key = fs.readFileSync(process.argv[2], 'utf8').trim();
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://app.revuptime.com', 'X-Title': 'RevUpTime provider diagnostic' };
  const account = await fetch('https://openrouter.ai/api/v1/key', { headers, signal: AbortSignal.timeout(15000) });
  const a = await account.json();
  console.log(JSON.stringify({ check: 'credential', status: account.status, valid: account.ok, freeTier: a.data?.is_free_tier, error: a.error?.message }));
  if (!account.ok) return;
  for (const model of ['nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3-ultra-550b-a55b:free']) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages: [{role:'user',content:'In one sentence, explain what a vibration sensor measures.'}], max_tokens: 256, temperature: 0.2, reasoning: { effort:'low', exclude:true }, provider: {allow_fallbacks:true} }),
      signal: AbortSignal.timeout(45000),
    });
    const body = await response.json();
    console.log(JSON.stringify({ check:'synthetic_completion', model, status:response.status, content:body.choices?.[0]?.message?.content, error:body.error?.message, providerCode:body.error?.code }));
    if (response.ok && body.choices?.[0]?.message?.content?.trim()) break;
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
