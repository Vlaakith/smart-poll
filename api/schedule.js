const GAS_URL =
  'https://script.google.com/macros/s/AKfycbxMnsFXRBdGN2AktwBTcCB9qRcHuQy11fPdN9bpQUB_QEDbWYOy6vdiOKsC9vFrJUOE/exec';

const BASE = 'https://whatissmartrecovery.ru';
const PAGE_URL = `${BASE}/realtime_schedule`;

// ── Day mappings ────────────────────────────────────────────────────────────

const DAY_BY_SLUG = {
  ponedelnik: { schema: 'https://schema.org/Monday',    ru: 'Понедельник', slug: 'mon' },
  vtornik:    { schema: 'https://schema.org/Tuesday',   ru: 'Вторник',     slug: 'tue' },
  sreda:      { schema: 'https://schema.org/Wednesday', ru: 'Среда',       slug: 'wed' },
  chetverg:   { schema: 'https://schema.org/Thursday',  ru: 'Четверг',     slug: 'thu' },
  pyatnitsa:  { schema: 'https://schema.org/Friday',    ru: 'Пятница',     slug: 'fri' },
  subbota:    { schema: 'https://schema.org/Saturday',  ru: 'Суббота',     slug: 'sat' },
  voskresene: { schema: 'https://schema.org/Sunday',    ru: 'Воскресенье', slug: 'sun' },
};

// Russian day name → day slug (for offline cards)
const RU_DAY_TO_SLUG = {
  'Понедельник': 'ponedelnik',
  'Вторник':     'vtornik',
  'Среда':       'sreda',
  'Четверг':     'chetverg',
  'Пятница':     'pyatnitsa',
  'Суббота':     'subbota',
  'Воскресенье': 'voskresene',
};

// ── HTML helpers ─────────────────────────────────────────────────────────────

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

// Extract text content of all <p> tags inside a div string
function extractParagraphs(cardHtml) {
  const ps = [];
  const re = /<p>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = re.exec(cardHtml)) !== null) {
    ps.push(stripTags(m[1]).trim());
  }
  return ps;
}

// Extract href from first <a> inside a string
function extractHref(html) {
  const m = html.match(/href="([^"]+)"/);
  return m ? m[1] : null;
}

// ── Time helpers ─────────────────────────────────────────────────────────────

function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

// ── Topic helpers ─────────────────────────────────────────────────────────────

function classifyTopic(topic) {
  const isFamily = topic.includes('членов семьи') || topic.includes('для семьи');
  const isRPP    = topic.includes('РПП') || topic.includes('пищевого поведения');
  return { isFamily, isRPP };
}

// Phrase used in description sentence
function topicPhrase(topic) {
  const { isFamily, isRPP } = classifyTopic(topic);
  if (isRPP)    return 'по теме расстройств пищевого поведения (РПП)';
  if (isFamily) return 'для членов семьи и друзей';
  return 'для любых аддикций';
}

// ── Parse cards ──────────────────────────────────────────────────────────────

/**
 * Returns array of section objects:
 * { type: 'online'|'offline', daySlug, citySlug, cityName, cards: [...] }
 */
