import React, { useState, useMemo } from 'react';

const days = [
  { id: 'mon', name: 'Пн', full: 'Понедельник' },
  { id: 'tue', name: 'Вт', full: 'Вторник' },
  { id: 'wed', name: 'Ср', full: 'Среда' },
  { id: 'thu', name: 'Чт', full: 'Четверг' },
  { id: 'fri', name: 'Пт', full: 'Пятница' },
  { id: 'sat', name: 'Сб', full: 'Суббота' },
  { id: 'sun', name: 'Вс', full: 'Воскресенье' }
];

const timezoneGroups = [
  {
    label: 'Россия',
    zones: [
      { id: 'msk-1', label: 'МСК−1 · Калининград', offset: -1 },
      { id: 'msk', label: 'МСК · Москва, Петербург', offset: 0 },
      { id: 'msk+1', label: 'МСК+1 · Самара, Ижевск', offset: 1 },
      { id: 'msk+2', label: 'МСК+2 · Екатеринбург, Уфа', offset: 2 },
      { id: 'msk+3', label: 'МСК+3 · Омск, Новосибирск', offset: 3 },
      { id: 'msk+4', label: 'МСК+4 · Красноярск', offset: 4 },
      { id: 'msk+5', label: 'МСК+5 · Иркутск', offset: 5 },
      { id: 'msk+6', label: 'МСК+6 · Якутск, Чита', offset: 6 },
      { id: 'msk+7', label: 'МСК+7 · Владивосток, Хабаровск', offset: 7 },
      { id: 'msk+8', label: 'МСК+8 · Магадан, Сахалин', offset: 8 },
      { id: 'msk+9', label: 'МСК+9 · Камчатка', offset: 9 },
    ]
  },
  {
    label: 'Другие регионы (выберите текущую разницу с Москвой)',
    zones: [
      { id: 'other-m12', label: 'МСК−12', offset: -12 },
      { id: 'other-m11', label: 'МСК−11', offset: -11 },
      { id: 'other-m10', label: 'МСК−10', offset: -10 },
      { id: 'other-m9', label: 'МСК−9', offset: -9 },
      { id: 'other-m8', label: 'МСК−8', offset: -8 },
      { id: 'other-m7', label: 'МСК−7', offset: -7 },
      { id: 'other-m6', label: 'МСК−6', offset: -6 },
      { id: 'other-m5', label: 'МСК−5', offset: -5 },
      { id: 'other-m4', label: 'МСК−4', offset: -4 },
      { id: 'other-m3', label: 'МСК−3', offset: -3 },
      { id: 'other-m2', label: 'МСК−2', offset: -2 },
      { id: 'other-m1', label: 'МСК−1', offset: -1 },
      { id: 'other-p1', label: 'МСК+1', offset: 1 },
      { id: 'other-p2', label: 'МСК+2', offset: 2 },
      { id: 'other-p3', label: 'МСК+3', offset: 3 },
      { id: 'other-p4', label: 'МСК+4', offset: 4 },
      { id: 'other-p5', label: 'МСК+5', offset: 5 },
      { id: 'other-p6', label: 'МСК+6', offset: 6 },
      { id: 'other-p7', label: 'МСК+7', offset: 7 },
      { id: 'other-p8', label: 'МСК+8', offset: 8 },
      { id: 'other-p9', label: 'МСК+9', offset: 9 },
      { id: 'other-p10', label: 'МСК+10', offset: 10 },
      { id: 'other-p11', label: 'МСК+11', offset: 11 },
      { id: 'other-p12', label: 'МСК+12', offset: 12 },
    ]
  }
];

// Плоский список для поиска по id
const allTimezones = timezoneGroups.flatMap(g => g.zones);

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbylnyHDaVuQEgW1W2APPAHoBeiyJiF26K5NC4FomI2Ji2OnbtNEa-uHhlML3oyL8VYOFQ/exec';

// Текущие онлайн-встречи в МСК (из расписания)
const existingMeetingsMSK = {
	'mon-10:00': 'Дина, 90 мин',
	'mon-19:00': 'Две встречи: семьи + аддикции',
	'tue-10:00': 'Алиса, 60 мин',
	'tue-21:00': 'Эдуард, 90 мин',
	'wed-10:00': 'Елена, 60 мин',
	'wed-19:00': 'Дмитрий, 60 мин',
	'wed-19:00': 'Дмитрий, 60 мин',
	'thu-13:00': 'Михаил и Ринат, 90 мин',
	'thu-20:00': 'Юлия, 60 мин',
	'fri-10:00': 'Олеся, 60 мин',
	'fri-19:00': 'Виктор, 90 мин',
	'fri-20:00': 'Елена, 60 мин',
	'sat-05:00': 'Надежда, 60 мин',
	'sat-13:00': 'Екатерина, 90 мин',
	'sat-17:00': 'Алиса, 60 мин',
	'sun-07:00': 'Виктор, 90 мин'
};

