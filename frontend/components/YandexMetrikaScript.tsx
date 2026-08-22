'use client';

import Script from 'next/script';
import {
  getYandexMetrikaId,
  flushYandexMetrikaQueue,
  isYandexMetrikaEnabled,
} from '@/lib/yandexMetrika';

/**
 * Loads tag.js and boots the counter. Hits/goals are sent from analytics.ts.
 * Mounts only in the browser when Metrika is enabled (skips localhost by default).
 */
export function YandexMetrikaScript(): React.ReactNode {
  const id = getYandexMetrikaId();
  // Mount on first client render (no useState delay) so early landing_viewed can queue against ym stub.
  if (!id || typeof window === 'undefined' || !isYandexMetrikaEnabled()) {
    return null;
  }

  return (
    <>
      <Script
        id="yandex-metrika"
        strategy="afterInteractive"
        onReady={flushYandexMetrikaQueue}
        onLoad={flushYandexMetrikaQueue}
      >{`
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(${id}, "init", {
  clickmap:true,
  trackLinks:true,
  accurateTrackBounce:true,
  webvisor:true
});
`}</Script>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc.yandex.ru/watch/${id}`}
            style={{ position: 'absolute', left: '-9999px' }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