function parseHtml(html) {
  const sections = [];
  let mode = null; // 'online' | 'offline'

  // Split on h2 and h3 boundaries while keeping the tags
  // We process the flat token stream of h2/h3/div.meeting-card
  const tokenRe = /<h2[^>]*>([\s\S]*?)<\/h2>|<h3[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/h3>|(<div class="meeting-card">[\s\S]*?<\/div>)/g;

  let currentSection = null;
  let m;

  while ((m = tokenRe.exec(html)) !== null) {
    if (m[1] !== undefined) {
      // h2 — switches mode
      const h2text = stripTags(m[1]);
      if (h2text.includes('офлайн') || h2text.toLowerCase().includes('город')) {
        mode = 'offline';
      } else {
        mode = 'online';
      }
      currentSection = null;
    } else if (m[2] !== undefined) {
      // h3 — new section within current mode
      const h3id   = m[2];
      const h3text = stripTags(m[3]).trim();

      if (mode === 'online') {
        const dayInfo = DAY_BY_SLUG[h3id];
        if (dayInfo) {
          currentSection = { type: 'online', daySlug: h3id, dayInfo, cards: [] };
          sections.push(currentSection);
        }
      } else if (mode === 'offline') {
        currentSection = { type: 'offline', citySlug: h3id, cityName: h3text, cards: [] };
        sections.push(currentSection);
      }
    } else if (m[4] !== undefined) {
      // meeting-card div
      if (currentSection) {
        currentSection.cards.push(m[4]);
      }
    }
  }

  return sections;
}

/**
 * Parse a single online card div.
 * Returns { time, topic, duration, facilitatorText, womenOnly, meetingUrl, notes }
 */
function parseOnlineCard(cardHtml) {
  const ps = extractParagraphs(cardHtml);
  if (!ps.length) return null;

  // p[0]: "HH:MM: Тема «...»"
  const firstLine = ps[0];
  const timeMatch  = firstLine.match(/^(\d{1,2}:\d{2}):\s*(?:Тема\s*«(.+?)»|(.+))/);
  if (!timeMatch) return null;
  const time  = timeMatch[1].padStart(5, '0');
  const topic = (timeMatch[2] || timeMatch[3] || '').trim();

  // p[1]: "Продолжительность N минут"
  let duration = 90;
  if (ps[1]) {
    const dm = ps[1].match(/(\d+)\s*минут/);
    if (dm) duration = parseInt(dm[1], 10);
  }

  // p[2]: "Фасилитатор(ы) ..."
  let facilitatorText = '';
  let womenOnly = false;
  let notes = '';
  if (ps[2]) {
    const raw = ps[2];
    const dotIdx = raw.indexOf('.');
    if (dotIdx !== -1) {
      const mainPart  = raw.slice(0, dotIdx).trim();
      const afterDot  = raw.slice(dotIdx + 1).trim();
      facilitatorText = mainPart.replace(/^Фасилитатор[ы]?\s*/i, '').trim();
      if (afterDot) notes = afterDot;
      if (afterDot.toLowerCase().includes('только для женщин')) womenOnly = true;
    } else {
      facilitatorText = raw.replace(/^Фасилитатор[ы]?\s*/i, '').trim();
    }
    if (raw.toLowerCase().includes('только для женщин')) womenOnly = true;
  }

  // p[3] or later: camera note (ignored for description)
  // last p with <a href>: meeting URL
  let meetingUrl = null;
  for (let i = ps.length - 1; i >= 0; i--) {
    // re-check raw html paragraph for link
    const pRe = /<p>([\s\S]*?)<\/p>/g;
    const pMatches = [...cardHtml.matchAll(/<p>([\s\S]*?)<\/p>/g)];
    if (pMatches[i] && pMatches[i][1].includes('<a ')) {
      meetingUrl = extractHref(pMatches[i][1]);
      break;
    }
  }

  return { time, topic, duration, facilitatorText, womenOnly, meetingUrl, notes };
}

/**
 * Parse a single offline card div.
 * Returns { daySlug, dayInfo, time, topic, duration, facilitatorText, address, notes }
 */
function parseOfflineCard(cardHtml) {
  const ps = extractParagraphs(cardHtml);
  if (!ps.length) return null;

  // p[0]: "День HH:MM: Тема «...»"
  const firstLine = ps[0];
  const lineMatch = firstLine.match(/^(\S+)\s+(\d{1,2}:\d{2}):\s*(?:Тема\s*«(.+?)»|(.+))/);
  if (!lineMatch) return null;

  const dayRu  = lineMatch[1];
  const time   = lineMatch[2].padStart(5, '0');
  const topic  = (lineMatch[3] || lineMatch[4] || '').trim();
  const daySlugKey = RU_DAY_TO_SLUG[dayRu];
  const dayInfo    = daySlugKey ? DAY_BY_SLUG[daySlugKey] : null;

  // p[1]: "Продолжительность N минут"
  let duration = 60;
  if (ps[1]) {
    const dm = ps[1].match(/(\d+)\s*минут/);
    if (dm) duration = parseInt(dm[1], 10);
  }

  // p[2]: "Фасилитатор(ы) ..."
  let facilitatorText = '';
  if (ps[2]) {
    facilitatorText = ps[2].replace(/^Фасилитатор[ы]?\s*/i, '').trim();
  }

  // p[3]: address (starts with "г.")
  let address = '';
  let notes = '';
  for (let i = 3; i < ps.length; i++) {
    const p = ps[i];
    if (!address && p.startsWith('г.')) {
      address = p;
    } else {
      if (notes) notes += ' ';
      notes += p;
    }
  }

  return { daySlug: daySlugKey || null, dayInfo, time, topic, duration, facilitatorText, address, notes };
}

// ── JSON-LD builders ──────────────────────────────────────────────────────────

function buildEventId(type, opts) {
  if (type === 'online') {
    return `${PAGE_URL}#event-online-${opts.daySlug}-${opts.hhmm}`;
  }
  return `${PAGE_URL}#event-offline-${opts.citySlug}-${opts.daySlug}-${opts.hhmm}`;
}

function buildEventName(type, opts) {
  if (type === 'online') {
    const wSuffix = opts.womenOnly ? ', только для женщин' : '';
    return `SMART Recovery — ${opts.topic} (${opts.dayRu}, ${opts.time}, онлайн${wSuffix})`;
  }
  return `SMART Recovery — ${opts.topic} (${opts.cityName}, ${opts.dayRu}, ${opts.time}, офлайн)`;
}

function buildEventDescription(type, opts) {
  const prefix = type === 'online' ? 'Онлайн' : 'Офлайн';
  const phrase = topicPhrase(opts.topic);
  let desc = `${prefix}-встреча SMART Recovery ${phrase}. Фасилитатор ${opts.facilitatorText}. Продолжительность ${opts.duration} минут.`;
  if (opts.notes) desc += ` ${opts.notes}`;
  return desc.trim();
}

function buildOnlineEvent(section, card) {
  const parsed = parseOnlineCard(card);
  if (!parsed) return null;

  const { time, topic, duration, facilitatorText, womenOnly, meetingUrl, notes } = parsed;
  const { dayInfo, daySlug } = section;
  const hhmm    = time.replace(':', '');
  const endTime = addMinutes(time, duration);
  const { isFamily, isRPP } = classifyTopic(topic);

  const eventId = buildEventId('online', { daySlug: dayInfo.slug, hhmm });

  const event = {
    '@type': 'Event',
    '@id': eventId,
    'name': buildEventName('online', { topic, dayRu: dayInfo.ru, time, womenOnly }),
    'description': buildEventDescription('online', { topic, facilitatorText, duration, notes }),
    'eventAttendanceMode': 'https://schema.org/OnlineEventAttendanceMode',
    'eventStatus': 'https://schema.org/EventScheduled',
    'organizer': { '@id': `${BASE}/#organization` },
    'location': {
      '@type': 'VirtualLocation',
      'url': `${PAGE_URL}#${daySlug}`,
    },
    'url': `${PAGE_URL}#${daySlug}`,
    'isAccessibleForFree': true,
    'duration': `PT${duration}M`,
    'inLanguage': 'ru-RU',
    'eventSchedule': {
      '@type': 'Schedule',
      'repeatFrequency': 'P1W',
      'byDay': dayInfo.schema,
      'startTime': time,
      'endTime': endTime,
      'scheduleTimezone': 'Europe/Moscow',
    },
  };

  if (isFamily) {
    event['audience'] = { '@type': 'Audience', 'audienceType': 'Члены семьи и друзья' };
  } else if (womenOnly) {
    event['audience'] = { '@type': 'PeopleAudience', 'audienceType': 'Женщины', 'suggestedGender': 'female' };
  }

  if (isRPP) {
    event['about'] = { '@type': 'Thing', 'name': 'Расстройство пищевого поведения (РПП)' };
  }

  return event;
}

function buildOfflineEvent(section, card) {
  const parsed = parseOfflineCard(card);
  if (!parsed) return null;

  const { daySlug, dayInfo, time, topic, duration, facilitatorText, address, notes } = parsed;
  if (!dayInfo) return null;

  const { citySlug, cityName } = section;
  const hhmm    = time.replace(':', '');
  const endTime = addMinutes(time, duration);

  const eventId = buildEventId('offline', { citySlug, daySlug: dayInfo.slug, hhmm });

  // Strip "г. CityName, " prefix from address
  const streetAddress = address.replace(new RegExp(`^г\\.\\s*${cityName}\\s*,\\s*`, 'i'), '').trim();

  const event = {
    '@type': 'Event',
    '@id': eventId,
    'name': buildEventName('offline', { topic, cityName, dayRu: dayInfo.ru, time }),
    'description': buildEventDescription('offline', { topic, facilitatorText, duration, notes }),
    'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
    'eventStatus': 'https://schema.org/EventScheduled',
    'organizer': { '@id': `${BASE}/#organization` },
    'location': {
      '@type': 'Place',
      'name': `${cityName} — площадка SMART Recovery`,
      'address': {
        '@type': 'PostalAddress',
        'addressLocality': cityName,
        'streetAddress': streetAddress || address,
      },
    },
    'url': `${PAGE_URL}#${citySlug}`,
    'isAccessibleForFree': true,
    'duration': `PT${duration}M`,
    'inLanguage': 'ru-RU',
    'eventSchedule': {
      '@type': 'Schedule',
      'repeatFrequency': 'P1W',
      'byDay': dayInfo.schema,
      'startTime': time,
      'endTime': endTime,
      'scheduleTimezone': 'Europe/Moscow',
    },
  };

  return event;
}

// ── Static JSON-LD entries ───────────────────────────────────────────────────

function buildStaticEntries() {
  return [
    {
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      'name': 'Информационный проект SMART Recovery на русском языке',
      'url': `${BASE}/`,
      'logo': {
        '@type': 'ImageObject',
        '@id': `${BASE}/#logo`,
        'url': 'https://static.tildacdn.one/tild6161-3931-4862-b037-313336623831/SR_logo_rus1.png',
      },
      'sameAs': [
        'https://t.me/smartrecoveryrussian',
        'https://t.me/+cnz9W1PsBxUwZmEy',
        'https://t.me/smart_vostok',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      'url': `${BASE}/`,
      'name': 'whatissmartrecovery.ru',
      'publisher': { '@id': `${BASE}/#organization` },
      'inLanguage': 'ru-RU',
    },
    {
      '@type': 'WebPage',
      '@id': `${PAGE_URL}#webpage`,
      'url': PAGE_URL,
      'name': 'Расписание встреч SMART Recovery',
      'description':
        'Обновляемое расписание онлайн- и офлайн-встреч SMART Recovery на русском языке. Время онлайн-встреч указано по Москве. Встречи бесплатны, возможны изменения и отмены.',
      'isPartOf': { '@id': `${BASE}/#website` },
      'about': { '@id': `${PAGE_URL}#article` },
      'mainEntity': [
        { '@id': `${PAGE_URL}#online-meetings` },
        { '@id': `${PAGE_URL}#offline-meetings` },
      ],
      'breadcrumb': { '@id': `${PAGE_URL}#breadcrumb` },
      'inLanguage': 'ru-RU',
    },
    {
      '@type': 'Article',
      '@id': `${PAGE_URL}#article`,
      'mainEntityOfPage': { '@id': `${PAGE_URL}#webpage` },
      'headline': 'Расписание встреч SMART Recovery на русском языке',
      'description':
        'Страница с актуальным расписанием встреч SMART Recovery: онлайн-группы и встречи в городах. SMART Recovery — это светский подход к изменениям, основанный на научных методах, включая когнитивно-поведенческую терапию (КПТ), рационально-эмоционально-поведенческую терапию (РЭПТ), ACT (терапию принятия и ответственности) и мотивационное консультирование. Формат встреч — взаимопомощь и обучение навыкам саморегуляции; это не медицинское учреждение и не психотерапевтическая услуга.',
      'author': { '@id': `${BASE}/#organization` },
      'publisher': { '@id': `${BASE}/#organization` },
      'keywords': [
        'SMART Recovery',
        'расписание встреч',
        'онлайн встречи',
        'группы взаимопомощи',
        'КПТ',
        'когнитивно-поведенческая терапия',
        'РЭПТ',
        'ACT',
        'мотивационное консультирование',
      ],
      'inLanguage': 'ru-RU',
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${PAGE_URL}#breadcrumb`,
      'itemListElement': [
        { '@type': 'ListItem', 'position': 1, 'name': 'Главная', 'item': `${BASE}/` },
        { '@type': 'ListItem', 'position': 2, 'name': 'Расписание встреч', 'item': PAGE_URL },
      ],
    },
  ];
}

// ── Main JSON-LD builder ─────────────────────────────────────────────────────

function buildJsonLd(sections) {
  const graph = buildStaticEntries();

  const onlineEvents  = [];
  const offlineEvents = [];

  for (const section of sections) {
    for (const card of section.cards) {
      if (section.type === 'online') {
        const ev = buildOnlineEvent(section, card);
        if (ev) onlineEvents.push(ev);
      } else {
        const ev = buildOfflineEvent(section, card);
        if (ev) offlineEvents.push(ev);
      }
    }
  }

  // ItemList for online
  graph.push({
    '@type': 'ItemList',
    '@id': `${PAGE_URL}#online-meetings`,
    'name': 'Онлайн-встречи SMART Recovery',
    'description':
      'Еженедельные онлайн-встречи SMART Recovery на русском языке по дням недели. Время указано по Москве.',
    'itemListOrder': 'https://schema.org/ItemListUnordered',
    'numberOfItems': onlineEvents.length,
    'itemListElement': onlineEvents.map((ev, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'item': { '@id': ev['@id'] },
    })),
  });

  // ItemList for offline
  graph.push({
    '@type': 'ItemList',
    '@id': `${PAGE_URL}#offline-meetings`,
    'name': 'Офлайн-встречи SMART Recovery в городах',
    'description': 'Еженедельные офлайн-встречи SMART Recovery в российских городах.',
    'itemListOrder': 'https://schema.org/ItemListUnordered',
    'numberOfItems': offlineEvents.length,
    'itemListElement': offlineEvents.map((ev, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'item': { '@id': ev['@id'] },
    })),
  });

  // Add all event objects
  for (const ev of [...onlineEvents, ...offlineEvents]) {
    graph.push(ev);
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let html;
  try {
    const response = await fetch(GAS_URL, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`GAS responded with ${response.status}`);
    }
    html = await response.text();
  } catch (error) {
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(502).json({ error: `Failed to fetch schedule from source: ${error.message}` });
  }

  let jsonld;
  try {
    const sections = parseHtml(html);
    jsonld = buildJsonLd(sections);
  } catch (error) {
    // Parsing failure — still return html so client can at least render something
    jsonld = { '@context': 'https://schema.org', '@graph': buildStaticEntries() };
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=86400');
  return res.status(200).json({ html, jsonld });
}
