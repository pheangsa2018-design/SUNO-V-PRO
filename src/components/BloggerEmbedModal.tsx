import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Code2, 
  Layers, 
  Layout, 
  Sparkles,
  HelpCircle,
  Smartphone,
  Download,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Globe,
  ExternalLink,
  Zap
} from 'lucide-react';
import type { Language } from '../i18n.js';
import { translations } from '../i18n.js';

interface BloggerEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const BloggerEmbedModal: React.FC<BloggerEmbedModalProps> = ({ isOpen, onClose, lang }) => {
  const t = translations[lang];
  const [embedTab, setEmbedTab] = useState<'theme' | 'native' | 'full' | 'sidebar' | 'button'>('theme');
  const [copied, setCopied] = useState(false);
  const [embedHeight, setEmbedHeight] = useState('950');

  // Detect current origin
  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-y5huqu2d5ypj5b53jrab3v-243030765803.us-east5.run.app';
  const [appUrl, setAppUrl] = useState(defaultOrigin);

  if (!isOpen) return null;

  const isDevUrl = appUrl.includes('ais-dev-');

  // Generate HTML/XML codes based on tab
  const getEmbedCode = () => {
    const targetUrl = appUrl.trim() || defaultOrigin;

    if (embedTab === 'theme') {
      return `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:css='false' b:responsive='true' lang='km' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head>
  <meta charset='utf-8'/>
  <meta content='width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5' name='viewport'/>
  <title><data:blog.pageTitle/></title>
  
  <meta content='ទាញយកបទចម្រៀង ឬ Playlist ទាំងមូលពី Suno ជាទម្រង់ MP3 320kbps និង WAV Lossless ដោយឥតគិតថ្លៃ ជាមួយកម្មវិធីចាក់ស្តាប់ Waveform និងមើលទំនុកច្រៀង' name='description'/>
  <meta content='Suno Downloader, Suno MP3, Suno WAV, Suno Playlist Downloader, Suno AI Audio, ទាញយកបទចម្រៀង Suno' name='keywords'/>
  <meta content='Remix Suno Downloader' property='og:title'/>
  <meta content='website' property='og:type'/>

  <b:include data='blog' name='all-head-content'/>

  <!-- Google Fonts: Kantumruy Pro & Plus Jakarta Sans & JetBrains Mono -->
  <link rel='preconnect' href='https://fonts.googleapis.com'/>
  <link rel='preconnect' href='https://fonts.gstatic.com' crossorigin='anonymous'/>
  <link href='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Kantumruy+Pro:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;display=swap' rel='stylesheet'/>

  <b:skin><![CDATA[
  /* ==========================================================================
     SUNO MP3 & WAV DOWNLOADER - COMPLETE BLOGGER TEMPLATE (DARK STUDIO)
     ========================================================================== */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html {
    scroll-behavior: smooth;
  }
  body {
    background-color: #0a0a0a;
    color: #f5f5f5;
    font-family: 'Kantumruy Pro', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    line-height: 1.6;
  }
  ::selection {
    background: #f59e0b;
    color: #0a0a0a;
  }
  a {
    color: #f59e0b;
    text-decoration: none;
  }
  .suno-navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100%;
    background: rgba(10, 10, 10, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
  }
  .suno-nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .suno-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .suno-logo-icon {
    width: 38px;
    height: 38px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000;
    font-weight: 900;
    font-size: 18px;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
  }
  .suno-brand-title {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
  }
  .suno-brand-sub {
    font-size: 11px;
    color: #a3a3a3;
  }
  .suno-nav-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .badge-quality {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 9999px;
    font-family: 'JetBrains Mono', monospace;
  }
  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    animation: pulseDot 2s infinite ease-in-out;
  }
  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.8); }
  }
  .btn-fullscreen {
    background: #171717;
    border: 1px solid #262626;
    color: #d4d4d4;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .btn-fullscreen:hover {
    background: #262626;
    color: #ffffff;
  }
  .suno-wrapper {
    flex: 1;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 32px 20px 48px;
  }
  .suno-hero {
    text-align: center;
    margin-bottom: 28px;
  }
  .suno-hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #fbbf24;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 14px;
    border-radius: 9999px;
    margin-bottom: 14px;
  }
  .suno-hero-title {
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #ffffff;
    margin-bottom: 10px;
    line-height: 1.25;
  }
  @media (min-width: 768px) {
    .suno-hero-title {
      font-size: 42px;
    }
  }
  .suno-hero-desc {
    font-size: 15px;
    color: #a3a3a3;
    max-width: 700px;
    margin: 0 auto;
  }
  .suno-tool-card {
    background: #121212;
    border: 1px solid #262626;
    border-radius: 18px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    overflow: hidden;
    margin-bottom: 40px;
  }
  .suno-tool-header {
    background: #171717;
    padding: 12px 20px;
    border-bottom: 1px solid #262626;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .suno-traffic-lights {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .traffic-dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
  }
  .traffic-red { background: #ef4444; }
  .traffic-yellow { background: #f59e0b; }
  .traffic-green { background: #10b981; }
  .suno-frame-url {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    color: #737373;
    background: #0a0a0a;
    padding: 4px 14px;
    border-radius: 6px;
    border: 1px solid #262626;
  }
  .suno-frame-wrap {
    position: relative;
    width: 100%;
    min-height: 960px;
    background: #0a0a0a;
  }
  .suno-iframe {
    width: 100%;
    height: 960px;
    border: none;
    display: block;
  }
  .suno-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 48px;
  }
  .feature-card {
    background: #121212;
    border: 1px solid #262626;
    border-radius: 14px;
    padding: 24px;
    transition: transform 0.2s, border-color 0.2s;
  }
  .feature-card:hover {
    transform: translateY(-3px);
    border-color: #f59e0b;
  }
  .feature-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-bottom: 16px;
  }
  .feature-title {
    font-size: 16px;
    font-weight: 700;
    color: #f5f5f5;
    margin-bottom: 8px;
  }
  .feature-desc {
    font-size: 13px;
    color: #a3a3a3;
    line-height: 1.5;
  }
  .suno-faq-section {
    background: #121212;
    border: 1px solid #262626;
    border-radius: 16px;
    padding: 32px 24px;
    margin-bottom: 48px;
  }
  .faq-heading {
    font-size: 22px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 20px;
    text-align: center;
  }
  .faq-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  @media (min-width: 768px) {
    .faq-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  .faq-item {
    background: #171717;
    border: 1px solid #262626;
    border-radius: 12px;
    padding: 18px;
  }
  .faq-q {
    font-size: 14px;
    font-weight: 700;
    color: #fbbf24;
    margin-bottom: 8px;
  }
  .faq-a {
    font-size: 13px;
    color: #d4d4d4;
    line-height: 1.6;
  }
  .suno-footer {
    background: #0d0d0d;
    border-top: 1px solid #262626;
    padding: 32px 20px;
    text-align: center;
    color: #737373;
    font-size: 13px;
    margin-top: auto;
  }
  .footer-sub {
    font-size: 12px;
    margin-top: 6px;
    color: #525252;
  }
  .blogger-content-section {
    display: none !important;
  }
  ]]></b:skin>
</head>
<body>
  <header class='suno-navbar'>
    <div class='suno-nav-inner'>
      <div class='suno-brand'>
        <div class='suno-logo-icon'>♪</div>
        <div class='suno-brand-text'>
          <span class='suno-brand-title'><data:blog.title/></span>
          <span class='suno-brand-sub'>Remix Suno MP3 &amp; WAV Downloader</span>
        </div>
      </div>
      <div class='suno-nav-actions'>
        <div class='badge-quality'>
          <span class='badge-dot'></span>
          <span>MP3 320k / WAV</span>
        </div>
        <button class='btn-fullscreen' id='btn-toggle-fullscreen' onclick='toggleFullscreen()'>
          <span>⛶</span>
          <span>ពេញអេក្រង់</span>
        </button>
      </div>
    </div>
  </header>

  <main class='suno-wrapper'>
    <div class='suno-hero'>
      <div class='suno-hero-tag'>
        <span>⚡</span>
        <span>Suno AI Audio Studio Tool</span>
      </div>
      <h1 class='suno-hero-title'>កម្មវិធីទាញយកបទចម្រៀង Suno MP3 &amp; WAV</h1>
      <p class='suno-hero-desc'>
        ទាញយកបទចម្រៀងទោល ឬ Playlist ទាំងមូលពី Suno កម្រិតគុណភាពខ្ពស់ 320kbps និង WAV Lossless ដោយឥតគិតថ្លៃ ជាមួយឧបករណ៍វិភាគ Waveform និងទាញយកទំនុកច្រៀង
      </p>
    </div>

    <!-- Live Downloader Tool Card -->
    <div class='suno-tool-card' id='tool-container'>
      <div class='suno-tool-header'>
        <div class='suno-traffic-lights'>
          <span class='traffic-dot traffic-red'></span>
          <span class='traffic-dot traffic-yellow'></span>
          <span class='traffic-dot traffic-green'></span>
        </div>
        <div class='suno-frame-url'>
          <span>suno-downloader.app/studio</span>
        </div>
        <div>
          <span style='font-size: 11px; color: #10b981; font-family: monospace;'>● Online</span>
        </div>
      </div>

      <div class='suno-frame-wrap'>
        <iframe 
          allow='clipboard-write; clipboard-read; autoplay; encrypted-media; fullscreen' 
          class='suno-iframe' 
          id='suno-app-iframe' 
          loading='eager' 
          src='${targetUrl}' 
          title='Suno Audio Downloader'>
        </iframe>
      </div>
    </div>

    <!-- Features -->
    <div class='suno-features'>
      <div class='feature-card'>
        <div class='feature-icon'>🎧</div>
        <h3 class='feature-title'>គុណភាពសម្លេងកម្រិត Studio</h3>
        <p class='feature-desc'>ទាញយកជា MP3 កម្រិតខ្ពស់បំផុត 320kbps និង WAV Lossless គុណភាពពេញលេញសម្រាប់យកទៅប្រើប្រាស់ក្នុង Studio ឬ Mixing។</p>
      </div>
      <div class='feature-card'>
        <div class='feature-icon'>⚡</div>
        <h3 class='feature-title'>ទាញយក Playlist &amp; Profile</h3>
        <p class='feature-desc'>គាំទ្រការទាញយក Playlist ទាំងមូល ឬ Profile របស់អ្នកបង្កើត (@creator) ទាំងអស់ក្នុងពេលតែមួយដោយចុចតែម្តង។</p>
      </div>
      <div class='feature-card'>
        <div class='feature-icon'>📦</div>
        <h3 class='feature-title'>បង្រួមជាកញ្ចប់ ZIP ដោយស្វ័យប្រវត្ត</h3>
        <p class='feature-desc'>ជ្រើសរើសទាញយកបទចម្រៀងច្រើន ឬ Playlist ទាំងមូល ដោយប្រព័ន្ធនឹងបង្រួមជាឯកសារ .zip តែមួយយ៉ាងលឿនបំផុត។</p>
      </div>
      <div class='feature-card'>
        <div class='feature-icon'>🌊</div>
        <h3 class='feature-title'>Waveform &amp; Lyrics Extractor</h3>
        <p class='feature-desc'>ឧបករណ៍ចាក់ស្តាប់ជាមួយរលកសម្លេង Realtime Web Audio Waveform មើលទំនុកច្រៀង និង Prompt ដែលប្រើក្នុងការបង្កើតបទចម្រៀង។</p>
      </div>
    </div>

    <!-- FAQ -->
    <div class='suno-faq-section'>
      <h2 class='faq-heading'>សំណួរដែលតែងតែកើតមាន (FAQ)</h2>
      <div class='faq-grid'>
        <div class='faq-item'>
          <h4 class='faq-q'>❓ តើទាញយកបទចម្រៀងពី Suno យ៉ាងដូចម្តេច?</h4>
          <p class='faq-a'>ងាយស្រួលបំផុត! គ្រាន់តែចម្លង (Copy) Link បទចម្រៀង Playlist ឬ Profile ពី Suno.com ហើយបិទភ្ជាប់ (Paste) ក្នុងប្រអប់ស្វែងរក រួចចុចប៊ូតុង "ទាញយក"។</p>
        </div>
        <div class='faq-item'>
          <h4 class='faq-q'>❓ តើមានដែនកំណត់ចំនួនបទចម្រៀងដែរឬទេ?</h4>
          <p class='faq-a'>គ្មានដែនកំណត់ទេ! អ្នកអាចទាញយកបទចម្រៀងបានរាប់រយបទ ទាំងទម្រង់ MP3 និង WAV ដោយឥតគិតថ្លៃ ១០០%។</p>
        </div>
        <div class='faq-item'>
          <h4 class='faq-q'>❓ តើខ្ញុំអាចទាញយក Playlist ទាំងមូលបានទេ?</h4>
          <p class='faq-a'>បាទ/ចាស បាន! គ្រាន់តែដាក់ Link Playlist (ឧ. suno.com/playlist/...) ប្រព័ន្ធនឹងបង្ហាញបទទាំងអស់ រួចអ្នកអាចចុច "ទាញយក ZIP ទាំងអស់" បានភ្លាម។</p>
        </div>
        <div class='faq-item'>
          <h4 class='faq-q'>❓ ហេតុអ្វីបានជាទម្រង់ WAV ល្អជាង MP3?</h4>
          <p class='faq-a'>WAV គឺជាទម្រង់ Uncompressed Lossless Audio ដែលរក្សាគុណភាពសម្លេងដើមបានល្អបំផុត មិនបាត់បង់ Detail ស័ក្តិសមសម្រាប់ផលិតកម្មតន្ត្រី។</p>
        </div>
      </div>
    </div>

    <!-- Blogger Content Section -->
    <div class='blogger-content-section'>
      <b:section class='main' id='main' maxwidgets='1' showaddelement='no'>
        <b:widget id='Blog1' locked='true' title='Blog Posts' type='Blog' version='1'>
          <b:includable id='main'>
            <b:loop values='data:posts' var='post'>
              <article expr:id='data:post.id'>
                <h2><data:post.title/></h2>
                <div><data:post.body/></div>
              </article>
            </b:loop>
          </b:includable>
        </b:widget>
      </b:section>
    </div>
  </main>

  <footer class='suno-footer'>
    <p>© <data:blog.title/> - Suno Audio Downloader &amp; Studio Player</p>
    <p class='footer-sub'>ឧបករណ៍នេះមិនមានទំនាក់ទំនងផ្លូវការជាមួយ Suno.ai ទេ។</p>
  </footer>

  <script type='text/javascript'>
  //&lt;![CDATA[
  function toggleFullscreen() {
    var elem = document.getElementById('tool-container');
    if (!document.fullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
      document.getElementById('btn-toggle-fullscreen').innerText = '✕ ចេញពីពេញអេក្រង់';
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      document.getElementById('btn-toggle-fullscreen').innerText = '⛶ ពេញអេក្រង់';
    }
  }
  //]]&gt;
  </script>
</body>
</html>`;
    }

    // NATIVE WIDGET (PURE HTML / JAVASCRIPT - NO IFRAME - NO 403 ERROR EVER!)
    if (embedTab === 'native') {
      return `<!-- === SUNO MP3 DOWNLOADER NATIVE BLOGGER WIDGET (NO IFRAME - 100% NO 403) === -->
<div id="suno-native-widget" style="max-width: 680px; margin: 20px auto; background: #0f0f11; border: 1px solid #27272a; border-radius: 16px; padding: 24px; color: #f4f4f5; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; border-bottom: 1px solid #27272a; padding-bottom: 12px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); display: flex; align-items: center; justify-content: center; color: #000; font-weight: 800; font-size: 16px;">♪</div>
      <div>
        <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fff;">Suno Audio Downloader</h3>
        <p style="margin: 0; font-size: 11px; color: #a1a1aa;">Native Studio Widget</p>
      </div>
    </div>
    <span style="font-size: 11px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: #34d399; padding: 3px 8px; border-radius: 9999px; font-weight: 600;">MP3 320kbps</span>
  </div>

  <div style="display: flex; gap: 8px; margin-bottom: 12px;">
    <input 
      type="text" 
      id="suno-widget-input" 
      placeholder="Paste Suno song URL (e.g. suno.com/song/...)..." 
      style="flex: 1; background: #18181b; border: 1px solid #3f3f46; border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 13px; outline: none;"
    />
    <button 
      id="suno-widget-btn" 
      onclick="sunoFetchTrack()" 
      style="background: #f59e0b; color: #09090b; border: none; border-radius: 10px; padding: 0 20px; font-weight: 700; font-size: 13px; cursor: pointer; transition: background 0.2s;"
      onmouseover="this.style.background='#fbbf24'" 
      onmouseout="this.style.background='#f59e0b'">
      ទាញយក
    </button>
  </div>

  <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 16px;">
    <span style="font-size: 11px; color: #71717a;">សាកល្បង៖</span>
    <button onclick="sunoSetExample()" style="background: #27272a; border: 1px solid #3f3f46; color: #d4d4d8; font-size: 11px; border-radius: 6px; padding: 2px 8px; cursor: pointer;">Neon Cyber Dreams</button>
  </div>

  <div id="suno-widget-result" style="display: none; background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin-top: 14px;">
    <div style="display: flex; gap: 14px; align-items: center; margin-bottom: 14px;">
      <img id="suno-track-img" src="" alt="Cover" style="width: 64px; height: 64px; border-radius: 8px; object-fit: cover; background: #27272a;" onerror="this.src='https://cdn1.suno.ai/image_placeholder.png'"/>
      <div style="flex: 1; min-width: 0;">
        <h4 id="suno-track-title" style="margin: 0 0 4px; font-size: 14px; font-weight: 700; color: #fff; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">Suno AI Track</h4>
        <p id="suno-track-id" style="margin: 0; font-size: 11px; color: #a1a1aa; font-family: monospace;"></p>
      </div>
    </div>

    <!-- HTML5 Audio Player -->
    <audio id="suno-track-audio" controls style="width: 100%; height: 36px; margin-bottom: 14px; filter: invert(0.85); border-radius: 8px;"></audio>

    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <a id="suno-btn-dl" href="#" target="_blank" download style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #f59e0b; color: #000; font-weight: 700; font-size: 12px; padding: 10px 14px; border-radius: 8px; text-decoration: none;">
        <span>⬇️</span> <span>ទាញយក MP3 (Direct)</span>
      </a>
      <a id="suno-btn-cdn" href="#" target="_blank" style="flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #27272a; color: #e4e4e7; font-weight: 600; font-size: 12px; padding: 10px 14px; border-radius: 8px; text-decoration: none;">
        <span>🌐</span> <span>បើក Link ផ្ទាល់ (CDN)</span>
      </a>
    </div>
  </div>

  <div id="suno-widget-error" style="display: none; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 10px; font-size: 12px; color: #fca5a5; margin-top: 10px;"></div>
</div>

<script>
function sunoExtractUUID(input) {
  var m = input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

function sunoSetExample() {
  document.getElementById('suno-widget-input').value = 'https://suno.com/song/5adacb49-e794-40b9-89e8-06e43a3d74b4';
  sunoFetchTrack();
}

function sunoFetchTrack() {
  var val = document.getElementById('suno-widget-input').value.trim();
  var errBox = document.getElementById('suno-widget-error');
  var resBox = document.getElementById('suno-widget-result');
  errBox.style.display = 'none';

  if (!val) {
    errBox.innerText = 'សូមបញ្ចូល Link បទចម្រៀង Suno ជាមុនសិន!';
    errBox.style.display = 'block';
    return;
  }

  var songId = sunoExtractUUID(val);
  if (!songId) {
    errBox.innerText = 'រកមិនឃើញ Song ID ត្រឹមត្រូវនៅក្នុង Link ឡើយ (សូមពិនិត្យមើល Link សាជាថ្មី)។';
    errBox.style.display = 'block';
    return;
  }

  var mp3Url = 'https://cdn1.suno.ai/' + songId + '.mp3';
  var imgUrl = 'https://cdn1.suno.ai/image_' + songId + '.png';

  document.getElementById('suno-track-id').innerText = 'ID: ' + songId;
  document.getElementById('suno-track-title').innerText = 'Suno Track (' + songId.substring(0, 8) + ')';
  document.getElementById('suno-track-img').src = imgUrl;

  var audio = document.getElementById('suno-track-audio');
  audio.src = mp3Url;

  var dlBtn = document.getElementById('suno-btn-dl');
  dlBtn.href = mp3Url;
  dlBtn.download = 'Suno_' + songId.substring(0, 8) + '.mp3';

  var cdnBtn = document.getElementById('suno-btn-cdn');
  cdnBtn.href = mp3Url;

  resBox.style.display = 'block';
}
</script>
<!-- === END NATIVE BLOGGER WIDGET === -->`;
    }

    if (embedTab === 'full') {
      return `<!-- === SUNO MP3 & WAV DOWNLOADER FOR BLOGGER (PAGE/POST) === -->
<div class="suno-downloader-container" style="position: relative; width: 100%; max-width: 100%; margin: 20px auto; border-radius: 16px; overflow: hidden; background: #0a0a0a; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.6); border: 1px solid #262626;">
  <div style="background: #171717; padding: 10px 16px; border-bottom: 1px solid #262626; display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #f59e0b;"></span>
      <span style="color: #f5f5f5; font-size: 13px; font-weight: 600; font-family: sans-serif;">Suno Audio Downloader</span>
    </div>
    <span style="color: #10b981; font-size: 11px; font-family: monospace; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); border-radius: 9999px; padding: 2px 8px;">Studio Quality 320k / WAV</span>
  </div>
  <iframe 
    src="${targetUrl}" 
    style="width: 100%; height: ${embedHeight}px; border: none; display: block;" 
    title="Suno MP3 & WAV Downloader"
    allow="clipboard-write; clipboard-read; autoplay; encrypted-media; fullscreen" 
    loading="lazy">
  </iframe>
</div>
<!-- === END SUNO DOWNLOADER === -->`;
    }

    if (embedTab === 'sidebar') {
      return `<!-- === SUNO DOWNLOADER SIDEBAR GADGET FOR BLOGGER === -->
<div style="width: 100%; border-radius: 12px; overflow: hidden; background: #0a0a0a; border: 1px solid #262626; box-shadow: 0 10px 20px rgba(0,0,0,0.4);">
  <div style="padding: 10px; background: #171717; border-bottom: 1px solid #262626; text-align: center;">
    <strong style="color: #f59e0b; font-size: 13px; font-family: sans-serif;">🎵 Suno Audio Downloader</strong>
  </div>
  <iframe 
    src="${targetUrl}" 
    style="width: 100%; height: 680px; border: none; display: block;" 
    title="Suno Downloader Widget"
    allow="clipboard-write; autoplay; encrypted-media" 
    loading="lazy">
  </iframe>
</div>
<!-- === END SIDEBAR GADGET === -->`;
    }

    // Modal / Popup Launcher Button
    return `<!-- === SUNO DOWNLOADER POPUP BUTTON FOR BLOGGER === -->
<div style="margin: 20px 0; text-align: center;">
  <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" 
     style="display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #000; font-weight: 700; font-size: 15px; font-family: sans-serif; padding: 12px 24px; border-radius: 10px; text-decoration: none; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4); transition: transform 0.2s;"
     onmouseover="this.style.transform='scale(1.03)'" 
     onmouseout="this.style.transform='scale(1)'">
    <span>🎵</span>
    <span>ទាញយកបទចម្រៀង Suno MP3 & WAV</span>
    <span>↗</span>
  </a>
</div>
<!-- === END POPUP BUTTON === -->`;
  };

