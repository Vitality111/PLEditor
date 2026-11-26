// Coded templates from the FictionMe and Phone Cleaner Figma boards (top / success creatives).
// Each entry builds the default blocks and settings; everything stays editable in the inspector.

const purpleCta = (text, extra = {}) => ({
  text,
  bgColor: '#7b2ff2',
  bgColor2: '#9b4dff',
  textColor: '#ffffff',
  radius: 999,
  height: 46,
  fontSize: 19,
  weight: 600,
  ...extra
});

export const KIT_TEMPLATES = [
  // ---------- Fiction Me ----------
  {
    id: 'titlecover',
    product: 'fiction',
    motion: 'titlecover',
    title: 'Обкладинка з назвою',
    reference: '0012 · 0007 · 00108 · 0029 · 00110',
    description: 'Темний фон, арт із назвою книги, глава і текст по центру. Арт іде вгору разом із текстом.',
    settings: {
      background: '#0b0a10',
      textColor: '#ece8f4',
      font: 'serif',
      accent: '#8b3dff',
      portrait: { fontSize: 17, contentWidth: 88, heroHeight: 56, ctaWidth: 62, ctaBottom: 4, gap: 12 },
      landscape: { fontSize: 16, contentWidth: 84, ctaWidth: 34, ctaBottom: 5, gap: 10, coverWidth: 40 }
    },
    blocks: (B, story) => [
      B('hero', { asset: 'fcm-cover/cpl.png', assetL: 'fcm-cover/cplL.png', focalY: 20 }),
      B('logo', { zone: 'top', asset: 'fcm-cover/brand.png', text: 'FictionMe', width: 34 }),
      B('title', {
        zone: 'bottom',
        role: 'booktitle',
        label: 'Назва книги',
        text: 'Luna Lola',
        fontSizePortrait: 46,
        fontSizeLandscape: 40,
        textColor: '#f3effa'
      }),
      B('text', {
        role: 'chapter',
        label: 'Глава',
        text: 'Chapter 1',
        fontSizePortrait: 15,
        fontSizeLandscape: 14,
        textColor: '#a46bff',
        weight: 700
      }),
      B('text', {
        role: 'pov',
        label: 'POV',
        text: "Lola's POV",
        fontSizePortrait: 16,
        fontSizeLandscape: 15,
        weight: 700,
        italic: true
      }),
      B('story', { text: story, align: 'center' }),
      B('cta', purpleCta('Read Now')),
      B('audio', { asset: 'fcm-cover/bgm.mp3' })
    ]
  },
  {
    id: 'niche',
    product: 'fiction',
    motion: 'niche',
    title: 'Стандарт ніші',
    reference: 'топ формат ніші',
    description: 'Картинка зверху, текст ліворуч. Під час скролу картинка йде вгору.',
    settings: {
      background: '#ffffff',
      textColor: '#1b1a1f',
      font: 'serif',
      accent: '#7b2ff2',
      portrait: { fontSize: 18, contentWidth: 88, heroHeight: 46, ctaWidth: 62, ctaBottom: 4, gap: 12 },
      landscape: { fontSize: 16, contentWidth: 86, ctaWidth: 34, ctaBottom: 5, gap: 10, coverWidth: 40 }
    },
    blocks: (B, story) => [
      B('hero', { asset: 'fcm-cover/cpl.png', assetL: 'fcm-cover/cplL.png', focalY: 25 }),
      B('logo', { zone: 'top', asset: 'fcm-cover/brand.png', text: 'FictionMe', width: 34 }),
      B('text', {
        role: 'chapter',
        label: 'Глава',
        text: 'Chapter 1',
        fontSizePortrait: 16,
        fontSizeLandscape: 15,
        textColor: '#7b2ff2',
        weight: 700,
        align: 'left'
      }),
      B('story', { text: story, align: 'left' }),
      B('cta', purpleCta('Read Next')),
      B('audio', { asset: 'fcm-cover/bgm.mp3' })
    ]
  },
  {
    id: 'infocard',
    product: 'fiction',
    motion: 'infocard',
    title: 'Інфо-картка',
    reference: '00109 · 0015',
    description: 'Арт із логотипом і жанрами, картка «Chapters / Ratings / Exclusive», далі текст.',
    settings: {
      background: '#ffffff',
      textColor: '#141318',
      font: 'serif',
      accent: '#7b2ff2',
      portrait: { fontSize: 17, contentWidth: 90, heroHeight: 50, ctaWidth: 62, ctaBottom: 4, gap: 12 },
      landscape: { fontSize: 15, contentWidth: 86, ctaWidth: 34, ctaBottom: 5, gap: 10, coverWidth: 40 }
    },
    blocks: (B, story) => [
      B('hero', { asset: 'fcm-cover/cpl.png', assetL: 'fcm-cover/cplL.png', focalY: 20 }),
      B('logo', { zone: 'bottom', asset: 'fcm-cover/brand.png', text: 'FictionMe', width: 34 }),
      B('text', {
        zone: 'bottom',
        role: 'genres',
        label: 'Жанри',
        text: 'Fantasy  •  Romance  •  Werewolf',
        fontSizePortrait: 13,
        fontSizeLandscape: 12,
        textColor: '#ffffff',
        weight: 500
      }),
      B('stats', {
        label: 'Картка книги',
        text: '171 Chapters|Completed\n4.8 ★|Ratings\n*Exclusive|Content',
        fontSizePortrait: 12,
        fontSizeLandscape: 11,
        width: 96,
        accentColor: '#a87cf5'
      }),
      B('text', {
        role: 'pov',
        label: 'POV',
        text: "Emily's POV",
        fontSizePortrait: 16,
        fontSizeLandscape: 15,
        textColor: '#7b2ff2',
        weight: 700
      }),
      B('story', { text: story, align: 'center' }),
      B('cta', purpleCta('Read Next')),
      B('audio', { asset: 'fcm-cover/bgm.mp3' })
    ]
  },
  {
    id: 'page',
    product: 'fiction',
    motion: 'page',
    title: 'Книжкова сторінка',
    reference: '0016 · 0069 · 0051',
    description: 'Біла сторінка на чорному: назва, мініатюра обкладинки, статистика, глава і текст.',
    settings: {
      background: '#000000',
      textColor: '#151418',
      font: 'serif',
      accent: '#7b2ff2',
      cardBg: '#ffffff',
      cardRadius: 18,
      portrait: { fontSize: 16, contentWidth: 92, ctaWidth: 62, ctaBottom: 4, gap: 12 },
      landscape: { fontSize: 15, contentWidth: 70, ctaWidth: 34, ctaBottom: 4, gap: 10 }
    },
    blocks: (B, story) => [
      B('logo', { zone: 'top', asset: 'fcm-cover/brand.png', text: 'FictionMe', width: 30 }),
      B('hero', { asset: 'fcm-cover/cpl.png', label: 'Мініатюра обкладинки' }),
      B('title', {
        zone: 'bottom',
        role: 'booktitle',
        label: 'Назва книги',
        text: 'Luna Lola',
        fontSizePortrait: 32,
        fontSizeLandscape: 26,
        textColor: '#6f5733',
        align: 'left'
      }),
      B('text', {
        zone: 'bottom',
        role: 'subtitle',
        label: 'Підзаголовок',
        text: 'The Moon Wolf',
        fontSizePortrait: 14,
        fontSizeLandscape: 12,
        textColor: '#6f5733',
        align: 'left',
        italic: true
      }),
      B('stats', {
        label: 'Картка книги',
        text: '1M|Views\n4.9 ★|Ratings\n163 Chapters|Completed',
        fontSizePortrait: 11,
        fontSizeLandscape: 10,
        width: 100,
        bgColor: '#f7f5fb',
        accentColor: '#e3dcf3'
      }),
      B('text', {
        role: 'chapter',
        label: 'Глава',
        text: "Lola's POV",
        fontSizePortrait: 17,
        fontSizeLandscape: 15,
        textColor: '#9b2fe0',
        weight: 700
      }),
      B('story', { text: story, align: 'center' }),
      B('cta', purpleCta('Continue Reading', { fontSize: 18 })),
      B('audio', { asset: 'fcm-cover/bgm.mp3' })
    ]
  },
  {
    id: 'panel2',
    product: 'fiction',
    motion: 'panel2',
    title: 'Текст на панелі',
    reference: '0056 · 00105',
    description: 'Арт на весь екран, текст у напівпрозорій панелі, кнопка під панеллю.',
    settings: {
      background: '#090909',
      textColor: '#ffffff',
      font: 'serif',
      accent: '#7b2ff2',
      bgAsset: 'fcm-panel/bg.png',
      bgAssetL: 'fcm-panel/bgL.png',
      cardBg: '#141418',
      cardOpacity: 78,
      cardRadius: 12,
      cardBorder: '#3a3a46',
      portrait: { fontSize: 17, contentWidth: 88, ctaWidth: 62, ctaBottom: 4, gap: 12, panelHeight: 70 },
      landscape: { fontSize: 15, contentWidth: 80, ctaWidth: 34, ctaBottom: 4, gap: 10, panelHeight: 66 }
    },
    blocks: (B, story) => [
      B('logo', { zone: 'top', asset: 'fcm-cover/brand.png', text: 'FictionMe', width: 30 }),
      B('story', { text: story, align: 'center' }),
      B('cta', purpleCta('CONTINUE READING', { fontSize: 16, weight: 700, upper: true })),
      B('audio', { asset: 'fcm-panel/bgm.mp3' })
    ]
  },
  // ---------- Cleaner ----------
  {
    id: 'textbanner',
    product: 'cleaner',
    motion: 'textbanner',
    title: 'Текстовий банер',
    reference: '0048 · 0063 · 0072',
    description: 'Світлий фон, текст із виділеною фразою і кнопка. Топ формат.',
    settings: {
      background: '#f2f4f7',
      textColor: '#1f2533',
      font: 'sans',
      accent: '#3a86d8',
      markColor: '#bfe0ff',
      markText: '#1f2533',
      portrait: { fontSize: 19, contentWidth: 80, ctaWidth: 60, gap: 30 },
      landscape: { fontSize: 17, contentWidth: 60, ctaWidth: 30, gap: 18 }
    },
    blocks: B => [
      B('text', {
        label: 'Основний текст',
        text: 'If you want to clear your phone storage [[without spending any money]], use the CleanUp app. With just one tap, it finds and deletes all those extra files that take up a lot of space, such as duplicate photos, videos, old messages, and duplicate contacts that are cluttering your phone.'
      }),
      B('cta', {
        text: 'TRY NOW',
        bgColor: '#58aef0',
        bgColor2: '#2f86d8',
        radius: 999,
        height: 50,
        fontSize: 18,
        weight: 800,
        upper: true
      })
    ]
  },
  {
    id: 'steps',
    product: 'cleaner',
    motion: 'textbanner',
    title: 'Текст і кроки',
    reference: '0038 · 0060',
    description: 'Текст, «Three simple steps» і нумерований список, кнопка.',
    settings: {
      background: '#f3f4f6',
      textColor: '#20242e',
      font: 'sans',
      accent: '#3a86d8',
      markColor: '#bfe0ff',
      markText: '#20242e',
      portrait: { fontSize: 16, contentWidth: 84, ctaWidth: 60, gap: 22 },
      landscape: { fontSize: 14, contentWidth: 62, ctaWidth: 30, gap: 12 }
    },
    blocks: B => [
      B('image', { role: 'icon', label: 'Іконка', asset: '', width: 40, enabled: false }),
      B('text', {
        label: 'Основний текст',
        text: 'If you want to clean your phone storage without any money, use the Cleanup app.'
      }),
      B('text', {
        label: 'Заголовок кроків',
        text: 'Three simple steps:',
        weight: 700,
        fontSizePortrait: 16
      }),
      B('list', {
        label: 'Кроки',
        text: 'Click the Try Now button.\nInstall the CleanUp app.\nFree up your phone storage.',
        listStyle: 'number',
        width: 92
      }),
      B('cta', {
        text: 'Try Now',
        bgColor: '#9ec0dc',
        bgColor2: '#86abc9',
        radius: 999,
        height: 50,
        fontSize: 18,
        weight: 700
      })
    ]
  },
  {
    id: 'bubble',
    product: 'cleaner',
    motion: 'textbanner',
    title: 'Бульбашка',
    reference: '0083',
    description: 'Текст у жовтій бульбашці-нотатці з маленькою кнопкою всередині.',
    settings: {
      background: '#eef1ea',
      textColor: '#23261f',
      font: 'sans',
      accent: '#3a86d8',
      cardStyle: 'bubble',
      cardBg: '#fffbc9',
      cardBorder: '#d9c95c',
      cardRadius: 6,
      portrait: { fontSize: 16, contentWidth: 80, ctaWidth: 46, gap: 22 },
      landscape: { fontSize: 14, contentWidth: 56, ctaWidth: 40, gap: 12 }
    },
    blocks: B => [
      B('text', {
        label: 'Основний текст',
        align: 'left',
        text: 'If you want to clear your phone storage without spending any money, use the CleanUp app. With just one tap, it finds and deletes all those extra files that take up a lot of space, such as duplicate photos, videos, old messages, and duplicate contacts that are cluttering your phone.'
      }),
      B('cta', {
        text: 'Try Now',
        bgColor: '#ffffff',
        bgColor2: '#f0f0f0',
        textColor: '#2a2a2a',
        radius: 4,
        height: 36,
        fontSize: 15,
        weight: 500
      })
    ]
  },
  {
    id: 'aichat',
    product: 'cleaner',
    motion: 'aichat',
    title: 'AI-чат',
    reference: '0065 · 0064 · 0088',
    description: 'Питання → «Ask AI Chat» → відповідь друкується → кнопка.',
    settings: {
      background: '#242833',
      textColor: '#ffffff',
      font: 'sans',
      accent: '#3a86d8',
      previewChat: 'question',
      portrait: { fontSize: 15, contentWidth: 86, ctaWidth: 56, gap: 24 },
      landscape: { fontSize: 14, contentWidth: 60, ctaWidth: 28, gap: 14 }
    },
    blocks: B => [
      B('chat', {
        label: 'Чат',
        question: 'How to clear my phone without spending any money?',
        start: 'Ask AI Chat',
        header: 'AI Chat',
        answer:
          'Use the **CleanUp app**. With just one tap, it finds and deletes all those extra files that take up a lot of space, such as duplicate photos, videos, old messages, and duplicate contacts that are cluttering your phone.',
        fontSizePortrait: 26
      }),
      B('cta', {
        text: 'Try Now',
        bgColor: '#ffffff',
        bgColor2: '#e8ecf3',
        textColor: '#1d2433',
        radius: 999,
        height: 48,
        fontSize: 18,
        weight: 700
      })
    ]
  },
  {
    id: 'alertphoto',
    product: 'cleaner',
    motion: 'alertphoto',
    title: 'Алерт на фото',
    reference: '00122 · 00112',
    description: 'Фото-фон, картка алерту: заголовок, текст, пам’ять, таймер, кнопки.',
    settings: {
      background: '#d9c8d8',
      textColor: '#1f2330',
      font: 'sans',
      accent: '#3a6ff0',
      bgAsset: 'cleaner-alert/bg.png',
      bgAssetL: 'cleaner-alert/bgL.png',
      cardBg: '#ffffff',
      cardRadius: 14,
      portrait: { fontSize: 14, contentWidth: 84, ctaWidth: 100, gap: 16 },
      landscape: { fontSize: 13, contentWidth: 82, ctaWidth: 100, gap: 8 }
    },
    blocks: B => [
      B('text', {
        zone: 'card',
        role: 'alerttitle',
        label: 'Заголовок алерту',
        text: 'Does it feel like the memory is full?',
        weight: 700,
        fontSizePortrait: 17
      }),
      B('text', {
        zone: 'card',
        label: 'Текст алерту',
        text: 'Your device may be running low on space. Clean unused files to help free up room for photos, videos and apps.',
        textColor: '#5a6070',
        fontSizePortrait: 13
      }),
      B('bar', {
        zone: 'card',
        label: 'Storage Used',
        percent: 83,
        text: '106 GB of 128 GB',
        note: 'Illustrative example — your actual storage may differ.',
        fontSizePortrait: 12
      }),
      B('timer', { zone: 'card', label: 'Таймер', seconds: 60, enabled: false }),
      B('text', {
        zone: 'card',
        role: 'question',
        label: 'Питання',
        text: 'Would you like to clean it now?',
        weight: 600,
        fontSizePortrait: 14
      }),
      B('cta', {
        text: 'YES',
        bgColor: '#4a7bf5',
        bgColor2: '#2f5ce0',
        radius: 6,
        height: 44,
        fontSize: 16,
        weight: 700,
        upper: true,
        shadow: false
      }),
      B('button', { zone: 'card-after', label: 'Друга кнопка', text: 'Later' }),
      B('text', {
        zone: 'below',
        role: 'footnote',
        label: 'Примітка',
        text: 'Results may vary',
        textColor: '#ffffff',
        fontSizePortrait: 12
      })
    ]
  },
  {
    id: 'mockup',
    product: 'cleaner',
    motion: 'mockup',
    title: 'Мокап',
    reference: '0093',
    description: 'Текст, телефон-мокап і кнопка.',
    settings: {
      background: '#f3f4f6',
      textColor: '#20242e',
      font: 'sans',
      accent: '#4a6cf0',
      portrait: { fontSize: 14, contentWidth: 84, ctaWidth: 52, gap: 18 },
      landscape: { fontSize: 13, contentWidth: 86, ctaWidth: 30, gap: 12 }
    },
    blocks: B => [
      B('text', {
        label: 'Основний текст',
        text: 'If you want to clear your phone storage without spending any money, use the CleanUp app. With just one tap, it finds and deletes all those extra files that take up a lot of space.'
      }),
      B('image', { role: 'mockup', label: 'Мокап', asset: 'cleaner/mcp.png', width: 78 }),
      B('cta', {
        text: 'TRY NOW',
        bgColor: '#5b7cf5',
        bgColor2: '#3d5fe0',
        radius: 999,
        height: 48,
        fontSize: 17,
        weight: 800,
        upper: true
      })
    ]
  },
  {
    id: 'compare',
    product: 'cleaner',
    motion: 'compare',
    title: 'До / після',
    reference: '00101',
    description: 'Заголовок, «Buy Storage 99% vs Smart Cleaner 52%», кнопка.',
    settings: {
      background: '#ffffff',
      textColor: '#10291d',
      font: 'sans',
      accent: '#1d6b4a',
      markColor: '#ffffff',
      markText: '#1f9a5b',
      portrait: { fontSize: 14, contentWidth: 86, ctaWidth: 64, gap: 18 },
      landscape: { fontSize: 13, contentWidth: 60, ctaWidth: 34, gap: 10 }
    },
    blocks: B => [
      B('text', {
        label: 'Заголовок',
        text: 'Stop paying for [[space you could clean up]]',
        weight: 800,
        fontSizePortrait: 30,
        fontSizeLandscape: 24
      }),
      B('text', {
        label: 'Підзаголовок',
        text: '**Smart Cleaner app** helps you review clutter and start cleanup in one tap — so you can make more room before buying extra storage.',
        fontSizePortrait: 14
      }),
      B('rings', { label: 'Порівняння', width: 100 }),
      B('cta', {
        text: 'START CLEANUP',
        bgColor: '#1f7a55',
        bgColor2: '#145538',
        radius: 999,
        height: 50,
        fontSize: 17,
        weight: 800,
        upper: true
      })
    ]
  }
];

export function kitTemplate(id) {
  return KIT_TEMPLATES.find(t => t.id === id);
}
