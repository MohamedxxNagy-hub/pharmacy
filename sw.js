/* ════════════════════════════════════════════════════════════════
   دليل الصيدلية — Service Worker
   ─────────────────────────────────────────────────────────────────
   • أول فتحة (بإنترنت): يخزّن التطبيق كامل على الجهاز
   • كل فتحة بعدها: يقدّمه من التخزين فورًا — يشتغل offline بالكامل
   • لو فيه نت: ينزّل أي تحديث في الخلفية بصمت، ويطبّقه الفتحة الجاية

   ⚠️ عند كل تحديث للتطبيق: غيّر رقم VERSION تحت.
      من غير كده الموظفين هيفضلوا على النسخة القديمة.
   ════════════════════════════════════════════════════════════════ */

const VERSION = 'v2026-08-08-2155';
const CACHE   = 'pharmacy-' + VERSION;

/* الملفات الأساسية — لازم تتخزّن عشان التطبيق يشتغل offline */
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];


/* ── التثبيت: خزّن الملفات الأساسية ── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .catch(() => {
        /* لو ملف فشل، خزّن اللي نجح بدل ما التثبيت كله يفشل */
        return caches.open(CACHE).then(c =>
          Promise.all(CORE.map(u => c.add(u).catch(() => null)))
        );
      })
  );
  /* مانستعجلش التفعيل — النسخة الجديدة تشتغل في الفتحة الجاية
     عشان مانغيّرش التطبيق تحت إيد المستخدم وهو شغّال */
});


/* ── التفعيل: امسح النسخ القديمة ── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('pharmacy-') && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});


/* ── الطلبات ── */
self.addEventListener('fetch', (e) => {
  const req = e.request;

  /* GET فقط — أي حاجة تانية تعدّي للشبكة */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = (url.origin === self.location.origin);

  /* ١) التنقّل (فتح التطبيق): من التخزين فورًا + تحديث في الخلفية */
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then(cached => {
        const fresh = fetch(req)
          .then(res => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put('./index.html', copy));
            }
            return res;
          })
          .catch(() => cached);          /* مفيش نت → المخزَّن */
        return cached || fresh;
      })
    );
    return;
  }

  /* ٢) ملفات الموقع: المخزَّن أولًا، والشبكة احتياطي */
  if (sameOrigin) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) {
          /* حدّث الملف في الخلفية للفتحة الجاية */
          fetch(req).then(res => {
            if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res));
          }).catch(() => {});
          return cached;
        }
        return fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  /* ٣) موارد خارجية (خطوط جوجل): المخزَّن أولًا، ولو فشل الكل نسيبه للمتصفح */
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req)
      .then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => cached)
    )
  );
});


/* ── رسالة من التطبيق: طبّق التحديث حالًا ── */
self.addEventListener('message', (e) => {
  if (e.data === 'apply-update') self.skipWaiting();
});
