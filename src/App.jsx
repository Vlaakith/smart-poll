import React, { useState } from 'react';

const timeSlots = [
  '04:00', '05:00', '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'
];

const days = [
  { id: 'mon', name: 'Пн', full: 'Понедельник' },
  { id: 'tue', name: 'Вт', full: 'Вторник' },
  { id: 'wed', name: 'Ср', full: 'Среда' },
  { id: 'thu', name: 'Чт', full: 'Четверг' },
  { id: 'fri', name: 'Пт', full: 'Пятница' },
  { id: 'sat', name: 'Сб', full: 'Суббота' },
  { id: 'sun', name: 'Вс', full: 'Воскресенье' }
];

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbylnyHDaVuQEgW1W2APPAHoBeiyJiF26K5NC4FomI2Ji2OnbtNEa-uHhlML3oyL8VYOFQ/exec';

// Текущие онлайн-встречи (из расписания)
const existingMeetings = {
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

// Преобразование slotId в читаемый формат
const formatSlot = (slotId) => {
  const [dayId, time] = slotId.split('-');
  const day = days.find(d => d.id === dayId);
  return `${day?.full || dayId} ${time}`;
};

export default function App() {
  const [selected, setSelected] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null);

  const toggleSlot = (slotId) => {
    if (existingMeetings[slotId]) return;
    
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slotId)) {
        next.delete(slotId);
      } else {
        next.add(slotId);
      }
      return next;
    });
  };

  const handleMouseDown = (slotId) => {
    if (existingMeetings[slotId]) return;
    setIsDragging(true);
    const willAdd = !selected.has(slotId);
    setDragMode(willAdd ? 'add' : 'remove');
    toggleSlot(slotId);
  };

  const handleMouseEnter = (slotId) => {
    if (!isDragging || existingMeetings[slotId]) return;
    
    setSelected(prev => {
      const next = new Set(prev);
      if (dragMode === 'add') {
        next.add(slotId);
      } else {
        next.delete(slotId);
      }
      return next;
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragMode(null);
  };

  const handleSubmit = async () => {
    if (selected.size === 0) return;
    
    setSending(true);
    setError(null);
    
    const slots = Array.from(selected).sort().map(formatSlot);
    
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script требует этого
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slots }),
      });
      
      // no-cors не даёт прочитать ответ, но если ошибки нет — считаем успехом
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
    if (existingMeetings[slotId]) {
      return 'bg-amber-100 border-amber-300 cursor-not-allowed';
    }
    if (selected.has(slotId)) {
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
              <p className="text-sm text-gray-500 mb-3">Вы отметили:</p>
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
          <p className="text-gray-600 text-sm md:text-base">
            Отметьте все слоты, когда вы могли бы посещать онлайн-встречу СМАРТ Рекавери. 
            Можно кликать или «рисовать» мышкой. Время указано московское.
          </p>
          
          <div className="flex gap-4 mt-4 text-sm flex-wrap">
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
              <div className="p-2 text-xs text-gray-400 text-center">МСК</div>
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
                  const meeting = existingMeetings[slotId];
                  
                  return (
                    <div
                      key={slotId}
                      className={`
                        relative h-10 rounded-lg border transition-colors
                        ${getSlotStyle(slotId)}
                      `}
                      onMouseDown={() => handleMouseDown(slotId)}
                      onMouseEnter={() => handleMouseEnter(slotId)}
                      title={meeting || (selected.has(slotId) ? 'Выбрано' : 'Кликните, чтобы выбрать')}
                    >
                      {meeting && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-amber-600 text-lg">●</span>
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