  const codeToCopy = getEmbedCode();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = codeToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadXml = () => {
    const xmlContent = getEmbedCode();
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suno-downloader-theme.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {t.bloggerEmbedTitle}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/25">
                  100% Blogger Ready
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                {embedTab === 'theme' ? t.bloggerThemeDesc : embedTab === 'native' ? t.bloggerTabNativeDesc : t.bloggerEmbedDesc}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* 403 Error Solution Alert Banner */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{t.bloggerFix403Title} (403 Forbidden Error)</span>
            </div>
            <p className="text-neutral-300 leading-relaxed">
              {t.bloggerFix403Desc}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setEmbedTab('native')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ប្រើ Native Widget (គ្មាន 403 ដាច់ខាត)</span>
              </button>
            </div>
          </div>

          {/* App URL Configurator (For Iframe and Theme) */}
          {embedTab !== 'native' && (
            <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  {t.bloggerAppUrlLabel}
                </label>
                {isDevUrl && (
                  <span className="text-[10px] text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                    ⚠️ Dev URL (អាចចេញ 403)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  placeholder="https://your-app.run.app"
                  className="flex-1 px-3 py-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-200 font-mono focus:border-amber-500 focus:outline-none"
                />
                <button
                  onClick={() => setAppUrl('https://ais-pre-y5huqu2d5ypj5b53jrab3v-243030765803.us-east5.run.app')}
                  className="px-2.5 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg font-medium transition-colors shrink-0"
                  title="Use Public Shared URL"
                >
                  Share Link
                </button>
              </div>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 bg-neutral-950 rounded-xl border border-neutral-800">
            <button
              onClick={() => setEmbedTab('theme')}
              className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                embedTab === 'theme'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Theme .XML</span>
            </button>
            <button
              onClick={() => setEmbedTab('native')}
              className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                embedTab === 'native'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold text-emerald-300">Native (No 403)</span>
            </button>
            <button
              onClick={() => setEmbedTab('full')}
              className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                embedTab === 'full'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Full Page</span>
            </button>
            <button
              onClick={() => setEmbedTab('sidebar')}
              className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                embedTab === 'sidebar'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Sidebar</span>
            </button>
            <button
              onClick={() => setEmbedTab('button')}
              className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                embedTab === 'button'
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-bold'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Button</span>
            </button>
          </div>

          {/* Special Action Bar for Blogger Theme XML */}
          {embedTab === 'theme' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
              <div className="flex items-center gap-2.5">
                <FileCode className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-300">suno-downloader-theme.xml</h4>
                  <p className="text-[11px] text-neutral-300">Blogger XML Template ពេញលេញ 100% Valid គ្មាន Error ពេល Upload</p>
                </div>
              </div>
              <button
                onClick={handleDownloadXml}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-all shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>{t.bloggerDownloadXml}</span>
              </button>
            </div>
          )}

          {/* Height adjustment for Full Post iframe */}
          {embedTab === 'full' && (
            <div className="flex items-center justify-between text-xs bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <span className="text-neutral-300 font-medium flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                {t.bloggerHeightLabel}
              </span>
              <div className="flex items-center gap-1.5">
                {['800', '950', '1100'].map((h) => (
                  <button
                    key={h}
                    onClick={() => setEmbedHeight(h)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                      embedHeight === h
                        ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
                        : 'text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800'
                    }`}
                  >
                    {h}px
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Code display block */}
          <div className="relative rounded-xl bg-neutral-950 border border-neutral-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/90 border-b border-neutral-800 text-xs">
              <div className="flex items-center gap-2 text-neutral-400 font-mono">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                <span className="ml-1 text-[11px]">
                  {embedTab === 'theme' ? 'suno-downloader-theme.xml' : embedTab === 'native' ? 'suno-native-widget.html' : 'blogger-embed.html'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {embedTab === 'theme' && (
                  <button
                    onClick={handleDownloadXml}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.xml</span>
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? t.bloggerCodeCopied : t.bloggerCopyCode}</span>
                </button>
              </div>
            </div>
            <pre className="p-4 text-xs font-mono text-neutral-300 overflow-x-auto whitespace-pre leading-relaxed max-h-56 select-all">
              {codeToCopy}
            </pre>
          </div>

          {/* Step by step guide */}
          <div className="bg-neutral-950/80 rounded-xl p-4 border border-neutral-800 space-y-2.5">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" />
              {embedTab === 'theme' ? t.bloggerThemeStepTitle : t.bloggerInstructionsTitle}
            </h4>
            {embedTab === 'theme' ? (
              <div className="space-y-2 text-xs text-neutral-300">
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t.bloggerThemeStep1}</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t.bloggerThemeStep2}</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-amber-300 font-medium">{t.bloggerThemeStep3}</span>
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{t.bloggerThemeStep4}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 text-xs text-neutral-300">
                <p>{t.bloggerStep1}</p>
                <p>{t.bloggerStep2}</p>
                <p className="text-amber-300/90 font-medium">{t.bloggerStep3}</p>
                <p>{t.bloggerStep4}</p>
                <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400">
                  💡 <span className="text-neutral-300 font-medium">{t.bloggerWidgetTip}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
          <span className="text-xs text-neutral-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            100% Blogger Compliant
          </span>
          <div className="flex items-center gap-2">
            {embedTab === 'theme' && (
              <button
                onClick={handleDownloadXml}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.bloggerDownloadXml}</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? t.bloggerCodeCopied : t.bloggerCopyCode}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
