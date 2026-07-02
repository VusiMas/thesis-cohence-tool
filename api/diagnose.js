export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { sections } = req.body;
  if (!sections || !Array.isArray(sections) || sections.length !== 9) {
    return res.status(400).json({ error: 'Expected 9 sections.' });
  }

  const LABELS = [
    'Research Problem', 'Research Questions', 'Literature Review',
    'Theoretical & Conceptual Framework', 'Methodology', 'Findings',
    'Discussion', 'Contribution', 'Overall Thesis Summary'
  ];

  const prompt = `You are an expert academic supervisor and thesis coherence analyst. Your role is diagnostic, developmental, and supportive — not punitive. Analyse the following nine thesis sections for internal coherence, alignment, and the presence of a clear "golden thread" from research problem through to scholarly contribution.

${sections.map((s, i) => `SECTION ${i + 1} — ${LABELS[i]}:\n${s || '[Not provided — score 0]'}`).join('\n\n')}

Score each section 0–2:
- 2 = Strong alignment — clear, coherent, well-positioned
- 1 = Partial alignment — present but needs strengthening or clarification
- 0 = Weak, unclear, or not provided

Total is out of 18. Apply this verdict:
- 15–18: Strong Coherence
- 10–14: Needs Strengthening
- 0–9: Golden Thread at Risk

Respond with ONLY a raw JSON object. No markdown, no code fences, no explanation outside the JSON.

Required format:
{"scores":[0,0,0,0,0,0,0,0,0],"explanations":["2-3 sentence developmental explanation","","","","","","","",""],"total":0,"verdict":"","verdict_desc":"2-3 sentences describing the overall coherence finding in a supportive, scholarly tone.","improvements":["Specific actionable improvement — name the section and what to do","Second priority","Third priority"],"golden_thread":"A single well-constructed paragraph showing the revised golden thread: how the problem leads to the research questions, which are grounded in a literature gap, addressed through a justified framework and appropriate methodology, answered by the findings, interpreted in the discussion, and crystallised into a scholarly contribution."}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API error' });
    }

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) return res.status(500).json({ error: 'No text content in response' });

    let jsonStr = textBlock.text.trim();
    const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();
    const s = jsonStr.indexOf('{'), e = jsonStr.lastIndexOf('}');
    if (s !== -1 && e !== -1) jsonStr = jsonStr.slice(s, e + 1);

    const result = JSON.parse(jsonStr);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
