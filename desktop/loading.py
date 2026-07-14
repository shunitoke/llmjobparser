LOADING_HTML = r"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>vibejob</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #0f172a; color: #e2e8f0;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh;
  }
  .container { text-align: center; padding: 2rem; max-width: 400px; }
  .logo { width: 56px; height: 56px; margin: 0 auto 1rem; }
  .brand { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 1.5rem; }
  .brand span:first-child { color: #e2e8f0; }
  .brand span:last-child { color: #22c55e; }
  .spinner {
    width: 32px; height: 32px; margin: 0 auto 1.5rem;
    border: 3px solid #1e293b; border-top-color: #22c55e;
    border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .hint { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; min-height: 3em; }
</style>
</head>
<body>
<div class="container">
  <svg class="logo" viewBox="0 0 32 32" fill="none">
    <circle cx="14" cy="14" r="10" stroke="#22c55e" stroke-width="2.5"/>
    <circle cx="14" cy="14" r="6" stroke="#22c55e" stroke-width="1.5" opacity="0.6"/>
    <circle cx="14" cy="14" r="2.5" fill="#22c55e"/>
    <path d="M21.5 21.5 L28 28" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/>
  </svg>
  <div class="brand"><span>vibe</span><span>job</span></div>
  <div class="spinner"></div>
  <div class="hint" id="hint"></div>
</div>
<script>
const HINTS = [
  "Работа — последнее прибежище тех, кто больше ничего не умеет. — Оскар Уайльд",
  "Я не работаю. Я занимаюсь тем, что люблю. — Стив Джобс",
  "Выбирай работу по душе, и тебе не придётся работать ни дня в своей жизни. — Конфуций",
  "Главное — не количество часов, которые ты работаешь, а то, что ты получаешь от жизни. — Ричард Брэнсон",
  "Работа заполняет всё отведённое ей время. — Сирил Паркинсон",
  "Не зацикливайся на том, чего хочешь ты. Думай о том, что сделает тебя счастливым. — из фильма «В погоне за счастьем»",
  "Самый важный час — всегда текущий. Самое важное дело — быть счастливым. — Дзен",
  "Работа без радости — это каторга. — народная мудрость",
  "Мы работаем, чтобы жить, а не живём, чтобы работать. — народная мудрость",
  "Жизнь слишком коротка, чтобы тратить её на работу, которую не любишь. — неизвестный автор",
];
let i = 0;
const el = document.getElementById('hint');
el.textContent = HINTS[0];
setInterval(() => { i = (i + 1) % HINTS.length; el.textContent = HINTS[i]; }, 4000);
</script>
</body>
</html>"""
