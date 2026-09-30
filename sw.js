/* Linux 学练营 Service Worker：全量预缓存——首次打开后可完全离线使用。
 * 更新内容时把 CACHE 版本号 +1，旧缓存会在 activate 阶段自动清除。 */
const CACHE = 'linux-study-v1';
const ASSETS = [
  "./css/style.css",
  "./data/exams/exam-final.js",
  "./data/exams/exam1.js",
  "./data/exams/exam2.js",
  "./data/exams/exam3.js",
  "./data/exams/exam4.js",
  "./data/exams/exam5.js",
  "./data/reference.js",
  "./data/stages/s1.js",
  "./data/stages/s2.js",
  "./data/stages/s3.js",
  "./data/stages/s4.js",
  "./data/stages/s5.js",
  "./data/stages/s6.js",
  "./diagrams/boot-process.svg",
  "./diagrams/cron-syntax.svg",
  "./diagrams/dnf-workflow.svg",
  "./diagrams/fhs-tree.svg",
  "./diagrams/file-operations.svg",
  "./diagrams/hard-vs-soft-link.svg",
  "./diagrams/install-partition.svg",
  "./diagrams/io-redirection.svg",
  "./diagrams/linux-distro-family.svg",
  "./diagrams/log-flow.svg",
  "./diagrams/lvm-structure.svg",
  "./diagrams/man-sections.svg",
  "./diagrams/network-firewalld.svg",
  "./diagrams/permission-model.svg",
  "./diagrams/process-lifecycle.svg",
  "./diagrams/rhcsa-exam-map.svg",
  "./diagrams/script-flow.svg",
  "./diagrams/selinux-context.svg",
  "./diagrams/shell-architecture.svg",
  "./diagrams/storage-mount.svg",
  "./diagrams/sudo-chain.svg",
  "./diagrams/systemd-flow.svg",
  "./diagrams/text-pipeline.svg",
  "./diagrams/user-accounts.svg",
  "./diagrams/vim-modes.svg",
  "./index.html",
  "./js/app.js",
  "./js/components.js",
  "./js/data.js",
  "./js/lib/mockfs.js",
  "./js/lib/parser.js",
  "./js/lib/tasks.js",
  "./js/playground.js",
  "./js/quiz.js",
  "./js/store.js"
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit ||
      fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    )
  );
});