// Генерация 24 часов
const generateTimeSlots = () => {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    slots.push(`${h.toString().padStart(2, '0')}:00`);
  }
  return slots;
};

const timeSlots = generateTimeSlots();

// Конвертация дня и времени при смене часового пояса
const convertDayAndTime = (dayId, time, fromOffset, toOffset) => {
  const [hours] = time.split(':').map(Number);
  let newHours = hours + (toOffset - fromOffset);
  
  const dayIndex = days.findIndex(d => d.id === dayId);
  let newDayIndex = dayIndex;
  
  if (newHours < 0) {
    newHours += 24;
    newDayIndex = (dayIndex - 1 + 7) % 7;
  } else if (newHours >= 24) {
    newHours -= 24;
    newDayIndex = (dayIndex + 1) % 7;
  }
  
  return {
    dayId: days[newDayIndex].id,
    time: `${newHours.toString().padStart(2, '0')}:00`
  };
};

export default function App() {
  const [selected, setSelected] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);
  const [timezone, setTimezone] = useState('msk');

  const currentOffset = allTimezones.find(tz => tz.id === timezone)?.offset || 0;

  // Конвертируем существующие встречи в текущий часовой пояс для отображения
  const existingMeetingsDisplay = useMemo(() => {
    const converted = {};
    Object.entries(existingMeetingsMSK).forEach(([key, value]) => {
      const [dayId, time] = key.split('-');
      const { dayId: newDayId, time: newTime } = convertDayAndTime(dayId, time, 0, currentOffset);
      converted[`${newDayId}-${newTime}`] = value;
    });
    return converted;
  }, [currentOffset]);

  // Конвертируем slotId из отображаемого пояса в МСК для хранения
  const displayToMsk = (displaySlotId) => {
    const [dayId, time] = displaySlotId.split('-');
    const { dayId: mskDayId, time: mskTime } = convertDayAndTime(dayId, time, currentOffset, 0);
    return `${mskDayId}-${mskTime}`;
  };

  // Проверяем, выбран ли слот (selected хранит в МСК)
  const isSlotSelected = (displaySlotId) => {
    const mskSlotId = displayToMsk(displaySlotId);
    return selected.has(mskSlotId);
  };

  const toggleSlot = (displaySlotId) => {
    if (existingMeetingsDisplay[displaySlotId]) return;
    
    const mskSlotId = displayToMsk(displaySlotId);
    
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(mskSlotId)) {
        next.delete(mskSlotId);
      } else {
        next.add(mskSlotId);
      }
      return next;
    });
  };

  const handleMouseDown = (slotId) => {
    if (existingMeetingsDisplay[slotId]) return;
    setIsDragging(true);
    const willAdd = !isSlotSelected(slotId);
    setDragMode(willAdd ? 'add' : 'remove');
    toggleSlot(slotId);
  };

  const handleMouseEnter = (slotId) => {
    if (!isDragging || existingMeetingsDisplay[slotId]) return;
    
    const mskSlotId = displayToMsk(slotId);
    
    setSelected(prev => {
      const next = new Set(prev);
      if (dragMode === 'add') {
        next.add(mskSlotId);
      } else {
        next.delete(mskSlotId);
      }
      return next;
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  // Форматирование слота для отправки (всегда в МСК)
  const formatSlotMsk = (mskSlotId) => {
    const [dayId, time] = mskSlotId.split('-');
    const day = days.find(d => d.id === dayId);
    return `${day?.full || dayId} ${time}`;
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    
    setSending(true);
    setError(null);
    
    // Отправляем в МСК
    const slots = Array.from(selected).sort().map(formatSlotMsk);
    
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slots }),
      });
      
      setSubmitted(true);
      window.parent.postMessage({ type: 'poll-submitted' }, '*');
    } catch (err) {
      setError('Не удалось отправить. Попробуйте ещё раз.');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const getSlotStyle = (slotId) => {
    if (existingMeetingsDisplay[slotId]) {
      return 'bg-amber-100 border-amber-300 cursor-not-allowed';
    }
    if (isSlotSelected(slotId)) {
      return 'bg-emerald-400 border-emerald-500 cursor-pointer';
    }
    return 'bg-white border-gray-200 hover:bg-emerald-50 cursor-pointer';
  };

  if (submitted) {
    const selectedArray = Array.from(selected).sort();
    const byDay = days.map(day => ({
      day: day.full,
      slots: selectedArray
        .filter(s => s.startsWith(day.id))
        .map(s => s.split('-')[1])
    })).filter(d => d.slots.length > 0);

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">✓</div>
            <h2 className="text-xl font-semibold text-gray-800">Спасибо!</h2>
            <p className="text-gray-600 mt-2">Ваш ответ записан</p>
          </div>
          
          {byDay.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm text-gray-500 mb-3">Вы отметили (по МСК):</p>
              {byDay.map(({ day, slots }) => (
                <div key={day} className="mb-2 last:mb-0">
                  <span className="font-medium text-gray-700">{day}:</span>{' '}
                  <span className="text-gray-600">{slots.join(', ')}</span>
                </div>
              ))}
            </div>
          )}
          
          <button
            onClick={() => { setSubmitted(false); setSelected(new Set()); }}
            className="mt-6 w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
          >
            ← Заполнить ещё раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gray-50 p-4 md:p-8 select-none"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 mb-4">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800 mb-2">
            В какое время вам удобно?
          </h1>
          <p className="text-gray-600 text-sm md:text-base mb-4">
            Отметьте все слоты, когда вы могли бы посещать онлайн-встречу СМАРТ Рекавери. 
            Можно кликать или «рисовать» мышкой.
          </p>
          
          {/* Переключатель часового пояса */}
          <div className="mb-4 p-3 bg-blue-50 rounded-xl">
            <label className="block text-sm text-gray-600 mb-2">
              Ваш часовой пояс:
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {timezoneGroups.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.zones.map(tz => (
                    <option key={tz.id} value={tz.id}>{tz.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {timezone !== 'msk' && (
              <p className="text-xs text-gray-500 mt-2">
                Сетка подстроилась под ваш часовой пояс. Существующие встречи — тоже.
              </p>
            )}
          </div>
          
          <div className="flex gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-100 border border-amber-300"></div>
              <span className="text-gray-600">Уже есть встреча</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-400 border border-emerald-500"></div>
              <span className="text-gray-600">Мне подходит</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-2 md:p-4 overflow-x-auto">
          <div className="min-w-[500px]">
            {/* Header */}
            <div className="grid grid-cols-8 gap-1 mb-1">
              <div className="p-2 text-xs text-gray-400 text-center">
                {(() => {
                  const tz = allTimezones.find(tz => tz.id === timezone);
                  if (!tz) return 'МСК';
                  if (tz.label.includes(' · ')) return tz.label.split(' · ')[0];
                  return tz.label;
                })()}
              </div>
              {days.map(day => (
                <div key={day.id} className="p-2 text-center">
                  <span className="font-medium text-gray-700">{day.name}</span>
                </div>
              ))}
            </div>
            
            {/* Grid */}
            {timeSlots.map(time => (
              <div key={time} className="grid grid-cols-8 gap-1 mb-1">
                <div className="p-2 text-xs text-gray-400 text-right pr-3 flex items-center justify-end">
                  {time}
                </div>
                {days.map(day => {
                  const slotId = `${day.id}-${time}`;
                  const meeting = existingMeetingsDisplay[slotId];
                  
                  return (
                    <div
                      key={slotId}
                      className={`
                        relative h-8 rounded-lg border transition-colors
                        ${getSlotStyle(slotId)}
                      `}
                      onMouseDown={() => handleMouseDown(slotId)}
                      onMouseEnter={() => handleMouseEnter(slotId)}
                      title={meeting || (isSlotSelected(slotId) ? 'Выбрано' : 'Кликните, чтобы выбрать')}
                    >
                      {meeting && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-amber-600 text-sm">●</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <p className="text-sm text-gray-500">
            Выбрано слотов: <span className="font-medium text-gray-700">{selected.size}</span>
          </p>
          
          <div className="flex flex-col items-end gap-2">
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={sending || selected.size === 0}
              className={`
                w-full md:w-auto px-8 py-3 font-medium rounded-xl transition-colors
                ${sending || selected.size === 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'}
              `}
            >
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
